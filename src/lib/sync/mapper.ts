import type { Database } from 'sql.js'
import { query } from '../db/client'

const specs:Record<string,{table:string;id?:string;items?:{table:string;fk:string}[]}>= {
  category:{table:'categories'}, brand:{table:'brands'}, product:{table:'products',items:[{table:'product_variants',fk:'product_id'}]}, variant:{table:'product_variants'},
  customer:{table:'customers'}, supplier:{table:'suppliers'}, user:{table:'users'}, setting:{table:'settings',id:'key'},
  sale:{table:'sales',items:[{table:'sale_items',fk:'sale_id'}]}, purchase:{table:'purchases',items:[{table:'purchase_items',fk:'purchase_id'}]},
  sale_return:{table:'sale_returns',items:[{table:'sale_return_items',fk:'sale_return_id'}]}, purchase_return:{table:'purchase_returns',items:[{table:'purchase_return_items',fk:'purchase_return_id'}]},
  customer_payment:{table:'customer_payments'}, supplier_payment:{table:'supplier_payments'}, stock_adjustment:{table:'stock_movements'},
  register_session:{table:'register_sessions'}, expense:{table:'expenses'}, cash_ledger:{table:'cash_ledger'}, audit_log:{table:'audit_logs'},
}
export function mapEntity(db:Database,entityType:string,entityId:string){
  const spec=specs[entityType]; if(!spec) throw new Error(`نوع مزامنة غير مدعوم: ${entityType}`)
  const id=spec.id||'id'; const row=query<Record<string,unknown>>(db,`SELECT * FROM ${spec.table} WHERE ${id}=?`,[entityId])[0]
  if(!row) throw new Error(`السجل غير موجود: ${entityType}/${entityId}`)
  const result:{row:Record<string,unknown>;items?:Record<string,unknown>[]}={row}
  if(spec.items) result.items=query<Record<string,unknown>>(db,`SELECT * FROM ${spec.items[0].table} WHERE ${spec.items[0].fk}=? ORDER BY id`,[entityId])
  return result
}
