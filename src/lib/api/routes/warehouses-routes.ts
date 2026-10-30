import { getDb, query, withTransaction } from '../../db/client'
import { createWarehouse, getWarehouseStatement, getWarehouseStock, listWarehouses, transferStock } from '../../repositories/inventory'
import { jsonResponse, body, type RouteCtx } from '../shared'

export async function handleWarehousesRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { u, p, method, user } = ctx
  const canManage = ['admin','manager'].includes(user!.role)

  if (p === '/warehouses' && method === 'GET') {
    const db=await getDb()
    const warehouses=listWarehouses(db).filter((w:any)=>w.active)
    if(user!.role==='cashier'){
      return jsonResponse({items:warehouses.map((w:any)=>({id:w.id,name:w.name,code:w.code,is_default:w.is_default,active:w.active}))})
    }
    return jsonResponse({items:warehouses,defaultWarehouseId:warehouses.find((w:any)=>w.is_default)?.id||null})
  }

  if (p === '/warehouses' && method === 'POST') {
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const b=await body(req)
    const warehouse=await withTransaction(tx=>createWarehouse(tx,{name:String(b.name||''),code:b.code,location:b.location,notes:b.notes}))
    return jsonResponse(warehouse,201)
  }

  const warehouseMatch=p.match(/^\/warehouses\/([^/]+)$/)
  if(warehouseMatch && method==='PATCH'){
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const id=warehouseMatch[1]
    const b=await body(req)
    const db=await getDb()
    const current=query<any>(db,'SELECT * FROM warehouses WHERE id=?',[id])[0]
    if(!current)return jsonResponse({error:'المخزن غير موجود'},404)
    if(Number(current.is_default)===1 && b.active===false)return jsonResponse({error:'لا يمكن تعطيل المخزن الرئيسي'},400)
    if(b.active===false){
      const quantity=Number(query<any>(db,'SELECT COALESCE(SUM(quantity),0) q FROM warehouse_inventory WHERE warehouse_id=?',[id])[0]?.q||0)
      if(quantity>0)return jsonResponse({error:'لا يمكن تعطيل مخزن يحتوي على رصيد. انقل الكميات أولًا.'},400)
    }
    await withTransaction(tx=>{
      tx.run("UPDATE warehouses SET name=?,location=?,notes=?,active=?,updated_at=datetime('now') WHERE id=?",
        [String(b.name??current.name).trim(),String(b.location??current.location??'').trim()||null,String(b.notes??current.notes??'').trim()||null,b.active===undefined?current.active:(b.active?1:0),id])
    })
    return jsonResponse(query<any>(await getDb(),'SELECT * FROM warehouses WHERE id=?',[id])[0])
  }

  const stockMatch=p.match(/^\/warehouses\/([^/]+)\/stock$/)
  if(stockMatch && method==='GET'){
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const db=await getDb()
    const result=getWarehouseStock(db,stockMatch[1],u.searchParams.get('search')||'')
    return jsonResponse(result)
  }

  const statementMatch=p.match(/^\/warehouses\/([^/]+)\/statement$/)
  if(statementMatch && method==='GET'){
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const db=await getDb()
    return jsonResponse(getWarehouseStatement(db,statementMatch[1],u.searchParams.get('from')||undefined,u.searchParams.get('to')||undefined))
  }

  if(p==='/warehouse-transfers' && method==='GET'){
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const db=await getDb()
    const rows=query<any>(db,`SELECT t.*,s.name source_name,d.name destination_name,
      (SELECT COUNT(*) FROM warehouse_transfer_items i WHERE i.transfer_id=t.id) line_count,
      (SELECT COALESCE(SUM(i.quantity),0) FROM warehouse_transfer_items i WHERE i.transfer_id=t.id) total_quantity
      FROM warehouse_transfers t
      JOIN warehouses s ON s.id=t.source_warehouse_id
      JOIN warehouses d ON d.id=t.destination_warehouse_id
      ORDER BY t.created_at DESC LIMIT 100`)
    return jsonResponse({items:rows})
  }

  if(p==='/warehouse-transfers' && method==='POST'){
    if(!canManage)return jsonResponse({error:'صلاحية غير كافية'},403)
    const b=await body(req)
    if(!Array.isArray(b.items)||!b.items.length)return jsonResponse({error:'أضف أصناف التحويل'},400)
    const db=await getDb()
    const result=await withTransaction(tx=>transferStock(tx,{
      sourceWarehouseId:String(b.sourceWarehouseId||''),
      destinationWarehouseId:String(b.destinationWarehouseId||''),
      lines:b.items.map((x:any)=>({variantId:String(x.variantId||''),quantity:Number(x.quantity||0)})),
      notes:b.notes,
    }))
    return jsonResponse(result,201)
  }

  return null
}
