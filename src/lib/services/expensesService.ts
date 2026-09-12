import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export async function addExpense(input:{userId:string;registerSessionId?:string|null;category:string;amount:number;note?:string;expenseType?:'operating'|'fixed'|'shift'}){
  if(input.amount<=0)throw new Error('قيمة المصروف يجب أن تكون أكبر من صفر')
  if(!input.category.trim())throw new Error('تصنيف المصروف مطلوب')
  return withTransaction(db=>{
    let sessionId: string | null = null
    if (input.registerSessionId) {
      // Shift-tied expenses (e.g. cash paid out of the drawer during a shift) still
      // require an open shift. General/admin expenses (rent, salaries, utilities,
      // supplier services...) are posted without a shift so they can be recorded
      // any time, not only while the register happens to be open.
      const session = query<{ id: string }>(db, "SELECT id FROM register_sessions WHERE id=? AND status='open'", [input.registerSessionId])
      if (!session.length) throw new Error('يجب فتح الوردية قبل تسجيل مصروف على الوردية')
      sessionId = input.registerSessionId
    }
    const expenseType = input.expenseType || (sessionId ? 'shift' : 'operating')
    const periodMonth = new Date().toISOString().slice(0,7)
    const id=uuid()
    run(db,`INSERT INTO expenses(id,category,amount,note,user_id,register_session_id,expense_type,period_month) VALUES(?,?,?,?,?,?,?,?)`,[id,input.category.trim(),input.amount,input.note?.trim()||null,input.userId,sessionId,expenseType,periodMonth])
    run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','expense',id,JSON.stringify({category:input.category.trim(),amount:input.amount,expenseType})])
    enqueueSync(db,{entityType:'expense',entityId:id,operation:'create',payload:mapEntity(db,'expense',id)})
    return {id}
  })
}

export async function listExpenses(from?: string, to?: string) {
  return withTransaction(db => {
    const start = from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
    const end = to || new Date().toISOString().slice(0,10)
    return query<any>(db, `SELECT e.*, u.name user_name FROM expenses e LEFT JOIN users u ON u.id=e.user_id WHERE date(e.date) BETWEEN date(?) AND date(?) ORDER BY e.date DESC`, [start, end])
  })
}
