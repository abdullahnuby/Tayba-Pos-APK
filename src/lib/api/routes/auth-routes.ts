// Pre-login routes: root ping, first-run setup, PIN verification, login/logout.
// Runs BEFORE the requireRole gate in the dispatcher, so `user` may be null here.
import { v4 as uuid } from 'uuid'
import { getDb, query, withTransaction, run } from '../../db/client'
import { loginWithPin } from '../../auth/localAuth'
import { jsonResponse, body, hashPin, verifyPin, randSalt, SESSION_KEY, type RouteCtx } from '../shared'

export async function handleAuthRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { req, p, method, user } = ctx
  if(p==='/' && method==='GET') return jsonResponse({ok:true,runtime:'offline',storage:'sqlite+indexeddb',apiMode:'local-compatibility',features:{offlineAuth:true,barcode:true,reports:true,backup:true,restore:true}})
  if(p==='/auth/setup' && method==='GET'){const db=await getDb(); return jsonResponse({ok:true,needsSetup:(query<any>(db,'SELECT COUNT(*) c FROM users')[0]?.c||0)===0})}
  if(p==='/auth/setup' && method==='POST'){const b=await body(req);const db=await getDb();if((query<any>(db,'SELECT COUNT(*) c FROM users')[0]?.c||0)>0)return jsonResponse({ok:false,error:'النظام مُهيأ بالفعل'},400);const username=String(b.username||'').trim();const pin=String(b.pin||'');const name=String(b.name||'').trim();const storeName=String(b.storeName||'').trim();if(!username||!name||!storeName||!/^\d{4}$/.test(pin))return jsonResponse({error:'اسم المستخدم والاسم وPIN من 4 أرقام واسم المحل مطلوبة'},400);if(query<any>(db,'SELECT 1 FROM users WHERE username=?',[username]).length)return jsonResponse({error:'اسم المستخدم مأخوذ'},400);const id=uuid();const pinHash=await hashPin(pin,randSalt());await withTransaction(db=>{run(db,'INSERT INTO users(id,username,password_hash,pin_hash,name,role,active) VALUES(?,?,?,?,?,?,1)',[id,username,null,pinHash,name,'admin']);for(const [k,v] of Object.entries({storeName,storeAddress:b.storeAddress||'',storePhone:b.storePhone||'',vatEnabled:String(!!b.vatEnabled),vatRate:String(b.vatRate??14),currency:'EGP',autoSyncEnabled:'true',receiptFooter:'شكراً لزيارتكم'}))run(db,'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[k,String(v)]);});localStorage.setItem(SESSION_KEY,id);return jsonResponse({ok:true,user:{id,username,name,role:'admin',active:true}},201)}
  if(p==='/auth/verify-pin' && method==='POST'){const b=await body(req); const pin=String(b.pin||''); if(!/^\d{4}$/.test(pin))return jsonResponse({ok:false,error:'PIN يجب أن يكون 4 أرقام بالضبط'},400); const db=await getDb(); const row=query<any>(db,'SELECT id,username,name,role,active,pin_hash FROM users WHERE username=? AND active=1',[String(b.username||'').trim()])[0]; if(!row || !(await verifyPin(pin,row.pin_hash||''))) return jsonResponse({ok:false,authorized:false,error:'PIN غير صحيح'},401); if(b.requiredRole && !['admin','manager'].includes(row.role)) return jsonResponse({ok:false,authorized:false,error:'يجب استخدام PIN مدير أو مدير عام'},403); return jsonResponse({ok:true,authorized:true,user:{id:row.id,username:row.username,name:row.name,role:row.role}})}
  if(p==='/auth/login' && method==='POST'){
    const b=await body(req)
    const pin=String(b.pin||'')
    if(!/^\d{4}$/.test(pin))return jsonResponse({error:'PIN يجب أن يكون 4 أرقام بالضبط'},400)
    try {
      const urow=await loginWithPin(String(b.username||''),pin)
      if(!urow)return jsonResponse({error:'اسم المستخدم أو PIN غير صحيح'},401)
      localStorage.setItem(SESSION_KEY,urow.id)
      return jsonResponse(urow)
    } catch(e) {
      const message=e instanceof Error?e.message:String(e)
      if(message.includes('محاولات كثيرة'))return jsonResponse({error:message,retryAfterMs:60_000},429)
      throw e
    }
  }
  if(p==='/auth/me' && method==='GET') return jsonResponse({user})
  if(p==='/auth/logout' && method==='POST'){localStorage.removeItem(SESSION_KEY); return jsonResponse({ok:true})}
  return null
}
