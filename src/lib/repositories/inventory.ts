import { getDb, query, withTransaction } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'

export type StockMovementType = 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT' | 'OPENING_STOCK'

export interface StockAllocation {
  id: string
  batchId: string
  warehouseId: string
  quantity: number
  unitCost: number
}

function positiveInteger(value:number,label='الكمية') {
  const n=Number(value)
  if(!Number.isInteger(n)||n<=0) throw new Error(`${label} يجب أن تكون عددًا صحيحًا أكبر من صفر`)
  return n
}

export function getDefaultWarehouseId(db:Database):string {
  const row=query<{id:string}>(db,"SELECT id FROM warehouses WHERE is_default=1 AND active=1 LIMIT 1")[0]
  if(!row) throw new Error('لا يوجد مخزن رئيسي نشط')
  return row.id
}

function activeWarehouseId(db:Database,warehouseId?:string|null):string {
  const id=warehouseId||getDefaultWarehouseId(db)
  const row=query<any>(db,'SELECT id,active FROM warehouses WHERE id=?',[id])[0]
  if(!row||Number(row.active)!==1) throw new Error('المخزن المحدد غير موجود أو غير نشط')
  return id
}

function setVariantAggregate(db:Database,variantId:string):number {
  const quantity=Number(query<{quantity:number}>(db,'SELECT COALESCE(SUM(quantity),0) quantity FROM warehouse_inventory WHERE variant_id=?',[variantId])[0]?.quantity||0)
  db.run("UPDATE product_variants SET quantity=?,updated_at=datetime('now') WHERE id=?",[quantity,variantId])
  return quantity
}

function changeWarehouseBalance(db:Database,warehouseId:string,variantId:string,delta:number):number {
  const old=Number(query<{quantity:number}>(db,'SELECT quantity FROM warehouse_inventory WHERE warehouse_id=? AND variant_id=?',[warehouseId,variantId])[0]?.quantity||0)
  const next=old+delta
  if(next<0) throw new Error('رصيد المخزن غير كافٍ لتنفيذ الحركة')
  db.run(`INSERT INTO warehouse_inventory(warehouse_id,variant_id,quantity,updated_at)
    VALUES(?,?,?,datetime('now'))
    ON CONFLICT(warehouse_id,variant_id) DO UPDATE SET quantity=excluded.quantity,updated_at=datetime('now')`,
    [warehouseId,variantId,next])
  return next
}

function addMovement(db:Database,input:{variantId:string;warehouseId:string;type:StockMovementType;quantity:number;referenceType:string;referenceId:string}) {
  db.run('INSERT INTO stock_movements(id,variant_id,warehouse_id,type,quantity,reference_type,reference_id) VALUES(?,?,?,?,?,?,?)',
    [uuid(),input.variantId,input.warehouseId,input.type,input.quantity,input.referenceType,input.referenceId])
}

/** Receive a new stock lot in one warehouse. Must be called inside withTransaction(). */
export function receiveStock(db:Database,input:{
  variantId:string;warehouseId?:string|null;quantity:number;unitCost?:number
  movementType?:StockMovementType;sourceType:string;sourceId?:string|null;createdAt?:string|null
}):{batchId:string;before:number;after:number} {
  const quantity=positiveInteger(input.quantity)
  const warehouseId=activeWarehouseId(db,input.warehouseId)
  const variant=query<any>(db,'SELECT id,quantity,cost_price FROM product_variants WHERE id=?',[input.variantId])[0]
  if(!variant) throw new Error('الصنف غير موجود')
  const before=Number(variant.quantity||0)
  const unitCost=Math.max(0,Number(input.unitCost??variant.cost_price)||0)
  const batchId=uuid()
  db.run(`INSERT INTO inventory_batches(id,variant_id,warehouse_id,source_type,source_id,received_quantity,remaining_quantity,unit_cost,created_at)
    VALUES(?,?,?,?,?,?,?,?,COALESCE(?,datetime('now')))`,
    [batchId,input.variantId,warehouseId,input.sourceType,input.sourceId??null,quantity,quantity,unitCost,input.createdAt??null])
  changeWarehouseBalance(db,warehouseId,input.variantId,quantity)
  const after=setVariantAggregate(db,input.variantId)
  addMovement(db,{variantId:input.variantId,warehouseId,type:input.movementType??'PURCHASE',quantity,referenceType:input.sourceType,referenceId:input.sourceId??batchId})
  return {batchId,before,after}
}

