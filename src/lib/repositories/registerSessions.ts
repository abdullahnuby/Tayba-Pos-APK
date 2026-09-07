import { getDb, query, run, withTransaction } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { RegisterSession } from '../types'
import { enqueueSync } from '../sync/queue'
import { cashExpected } from '../accounting'

export async function getOpenSession(userId:string):Promise<RegisterSession|null>{
  const db=await getDb()
  return query<RegisterSession>(db,"SELECT * FROM register_sessions WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",[userId])[0]??null
}

export async function openSession(userId:string,openingFloat:number){
  if(!Number.isFinite(openingFloat)||openingFloat<0)throw new Error('الرصيد الافتتاحي غير صحيح')
  return withTransaction(db=>{
    if(!query(db,"SELECT id FROM register_sessions WHERE user_id=? AND status='open' LIMIT 1",[userId])[0]){
      const id=uuid()
      run(db,"INSERT INTO register_sessions(id,user_id,opening_float,status) VALUES(?,?,?,'open')",[id,userId,openingFloat])
      run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),userId,'OPEN','register_session',id,JSON.stringify({openingFloat})])
      enqueueSync(db,{entityType:'register_session',entityId:id,operation:'open',payload:{id,openingFloat,userId}})
      return query<RegisterSession>(db,'SELECT * FROM register_sessions WHERE id=?',[id])[0]
    }
    throw new Error('لديك وردية مفتوحة بالفعل')
  })
}

export async function closeSession(id:string,closingFloat:number){
  if(!Number.isFinite(closingFloat)||closingFloat<0)throw new Error('النقد الفعلي غير صحيح')
  return withTransaction(db=>{
    const session=query<any>(db,"SELECT id,user_id,opening_float,opened_at FROM register_sessions WHERE id=? AND status='open'",[id])[0]
    if(!session)throw new Error('الوردية غير موجودة أو مغلقة')

    const sales=query<any>(db,`SELECT
      COALESCE(SUM(total),0) totalSales,
      COUNT(*) invoiceCount,
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) cashSales,
      COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) cardSales,
      COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END),0) transferSales,
      COALESCE(SUM(CASE WHEN payment_method='credit' THEN total ELSE 0 END),0) creditSales
      FROM sales WHERE register_session_id=? AND status='completed'`,[id])[0]||{}
    const customerCash=Number(query<any>(db,"SELECT COALESCE(SUM(amount),0) amount FROM customer_payments WHERE register_session_id=? AND method='cash'",[id])[0]?.amount||0)
    const cashRefunds=Number(query<any>(db,"SELECT COALESCE(SUM(sr.total),0) total FROM sale_returns sr JOIN sales s ON s.id=sr.sale_id WHERE s.register_session_id=? AND sr.status='completed' AND COALESCE(sr.refund_method,'cash')='cash'",[id])[0]?.total||0)
    const expenses=Number(query<any>(db,"SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE register_session_id=?",[id])[0]?.amount||0)
    const cashIn=Number(query<any>(db,'SELECT COALESCE(SUM(amount_in),0) amount FROM cash_ledger WHERE register_session_id=?',[id])[0]?.amount||0)
    const cashOut=Number(query<any>(db,'SELECT COALESCE(SUM(amount_out),0) amount FROM cash_ledger WHERE register_session_id=?',[id])[0]?.amount||0)
    const expected=cashExpected(db,id)-expenses
    const difference=Number((closingFloat-expected).toFixed(2))

    run(db,"UPDATE register_sessions SET closing_float=?,expected_cash=?,difference=?,cash_sales=?,card_sales=?,transfer_sales=?,status='closed',closed_at=datetime('now') WHERE id=?",[
      closingFloat,expected,difference,Number(sales.cashSales||0),Number(sales.cardSales||0),Number(sales.transferSales||0),id
    ])
    run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),session.user_id,'CLOSE','register_session',id,JSON.stringify({closingFloat,expected,difference,cashSales:Number(sales.cashSales||0),cardSales:Number(sales.cardSales||0),transferSales:Number(sales.transferSales||0)})])
    enqueueSync(db,{entityType:'register_session',entityId:id,operation:'close',payload:{id,closingFloat,expected,difference,cashSales:Number(sales.cashSales||0),cardSales:Number(sales.cardSales||0),transferSales:Number(sales.transferSales||0)}})

    return {
      id, closingFloat, expected, difference,
      report:{
        invoiceCount:Number(sales.invoiceCount||0),
        cashSales:Number(sales.cashSales||0),
        cardSales:Number(sales.cardSales||0),
        transferSales:Number(sales.transferSales||0),
        creditSales:Number(sales.creditSales||0),
        customerCash,
        cashRefunds,
        openingFloat:Number(session.opening_float||0),
        expectedCash:expected,
        closingFloat,
        difference,
        totalSales:Number(sales.totalSales||0),
        cashIn,
        cashOut,
        expenses,
        openedAt:session.opened_at,
        closedAt:new Date().toISOString(),
      }
    }
  })
}
