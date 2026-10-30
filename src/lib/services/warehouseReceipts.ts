import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'
import { query, run, withTransaction } from '../db/client'
import { getDefaultWarehouseId, receiveStock } from '../repositories/inventory'

export interface OwnedStockReceiptLine {
  variantId:string
  quantity:number
  unitCost:number
}

function nextReceiptNo(db:Database) {
  const date=new Date()
  const day=`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`
  const prefix=`OWN-${day}-`
  const latest=query<{receipt_no:string}>(db,'SELECT receipt_no FROM warehouse_receipts WHERE receipt_no LIKE ? ORDER BY receipt_no DESC LIMIT 1',[`${prefix}%`])[0]
  const serial=latest?Number(latest.receipt_no.slice(prefix.length))+1:1
  return `${prefix}${String(serial).padStart(4,'0')}`
}

/**
 * Record inventory contributed by its owner/partner, without creating a
 * supplier payable, supplier payment, purchase cash movement, or drawer entry.
 */
export async function createOwnedStockReceipt(input:{
  userId:string
  warehouseId?:string|null
  sourceLabel:string
  notes?:string
  lines:OwnedStockReceiptLine[]
}) {
  return withTransaction(db=>{
    const warehouseId=input.warehouseId||getDefaultWarehouseId(db)
    const sourceLabel=String(input.sourceLabel||'').trim()
    if(!sourceLabel)throw new Error('اكتب اسم مالك البضاعة أو مصدرها')
    if(!input.lines.length)throw new Error('أضف صنفًا واحدًا على الأقل')
    const merged=new Map<string,{variantId:string;quantity:number;unitCost:number}>()
    for(const line of input.lines){
      if(!line.variantId)throw new Error('الصنف غير محدد')
      if(!Number.isInteger(line.quantity)||line.quantity<=0)throw new Error('كمية غير صحيحة')
      const unitCost=Number(line.unitCost)
      if(!Number.isFinite(unitCost)||unitCost<0)throw new Error('تكلفة الوحدة غير صحيحة')
      const key=`${line.variantId}:${Math.round(unitCost*100)}`
      const old=merged.get(key)
      merged.set(key,{variantId:line.variantId,quantity:(old?.quantity||0)+line.quantity,unitCost})
    }
    const id=uuid(),receiptNo=nextReceiptNo(db)
    run(db,'INSERT INTO warehouse_receipts(id,receipt_no,warehouse_id,source_label,notes,status,total_cost) VALUES(?,?,?,?,?,\'completed\',0)',
      [id,receiptNo,warehouseId,sourceLabel,String(input.notes||'').trim()||null])
    let totalCost=0
    for(const line of merged.values()){
      const received=receiveStock(db,{
        variantId:line.variantId,warehouseId,quantity:line.quantity,unitCost:line.unitCost,
        movementType:'OPENING_STOCK',sourceType:'warehouse_receipt',sourceId:id,
      })
      const lineCost=line.quantity*line.unitCost
      totalCost+=lineCost
      run(db,'INSERT INTO warehouse_receipt_items(id,receipt_id,variant_id,inventory_batch_id,quantity,unit_cost,total_cost) VALUES(?,?,?,?,?,?,?)',
        [uuid(),id,line.variantId,received.batchId,line.quantity,line.unitCost,lineCost])
    }
    run(db,'UPDATE warehouse_receipts SET total_cost=? WHERE id=?',[totalCost,id])
    run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',
      [uuid(),input.userId,'CREATE','warehouse_receipt',id,JSON.stringify({receiptNo,warehouseId,sourceLabel,totalCost,lines:[...merged.values()]})])
    return {id,receiptNo,warehouseId,sourceLabel,totalCost,lines:[...merged.values()]}
  })
}
