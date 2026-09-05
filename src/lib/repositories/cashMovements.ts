import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { addCash } from '../accounting'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export async function addCashMovement(input:{userId:string;registerSessionId:string;direction:'in'|'out';amount:number;category:string;note?:string;idempotencyKey?:string}) {
  if (input.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر')
  return withTransaction(db=>{
    if(input.idempotencyKey){const prior=query<any>(db,'SELECT id FROM cash_ledger WHERE idempotency_key=? LIMIT 1',[input.idempotencyKey])[0]; if(prior)return {id:prior.id,duplicate:true}}
    const session=query<any>(db,"SELECT id,status FROM register_sessions WHERE id=? AND status='open'",[input.registerSessionId])[0]
    if(!session) throw new Error('لا توجد وردية مفتوحة')
    const id=uuid(); const note=`${input.note||''} [${input.category}]${input.idempotencyKey?` [idem:${input.idempotencyKey}]`:''}`.trim()
    run(db,`INSERT INTO cash_ledger(id,register_session_id,user_id,entry_type,reference_type,reference_id,amount_in,amount_out,note,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,input.registerSessionId,input.userId,input.direction==='in'?'CASH_IN':'CASH_OUT','cash_movement',id,input.direction==='in'?input.amount:0,input.direction==='out'?input.amount:0,note,input.idempotencyKey??null])
    run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',[uuid(),input.userId,input.direction==='in'?'CASH_IN':'CASH_OUT','cash_movement',id,JSON.stringify(input)])
    enqueueSync(db,{entityType:'cash_movement',entityId:id,operation:'create',payload:mapEntity(db,'cash_ledger',id)})
    return {id,direction:input.direction,amount:input.amount}
  })
}
