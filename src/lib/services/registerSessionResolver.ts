import type { Database } from 'sql.js'
import { query } from '../db/client'

export function resolveTargetSession(
  db: Database,
  referenceSessionId: string | null | undefined,
): { id: string } | null {
  if (referenceSessionId) {
    const original=query<{id:string}>(
      db,
      "SELECT id FROM register_sessions WHERE id=? AND status='open'",
      [referenceSessionId],
    )[0]
    if (original) return original
  }

  return query<{id:string}>(
    db,
    "SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1",
  )[0] ?? null
}