export function consumeStockFIFO(db:Database,input:{
  variantId:string;quantity:number;warehouseId?:string|null;movementType:StockMovementType
  referenceType:string;referenceId:string;saleItemId?:string;purchaseReturnItemId?:string
}):{allocations:StockAllocation[];totalCost:number;averageCost:number} {
  const quantity=positiveInteger(input.quantity)
  const warehouseId=input.warehouseId?activeWarehouseId(db,input.warehouseId):null
  const variant=query<any>(db,'SELECT id,quantity FROM product_variants WHERE id=?',[input.variantId])[0]
  if(!variant) throw new Error('الصنف غير موجود')
  if(Number(variant.quantity)<quantity) throw new Error('المخزون الإجمالي غير كافٍ')
  const where=warehouseId?'variant_id=? AND warehouse_id=? AND remaining_quantity>0':'variant_id=? AND remaining_quantity>0'
  const params=warehouseId?[input.variantId,warehouseId]:[input.variantId]
  const batches=query<any>(db,`SELECT id,warehouse_id,remaining_quantity,unit_cost FROM inventory_batches WHERE ${where} ORDER BY created_at ASC,id ASC`,params)
  const available=batches.reduce((sum,b)=>sum+Number(b.remaining_quantity||0),0)
  if(available<quantity) throw new Error(warehouseId?'رصيد المخزن المحدد لا يكفي':'تعذر مطابقة رصيد المخزون مع دفعات التكلفة؛ راجع تسوية المخزون')

  let remaining=quantity
  let totalCost=0
  const allocations:StockAllocation[]=[]
  const movementByWarehouse=new Map<string,number>()
  for(const batch of batches){
    if(remaining<=0) break
    const take=Math.min(remaining,Number(batch.remaining_quantity||0))
    if(take<=0) continue
    const cost=Math.max(0,Number(batch.unit_cost)||0)
    db.run('UPDATE inventory_batches SET remaining_quantity=remaining_quantity-? WHERE id=?',[take,batch.id])
    changeWarehouseBalance(db,batch.warehouse_id,input.variantId,-take)
    const allocationId=uuid()
    allocations.push({id:allocationId,batchId:batch.id,warehouseId:batch.warehouse_id,quantity:take,unitCost:cost})
    totalCost+=take*cost
    movementByWarehouse.set(batch.warehouse_id,(movementByWarehouse.get(batch.warehouse_id)||0)+take)
    if(input.saleItemId){
      db.run('INSERT INTO sale_item_allocations(id,sale_item_id,batch_id,warehouse_id,quantity,unit_cost) VALUES(?,?,?,?,?,?)',
        [allocationId,input.saleItemId,batch.id,batch.warehouse_id,take,cost])
    }
    if(input.purchaseReturnItemId){
      db.run('INSERT INTO purchase_return_item_allocations(id,purchase_return_item_id,batch_id,warehouse_id,quantity,unit_cost) VALUES(?,?,?,?,?,?)',
        [uuid(),input.purchaseReturnItemId,batch.id,batch.warehouse_id,take,cost])
    }
    remaining-=take
  }
  for(const [sourceId,moved] of movementByWarehouse){
    addMovement(db,{variantId:input.variantId,warehouseId:sourceId,type:input.movementType,quantity:-moved,referenceType:input.referenceType,referenceId:input.referenceId})
  }
  setVariantAggregate(db,input.variantId)
  return {allocations,totalCost,averageCost:totalCost/quantity}
}

