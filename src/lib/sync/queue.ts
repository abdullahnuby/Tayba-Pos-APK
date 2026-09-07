import { getDb, query, run, withTransaction } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'

export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed'
export interface SyncQueueItem { id:string; entity_type:string; entity_id:string; operation:string; payload:string; created_at:string; synced_at:string|null; retry_count:number; status:SyncStatus; last_error:string|null }

export function enqueueSync(db: Database, input:{entityType:string; entityId:string; operation:string; payload:unknown}): string {
  const existing=query<{id:string}>(db,`SELECT id FROM sync_queue WHERE entity_type=? AND entity_id=? AND operation=? AND status IN ('pending','processing') LIMIT 1`,[input.entityType,input.entityId,input.operation])[0]
  if(existing) return existing.id
  const id=uuid()
  run(db,`INSERT INTO sync_queue(id,entity_type,entity_id,operation,payload,status) VALUES(?,?,?,?,?,'pending')`,[id,input.entityType,input.entityId,input.operation,JSON.stringify(input.payload)])
  return id
}

export async function getPendingSyncItems(limit=25):Promise<SyncQueueItem[]> {
  const db=await getDb()
  return query<SyncQueueItem>(db,`SELECT * FROM sync_queue WHERE status IN ('pending','failed') AND (next_attempt_at IS NULL OR datetime(next_attempt_at)<=datetime('now')) ORDER BY created_at ASC LIMIT ?`,[Math.max(1,Math.min(100,limit))])
}

export async function getSyncStats(){
  const db=await getDb()
  return query<{status:string;count:number}>(db,`SELECT status, COUNT(*) count FROM sync_queue GROUP BY status`).reduce<Record<string,number>>((a,r)=>(a[r.status]=Number(r.count),a),{})
}

export async function markSyncProcessing(ids:string[]){ if(!ids.length)return; await withTransaction(db=>ids.forEach(id=>run(db,`UPDATE sync_queue SET status='processing' WHERE id=? AND status IN ('pending','failed')`,[id]))) }
export async function markSyncSucceeded(ids:string[]){ if(!ids.length)return; await withTransaction(db=>ids.forEach(id=>run(db,`UPDATE sync_queue SET status='synced',synced_at=datetime('now'),last_error=NULL WHERE id=?`,[id]))) }
export async function markSyncFailed(ids:string[],message:string){ if(!ids.length)return; await withTransaction(db=>ids.forEach(id=>run(db,`UPDATE sync_queue SET status='failed',retry_count=retry_count+1,last_error=?,next_attempt_at=datetime('now','+'||CASE MIN(retry_count+1,5) WHEN 1 THEN 30 WHEN 2 THEN 60 WHEN 3 THEN 120 WHEN 4 THEN 240 ELSE 360 END||' minutes') WHERE id=?`,[message.slice(0,500),id]))) }
export async function resetStaleProcessing(maxAgeMinutes=10){
  const db=await getDb(); run(db,`UPDATE sync_queue SET status='failed',retry_count=retry_count+1,last_error='إعادة المحاولة بعد تعطل المزامنة',next_attempt_at=datetime('now','+30 minutes') WHERE status='processing' AND datetime(created_at,'+'||?||' minutes')<datetime('now')`,[Math.max(1,maxAgeMinutes)])
}
