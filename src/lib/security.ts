import { query } from './db/client'
import type { Database } from 'sql.js'

const buckets = new Map<string, { count: number; resetAt: number }>()

export function localRateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, current.resetAt - now) }
  }
  current.count += 1
  return { ok: true, remaining: Math.max(0, limit - current.count), retryAfterMs: 0 }
}

export function verifyFourDigitPin(db: Database, username: string, pinHash: string, pinVerifier: (pin: string, stored: string) => Promise<boolean>) {
  const row = query<any>(db, 'SELECT id,username,name,role,active,pin_hash FROM users WHERE username=? AND active=1', [username.trim()])[0]
  if (!row) return Promise.resolve(null)
  return pinVerifier(pinHash, row.pin_hash || '').then(ok => ok ? row : null)
}