export function consumeSpecificBatch(db:Database,input:{
  batchId:string;variantId:string;quantity:number;movementType:StockMovementType;referenceType:string;referenceId:string
  purchaseReturnItemId?:string
}):StockAllocation {
  const quantity=positiveInteger(input.quantity)
  const batch=query<any>(db,'SELECT id,variant_id,warehouse_id,remaining_quantity,unit_cost FROM inventory_batches WHERE id=?',[input.batchId])[0]
  if(!batch||batch.variant_id!==input.variantId) throw new Error('دفعة المخزون غير موجودة')
  if(Number(batch.remaining_quantity)<quantity) throw new Error('الكمية المتاحة من دفعة الشراء لا تكفي للمرتجع أو الإلغاء')
  db.run('UPDATE inventory_batches SET remaining_quantity=remaining_quantity-? WHERE id=?',[quantity,input.batchId])
  changeWarehouseBalance(db,batch.warehouse_id,input.variantId,-quantity)
  setVariantAggregate(db,input.variantId)
  addMovement(db,{variantId:input.variantId,warehouseId:batch.warehouse_id,type:input.movementType,quantity:-quantity,referenceType:input.referenceType,referenceId:input.referenceId})
  if(input.purchaseReturnItemId){
    db.run('INSERT INTO purchase_return_item_allocations(id,purchase_return_item_id,batch_id,warehouse_id,quantity,unit_cost) VALUES(?,?,?,?,?,?)',
      [uuid(),input.purchaseReturnItemId,input.batchId,batch.warehouse_id,quantity,Number(batch.unit_cost)||0])
  }
  return {id:uuid(),batchId:batch.id,warehouseId:batch.warehouse_id,quantity,unitCost:Number(batch.unit_cost)||0}
}

/** Returns sale units to the same warehouse and original cost lots they left. */
export function restoreSaleAllocations(db:Database,input:{
  saleItemId:string;variantId:string;quantity:number;referenceType:string;referenceId:string
  saleReturnItemId?:string;legacyUnitCost?:number
}):StockAllocation[] {
  const quantity=positiveInteger(input.quantity)
  const allocations=query<any>(db,`SELECT a.id,a.batch_id,a.warehouse_id,a.quantity,a.unit_cost
    FROM sale_item_allocations a WHERE a.sale_item_id=? ORDER BY a.created_at ASC,a.id ASC`,[input.saleItemId])
  if(!allocations.length){
    receiveStock(db,{variantId:input.variantId,quantity,unitCost:input.legacyUnitCost??0,movementType:'SALE_RETURN',sourceType:input.referenceType,sourceId:input.referenceId})
    return []
  }
  let remaining=quantity
  const restored:StockAllocation[]=[]
  for(const allocation of allocations){
    if(remaining<=0) break
    const returned=Number(query<{quantity:number}>(db,'SELECT COALESCE(SUM(quantity),0) quantity FROM sale_return_item_allocations WHERE sale_item_allocation_id=?',[allocation.id])[0]?.quantity||0)
    const available=Math.max(0,Number(allocation.quantity)-returned)
    const take=Math.min(remaining,available)
    if(take<=0) continue
    db.run('UPDATE inventory_batches SET remaining_quantity=remaining_quantity+? WHERE id=?',[take,allocation.batch_id])
    changeWarehouseBalance(db,allocation.warehouse_id,input.variantId,take)
    addMovement(db,{variantId:input.variantId,warehouseId:allocation.warehouse_id,type:'SALE_RETURN',quantity:take,referenceType:input.referenceType,referenceId:input.referenceId})
    if(input.saleReturnItemId){
      db.run(`INSERT INTO sale_return_item_allocations(id,sale_return_item_id,sale_item_allocation_id,batch_id,warehouse_id,quantity,unit_cost)
        VALUES(?,?,?,?,?,?,?)`,[uuid(),input.saleReturnItemId,allocation.id,allocation.batch_id,allocation.warehouse_id,take,allocation.unit_cost])
    }
    restored.push({id:allocation.id,batchId:allocation.batch_id,warehouseId:allocation.warehouse_id,quantity:take,unitCost:Number(allocation.unit_cost)||0})
    remaining-=take
  }
  if(remaining>0) throw new Error('تعذر تحديد المخزن الأصلي لكل وحدات المرتجع')
  setVariantAggregate(db,input.variantId)
  return restored
}

