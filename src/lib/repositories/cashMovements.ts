import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { addCash } from '../accounting'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export async function addCashMovement(input:{userId:string;registerSessionId:string;direction:'in'|'out';amount:number;category:string;note?:string;idempotencyKey?:string}) {
  if (input.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر')
  return withTransaction(db=>{
    if(input.idempotencyKey){const prior=query<any>(db,'SELECT id FROM cash_ledger WHERE note LIKE ? LIMIT 1',[`%[idem:${input.idempotencyKey}]%`])[0]; if(prior)return {id:prior.id,duplicate:true}}
    const session=query<any>(db,"SELECT id,status FROM register_sessions WHERE id=? AND status='open'",[input.registerSessionId])[0]
    if(!session) throw new Error('لا توجد وردية مفتوحة')
    const id=uuid(); const note=`${input.note||''} [${input.category}]${input.idempotencyKey?` [idem:${input.idempotencyKey}]`:''}`.trim()
    addCash(db,{sessionId:input.registerSessionId,userId:input.userId,type:input.direction==='in'?'CASH_IN':'CASH_OUT',referenceType:'cash_movement',referenceId:id,amountIn:input.direction==='in'?input.amount:0,amountOut:input.direction==='out'?input.amount:0,note})
    run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',[uuid(),input.userId,input.direction==='in'?'CASH_IN':'CASH_OUT','cash_movement',id,JSON.stringify(input)])
    enqueueSync(db,{entityType:'cash_movement',entityId:id,operation:'create',payload:mapEntity(db,'cash_ledger',id)})
    return {id,direction:input.direction,amount:input.amount}
  })
}
