import { getDb, query } from '../db/client'
import type { User } from '../types'
import { localRateLimit } from '../security'

export async function loginWithPin(username:string,pin:string):Promise<User|null>{
  const normalizedUsername=username.trim().toLowerCase()
  const rate=localRateLimit(`login:${normalizedUsername}`,5,60_000)
  if(!rate.ok) throw new Error('محاولات كثيرة، حاول بعد قليل')
  if(!normalizedUsername||!/^\d{4}$/.test(pin)) return null

  const db=await getDb()
  const row=query<{
    id:string
    username:string
    pin_hash:string
    name:string
    role:User['role']
    active:number
  }>(
    db,
    'SELECT id,username,pin_hash,name,role,active FROM users WHERE lower(username)=? AND active=1',
    [normalizedUsername],
  )[0]

  if(!row) return null
  const [salt,stored]=String(row.pin_hash||'').split(':')
  if(!salt||!stored) return null

  const digest=await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${pin}`),
  )
  const attempt=Array.from(new Uint8Array(digest))
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('')

  if(attempt!==stored) return null

  return {
    id:row.id,
    username:row.username,
    name:row.name,
    role:row.role,
    active:!!row.active,
  }
}