/** Backwards-compatible entry point; new business flows should use explicit lot-aware APIs. */
export function applyStockDelta(db:Database,input:{
  variantId:string;quantityChange:number;type:StockMovementType;referenceType:string;referenceId:string;warehouseId?:string|null
}):{before:number;after:number} {
  if(!Number.isInteger(input.quantityChange)||input.quantityChange===0) throw new Error('كمية حركة المخزون غير صحيحة')
  const before=Number(query<{quantity:number}>(db,'SELECT quantity FROM product_variants WHERE id=?',[input.variantId])[0]?.quantity||0)
  if(input.quantityChange>0){
    receiveStock(db,{variantId:input.variantId,warehouseId:input.warehouseId,quantity:input.quantityChange,movementType:input.type,sourceType:input.referenceType,sourceId:input.referenceId})
  }else{
    consumeStockFIFO(db,{variantId:input.variantId,warehouseId:input.warehouseId,quantity:-input.quantityChange,movementType:input.type,referenceType:input.referenceType,referenceId:input.referenceId})
  }
  const after=Number(query<{quantity:number}>(db,'SELECT quantity FROM product_variants WHERE id=?',[input.variantId])[0]?.quantity||0)
  return {before,after}
}

export function createWarehouse(db:Database,input:{name:string;code?:string;location?:string;notes?:string}) {
  const name=String(input.name||'').trim()
  if(!name) throw new Error('اسم المخزن مطلوب')
  const code=String(input.code||`WH-${uuid().slice(0,8).toUpperCase()}`).trim().toUpperCase()
  const id=uuid()
  db.run('INSERT INTO warehouses(id,name,code,location,notes,is_default,active) VALUES(?,?,?,?,?,0,1)',
    [id,name,code,String(input.location||'').trim()||null,String(input.notes||'').trim()||null])
  for(const variant of query<{id:string}>(db,'SELECT id FROM product_variants')){
    db.run('INSERT OR IGNORE INTO warehouse_inventory(warehouse_id,variant_id,quantity) VALUES(?,?,0)',[id,variant.id])
  }
  return query<any>(db,'SELECT * FROM warehouses WHERE id=?',[id])[0]
}

export function listWarehouses(db:Database) {
  return query<any>(db,`SELECT w.*,
    COALESCE(SUM(wi.quantity),0) total_units,
    COUNT(DISTINCT CASE WHEN wi.quantity>0 THEN wi.variant_id END) stocked_variants,
    COALESCE((SELECT SUM(b.remaining_quantity*b.unit_cost) FROM inventory_batches b WHERE b.warehouse_id=w.id),0) cost_value,
    COALESCE(SUM(wi.quantity*v.sell_price),0) retail_value
    FROM warehouses w LEFT JOIN warehouse_inventory wi ON wi.warehouse_id=w.id
    LEFT JOIN product_variants v ON v.id=wi.variant_id
    GROUP BY w.id ORDER BY w.is_default DESC,w.created_at ASC`).map((w:any)=>({
      ...w,is_default:Number(w.is_default)===1,active:Number(w.active)===1,
      total_units:Number(w.total_units||0),stocked_variants:Number(w.stocked_variants||0),
      cost_value:Number(w.cost_value||0),retail_value:Number(w.retail_value||0),
    }))
}

export function getWarehouseStock(db:Database,warehouseId:string,search='') {
  const warehouse=query<any>(db,'SELECT id,name,active FROM warehouses WHERE id=?',[warehouseId])[0]
  if(!warehouse) throw new Error('المخزن غير موجود')
  const q=String(search||'').trim().toLowerCase()
  const params:any[]=[warehouseId]
  let where='1=1'
  if(q){where+=` AND (lower(p.name) LIKE ? OR lower(v.sku) LIKE ? OR lower(COALESCE(v.barcode,'')) LIKE ?
    OR lower(COALESCE(v.size,'')) LIKE ? OR lower(COALESCE(v.color,'')) LIKE ?)`;params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)}
  const rows=query<any>(db,`SELECT v.*,COALESCE(wi.quantity,0) warehouse_quantity,p.id product_id,p.name product_name,p.category_id,c.name category_name
    FROM product_variants v JOIN products p ON p.id=v.product_id
    LEFT JOIN warehouse_inventory wi ON wi.variant_id=v.id AND wi.warehouse_id=?
    LEFT JOIN categories c ON c.id=p.category_id WHERE ${where} ORDER BY p.name,v.sku`,params)
  return {warehouse,items:rows.map((r:any)=>({
    id:r.id,variantId:r.id,sku:r.sku,barcode:r.barcode,size:r.size,color:r.color,
    costPrice:Number(r.cost_price||0),sellPrice:Number(r.sell_price||0),
    quantity:Number(r.warehouse_quantity||0),totalQuantity:Number(r.quantity||0),
    product:{id:r.product_id,name:r.product_name},category:r.category_name||null,
  }))}
}

