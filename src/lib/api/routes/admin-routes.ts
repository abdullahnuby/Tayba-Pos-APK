// Audit log, store settings, and user management (admin-only routes).
import { v4 as uuid } from 'uuid'
import { getDb, query, run, withTransaction } from '../../db/client'
import { jsonResponse, body, hashPin, randSalt, type RouteCtx } from '../shared'

export async function handleAdminRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { req, u, p, method, user } = ctx
  if(p==='/audit-logs'&&method==='GET'){ if(user!.role!=='admin')return jsonResponse({error:'صلاحية غير كافية'},403); const db=await getDb(); return jsonResponse({items:query<any>(db,'SELECT a.*,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200').map((x:any)=>({...x,createdAt:x.created_at,after_json:x.after_json,before_json:x.before_json}))}) }
  if((p==='/settings'||p==='/store-settings')&&method==='GET'){
    if(!['admin','manager'].includes(user!.role))
      return jsonResponse({error:'صلاحية غير كافية'},403)
    const db=await getDb()
    const rows=query<any>(db,'SELECT key,value FROM settings')
    const result:Record<string,string>={}
    let token=''
    for(const row of rows){
      if(row.key==='appsScriptToken'){
        token=String(row.value||'')
        continue
      }
      result[row.key]=String(row.value??'')
    }
    result.appsScriptTokenSet=token.length>0?'true':'false'
    result.appsScriptTokenMasked=token
      ? `${token.slice(0,4)}••••${token.slice(-4)}`
      : ''
    return jsonResponse(result)
  }
  if((p==='/settings'||p==='/store-settings')&&method==='POST'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية'},403);const b=await body(req);const values=b.settings||b;const db=await getDb();await withTransaction(db=>{for(const [k,v] of Object.entries(values)) run(db,'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[k,String(v)])});return jsonResponse({ok:true})}
  if((p==='/users'||/^\/users\//.test(p))&&!['admin'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية'},403)
  if(p==='/users'&&method==='GET'){const db=await getDb();return jsonResponse(query<any>(db,'SELECT id,username,name,role,active,CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END hasPin FROM users ORDER BY created_at').map((x:any)=>({...x,hasPin:!!x.hasPin})))}
  if(p==='/users'&&method==='POST'){const b=await body(req);const db=await getDb();const username=String(b.username||'').trim();const name=String(b.name||'').trim();const pin=String(b.pin||'');if(!username||!name||!/^\d{4}$/.test(pin))return jsonResponse({error:'اسم المستخدم والاسم وPIN من 4 أرقام مطلوبة'},400);if(!['admin','manager','cashier'].includes(b.role||'cashier'))return jsonResponse({error:'صلاحية غير صحيحة'},400);if(query<any>(db,'SELECT 1 FROM users WHERE username=?',[username]).length)return jsonResponse({error:'اسم المستخدم مأخوذ'},400);const id=uuid();const pinHash=await hashPin(pin,randSalt());run(db,'INSERT INTO users(id,username,password_hash,pin_hash,name,role,active) VALUES(?,?,?,?,?,?,1)',[id,username,null,pinHash,name,b.role||'cashier']);await (await import('../../db/client')).persist();return jsonResponse({id,username,name,role:b.role||'cashier',active:true},201)}
  const um=p.match(/^\/users\/([^/]+)$/);if(um){const id=um[1];const db=await getDb();if(method==='PATCH'){const b=await body(req); if(id===user!.id&&b.active===false)return jsonResponse({error:'لا يمكنك تعطيل حسابك الخاص'},400); if(id===user!.id&&b.role&&b.role!=='admin')return jsonResponse({error:'لا يمكنك تغيير صلاحيتك الخاصة'},400); const fields=[]; const vals=[]; if(typeof b.name==='string'&&b.name.trim()){fields.push('name=?');vals.push(b.name.trim())}; if(typeof b.role==='string'){if(!['admin','manager','cashier'].includes(b.role))return jsonResponse({error:'صلاحية غير صحيحة'},400);fields.push('role=?');vals.push(b.role)}; if(typeof b.active==='boolean'){fields.push('active=?');vals.push(b.active?1:0)}; if(typeof b.pin==='string'&&b.pin){if(!/^\d{4}$/.test(b.pin))return jsonResponse({error:'PIN يجب أن يكون من 4 أرقام بالضبط'},400);fields.push('pin_hash=?');vals.push(await hashPin(b.pin,randSalt()))}; if(!fields.length)return jsonResponse({error:'لا يوجد تعديل'},400); vals.push(id); run(db,`UPDATE users SET ${fields.join(',')},updated_at=datetime('now') WHERE id=?`,vals);await (await import('../../db/client')).persist();return jsonResponse({ok:true})}if(method==='DELETE'){if(id===user!.id)return jsonResponse({error:'لا يمكن حذف المستخدم الحالي'},400);run(db,'UPDATE users SET active=0 WHERE id=?',[id]);await (await import('../../db/client')).persist();return jsonResponse({ok:true})}}

  return null
}
