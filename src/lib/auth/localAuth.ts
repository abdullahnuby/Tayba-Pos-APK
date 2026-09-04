import { getDb, persist, query } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { User } from '../types'

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2,'0')).join('')
}
function randomSalt() { return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2,'0')).join('') }

export async function createUser(input: { username: string; pin: string; name: string; role: User['role'] }): Promise<User> {
  if (!input.username.trim()) throw new Error('اسم المستخدم مطلوب')
  if (!/^\d{4,6}$/.test(input.pin)) throw new Error('الرقم السري يجب أن يكون من 4 إلى 6 أرقام')
  const db = await getDb(); const salt = randomSalt(); const hash = await hashPin(input.pin,salt); const id = uuid()
  db.run('INSERT INTO users(id,username,pin_hash,name,role,active) VALUES(?,?,?,?,?,1)', [id,input.username.trim(),`${salt}:${hash}`,input.name.trim(),input.role])
  await persist(); return { id, username: input.username.trim(), name: input.name.trim(), role: input.role, active: true }
}

export async function loginWithPin(username: string, pin: string): Promise<User | null> {
  if (!username.trim() || !/^\d{4}$/.test(pin)) return null
  const db = await getDb(); const row = query<{id:string;username:string;pin_hash:string;name:string;role:User['role'];active:number}>(db, 'SELECT * FROM users WHERE username=? AND active=1', [username.trim()])[0]
  if (!row) return null
  const [salt, stored] = row.pin_hash.split(':'); const attempt = await hashPin(pin,salt)
  if (attempt !== stored) return null
  return { id:row.id, username:row.username, name:row.name, role:row.role, active:!!row.active }
}
export async function hasAnyUser(): Promise<boolean> { const db = await getDb(); return (query<{c:number}>(db,'SELECT COUNT(*) c FROM users')[0]?.c ?? 0) > 0 }
