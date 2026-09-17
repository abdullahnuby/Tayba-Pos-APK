// V1 is SQLite-only. The old Google synchronization queue is intentionally
// disabled so normal sales/purchases never accumulate cloud-sync work.
import { getDb, query } from '../db/client'
import type { Database } from 'sql.js'

export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed'
export interface SyncQueueItem { id:string; entity_type:string; entity_id:string; operation:string; payload:string; created_at:string; synced_at:string|null; retry_count:number; status:SyncStatus; last_error:string|null }

export function enqueueSync(_db: Database, _input:{entityType:string; entityId:string; operation:string; payload:unknown}): string {
  return ''
}

export async function getPendingSyncItems(_limit=25):Promise<SyncQueueItem[]> { return [] }
export async function getSyncStats(){
  // Kept for compatibility with older diagnostics/routes.
  await getDb()
  return { pending:0, processing:0, synced:0, failed:0 }
}
export async function markSyncProcessing(_ids:string[]){ return }
export async function markSyncSucceeded(_ids:string[]){ return }
export async function markSyncFailed(_ids:string[],_message:string){ return }
export async function resetStaleProcessing(_maxAgeMinutes=10){ return }
