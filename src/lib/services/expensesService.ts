import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export async function addExpense(input:{userId:string;registerSessionId:string;category:string;amount:number;note?:string}){
  if(input.amount<=0)throw new Error('قيمة المصروف يجب أن تكون أكبر من صفر')
  if(!input.category.trim())throw new Error('تصنيف المصروف مطلوب')
  return withTransaction(db=>{
    const session = query<{ id: string }>(db, "SELECT id FROM register_sessions WHERE id=? AND status='open'", [input.registerSessionId])
    if (!session.length) throw new Error('يجب فتح الوردية قبل تسجيل مصروف')
    const id=uuid()
    run(db,`INSERT INTO expenses(id,category,amount,note,user_id,register_session_id) VALUES(?,?,?,?,?,?)`,[id,input.category.trim(),input.amount,input.note?.trim()||null,input.userId,input.registerSessionId])
    run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','expense',id,JSON.stringify({category:input.category.trim(),amount:input.amount})])
    enqueueSync(db,{entityType:'expense',entityId:id,operation:'create',payload:mapEntity(db,'expense',id)})
    return {id}
  })
}