export function transferStock(db:Database,input:{
  sourceWarehouseId:string;destinationWarehouseId:string;lines:Array<{variantId:string;quantity:number}>;notes?:string
}) {
  const sourceId=activeWarehouseId(db,input.sourceWarehouseId)
  const destinationId=activeWarehouseId(db,input.destinationWarehouseId)
  if(sourceId===destinationId) throw new Error('يجب اختيار مخزنين مختلفين للتحويل')
  if(!input.lines.length) throw new Error('أضف صنفًا واحدًا على الأقل للتحويل')
  const merged=new Map<string,number>()
  for(const line of input.lines) merged.set(line.variantId,(merged.get(line.variantId)||0)+positiveInteger(line.quantity))
  const id=uuid()
  const day=new Date().toISOString().slice(0,10).replaceAll('-','')
  const serial=Number(query<{n:number}>(db,'SELECT COUNT(*) n FROM warehouse_transfers WHERE transfer_no LIKE ?',[ `TR-${day}-%` ])[0]?.n||0)+1
  const transferNo=`TR-${day}-${String(serial).padStart(4,'0')}`
  db.run("INSERT INTO warehouse_transfers(id,transfer_no,source_warehouse_id,destination_warehouse_id,notes,status) VALUES(?,?,?,?,?,'completed')",
    [id,transferNo,sourceId,destinationId,String(input.notes||'').trim()||null])
  for(const [variantId,quantity] of merged){
    if(!query(db,'SELECT id FROM product_variants WHERE id=?',[variantId]).length) throw new Error('أحد الأصناف المحددة غير موجود')
    const balance=Number(query<{quantity:number}>(db,'SELECT quantity FROM warehouse_inventory WHERE warehouse_id=? AND variant_id=?',[sourceId,variantId])[0]?.quantity||0)
    if(balance<quantity) throw new Error('رصيد المخزن المصدر لا يكفي لإتمام التحويل')
    const itemId=uuid()
    db.run('INSERT INTO warehouse_transfer_items(id,transfer_id,variant_id,quantity) VALUES(?,?,?,?)',[itemId,id,variantId,quantity])
    const batches=query<any>(db,`SELECT id,remaining_quantity,unit_cost,created_at FROM inventory_batches
      WHERE variant_id=? AND warehouse_id=? AND remaining_quantity>0 ORDER BY created_at ASC,id ASC`,[variantId,sourceId])
    let remaining=quantity
    for(const batch of batches){
      if(remaining<=0) break
      const take=Math.min(remaining,Number(batch.remaining_quantity||0))
      db.run('UPDATE inventory_batches SET remaining_quantity=remaining_quantity-? WHERE id=?',[take,batch.id])
      changeWarehouseBalance(db,sourceId,variantId,-take)
      const destinationBatchId=uuid()
      db.run(`INSERT INTO inventory_batches(id,variant_id,warehouse_id,source_type,source_id,source_batch_id,received_quantity,remaining_quantity,unit_cost,created_at)
        VALUES(?,?,?,'warehouse_transfer',?,?,?,?,?,?)`,
        [destinationBatchId,variantId,destinationId,id,batch.id,take,take,Number(batch.unit_cost)||0,batch.created_at])
      changeWarehouseBalance(db,destinationId,variantId,take)
      db.run('INSERT INTO warehouse_transfer_allocations(id,transfer_item_id,source_batch_id,destination_batch_id,quantity,unit_cost) VALUES(?,?,?,?,?,?)',
        [uuid(),itemId,batch.id,destinationBatchId,take,Number(batch.unit_cost)||0])
      addMovement(db,{variantId,warehouseId:sourceId,type:'ADJUSTMENT',quantity:-take,referenceType:'warehouse_transfer_out',referenceId:id})
      addMovement(db,{variantId,warehouseId:destinationId,type:'ADJUSTMENT',quantity:take,referenceType:'warehouse_transfer_in',referenceId:id})
      remaining-=take
    }
    if(remaining>0) throw new Error('دفعات المخزون لا تطابق رصيد المخزن المصدر')
    setVariantAggregate(db,variantId)
  }
  return {id,transferNo,sourceWarehouseId:sourceId,destinationWarehouseId:destinationId,lines:[...merged].map(([variantId,quantity])=>({variantId,quantity}))}
}

