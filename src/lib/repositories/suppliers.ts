import { getDb, persist, query } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Supplier } from '../types'

export async function listSuppliers(): Promise<Supplier[]> { const db = await getDb(); return query<Supplier>(db, 'SELECT id,name,phone,address,notes,balance FROM suppliers ORDER BY name') }
export async function createSupplier(name: string, phone?: string): Promise<Supplier> {
  const db = await getDb(); const id = uuid(); db.run('INSERT INTO suppliers (id,name,phone) VALUES (?,?,?)', [id,name.trim(),phone?.trim() || null]); await persist()
  return { id, name: name.trim(), phone: phone?.trim() || null, balance: 0 }
}