export function getWarehouseStatement(db:Database,warehouseId:string,from?:string,to?:string) {
  const warehouse=query<any>(db,'SELECT * FROM warehouses WHERE id=?',[warehouseId])[0]
  if(!warehouse) throw new Error('المخزن غير موجود')
  const dates=(alias:string)=>`(?='' OR date(${alias})>=date(?)) AND (?='' OR date(${alias})<=date(?))`
  const rangeParams=[from||'',from||'',to||'',to||'']
  const purchases=Number(query<any>(db,`SELECT COALESCE(SUM(total),0) total FROM purchases
    WHERE warehouse_id=? AND status='completed' AND ${dates('date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const purchaseReturns=Number(query<any>(db,`SELECT COALESCE(SUM(pr.total),0) total FROM purchase_returns pr JOIN purchases p ON p.id=pr.purchase_id
    WHERE p.warehouse_id=? AND pr.status='completed' AND ${dates('pr.date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const sales=Number(query<any>(db,`SELECT COALESCE(SUM(a.quantity*si.unit_price*CASE WHEN s.subtotal>0 THEN MAX(0,1-s.discount/s.subtotal) ELSE 1 END),0) total
    FROM sale_item_allocations a JOIN sale_items si ON si.id=a.sale_item_id JOIN sales s ON s.id=si.sale_id
    WHERE a.warehouse_id=? AND s.status='completed' AND ${dates('s.date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const legacySales=Number(query<any>(db,`SELECT COALESCE(SUM(si.total*CASE WHEN s.subtotal>0 THEN MAX(0,1-s.discount/s.subtotal) ELSE 1 END),0) total
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.status='completed' AND ${dates('s.date')}
    AND NOT EXISTS(SELECT 1 FROM sale_item_allocations a WHERE a.sale_item_id=si.id)
    AND EXISTS(SELECT 1 FROM warehouses w WHERE w.id=? AND w.is_default=1)`,[...rangeParams,warehouseId])[0]?.total||0)
  const salesReturns=Number(query<any>(db,`SELECT COALESCE(SUM(a.quantity*sri.unit_price*CASE WHEN s.subtotal>0 THEN MAX(0,1-s.discount/s.subtotal) ELSE 1 END),0) total
    FROM sale_return_item_allocations a JOIN sale_return_items sri ON sri.id=a.sale_return_item_id
    JOIN sale_items si ON si.id=sri.sale_item_id JOIN sales s ON s.id=si.sale_id JOIN sale_returns sr ON sr.id=sri.sale_return_id
    WHERE a.warehouse_id=? AND sr.status='completed' AND ${dates('sr.date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const legacyReturns=Number(query<any>(db,`SELECT COALESCE(SUM(sri.total*CASE WHEN s.subtotal>0 THEN MAX(0,1-s.discount/s.subtotal) ELSE 1 END),0) total
    FROM sale_return_items sri JOIN sale_returns sr ON sr.id=sri.sale_return_id
    JOIN sale_items si ON si.id=sri.sale_item_id JOIN sales s ON s.id=si.sale_id
    WHERE sr.status='completed' AND ${dates('sr.date')}
    AND NOT EXISTS(SELECT 1 FROM sale_item_allocations a WHERE a.sale_item_id=si.id)
    AND EXISTS(SELECT 1 FROM warehouses w WHERE w.id=? AND w.is_default=1)`,[...rangeParams,warehouseId])[0]?.total||0)
  const cogs=Number(query<any>(db,`SELECT COALESCE(SUM(a.quantity*a.unit_cost),0) total FROM sale_item_allocations a
    JOIN sale_items si ON si.id=a.sale_item_id JOIN sales s ON s.id=si.sale_id
    WHERE a.warehouse_id=? AND s.status='completed' AND ${dates('s.date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const legacyCogs=Number(query<any>(db,`SELECT COALESCE(SUM(si.quantity*si.unit_cost),0) total FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.status='completed' AND ${dates('s.date')} AND NOT EXISTS(SELECT 1 FROM sale_item_allocations a WHERE a.sale_item_id=si.id)
    AND EXISTS(SELECT 1 FROM warehouses w WHERE w.id=? AND w.is_default=1)`,[...rangeParams,warehouseId])[0]?.total||0)
  const returnCogs=Number(query<any>(db,`SELECT COALESCE(SUM(a.quantity*a.unit_cost),0) total FROM sale_return_item_allocations a
    JOIN sale_return_items sri ON sri.id=a.sale_return_item_id JOIN sale_returns sr ON sr.id=sri.sale_return_id
    WHERE a.warehouse_id=? AND sr.status='completed' AND ${dates('sr.date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const legacyReturnCogs=Number(query<any>(db,`SELECT COALESCE(SUM(sri.quantity*si.unit_cost),0) total FROM sale_return_items sri JOIN sale_returns sr ON sr.id=sri.sale_return_id
    JOIN sale_items si ON si.id=sri.sale_item_id WHERE sr.status='completed' AND ${dates('sr.date')}
    AND NOT EXISTS(SELECT 1 FROM sale_item_allocations a WHERE a.sale_item_id=si.id)
    AND EXISTS(SELECT 1 FROM warehouses w WHERE w.id=? AND w.is_default=1)`,[...rangeParams,warehouseId])[0]?.total||0)
  const expenses=Number(query<any>(db,`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE warehouse_id=? AND ${dates('date')}`,[warehouseId,...rangeParams])[0]?.total||0)
  const sharedExpenses=Number(query<any>(db,`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE warehouse_id IS NULL AND ${dates('date')}`,rangeParams)[0]?.total||0)
  const stock=query<any>(db,`SELECT COALESCE(SUM(b.remaining_quantity*b.unit_cost),0) cost_value,
    COALESCE(SUM(wi.quantity*v.sell_price),0) retail_value,COALESCE(SUM(wi.quantity),0) quantity
    FROM warehouse_inventory wi JOIN product_variants v ON v.id=wi.variant_id
    LEFT JOIN inventory_batches b ON b.warehouse_id=wi.warehouse_id AND b.variant_id=wi.variant_id
    WHERE wi.warehouse_id=?`,[warehouseId])[0]||{}
  const netSales=sales+legacySales-salesReturns-legacyReturns
  const netCogs=cogs+legacyCogs-returnCogs-legacyReturnCogs
  const grossProfit=netSales-netCogs
  return {
    warehouse,from:from||null,to:to||null,purchases,purchaseReturns,netPurchases:purchases-purchaseReturns,
    sales:sales+legacySales,salesReturns:salesReturns+legacyReturns,netSales,costOfGoodsSold:netCogs,grossProfit,
    expenses,sharedExpenses,netProfit:grossProfit-expenses,stockQuantity:Number(stock.quantity||0),
    stockCostValue:Number(stock.cost_value||0),stockRetailValue:Number(stock.retail_value||0),
  }
}

export async function adjustStock(input:{
  variantId:string;quantityChange:number;warehouseId?:string;userId?:string;reason?:string;notes?:string;type?:StockMovementType
}):Promise<void> {
  await withTransaction(db=>{
    const result=applyStockDelta(db,{variantId:input.variantId,warehouseId:input.warehouseId,quantityChange:input.quantityChange,
      type:input.type??'ADJUSTMENT',referenceType:'adjustment',referenceId:input.userId??'system'})
    db.run('INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',
      [uuid(),input.userId??null,'STOCK_ADJUST','product_variant',input.variantId,JSON.stringify({
        warehouseId:input.warehouseId??getDefaultWarehouseId(db),before:result.before,after:result.after,
        reason:input.reason??null,notes:input.notes??null,type:input.type??'ADJUSTMENT'
      })])
  })
}

export async function getStockLedger(variantId:string,warehouseId?:string) {
  const db=await getDb()
  return query<any>(db,`SELECT sm.*,w.name warehouse_name FROM stock_movements sm LEFT JOIN warehouses w ON w.id=sm.warehouse_id
    WHERE sm.variant_id=? AND (? IS NULL OR sm.warehouse_id=?) ORDER BY sm.created_at DESC`,
    [variantId,warehouseId||null,warehouseId||null])
}
