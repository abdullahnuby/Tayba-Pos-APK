import { getDb, persist, query } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Customer } from '../types'

export async function listCustomers(): Promise<Customer[]> { const db = await getDb(); return query<Customer>(db, 'SELECT id,name,phone,address,notes,balance,loyalty_points FROM customers ORDER BY name') }
export async function createCustomer(name: string, phone?: string): Promise<Customer> {
  const db = await getDb(); const id = uuid(); db.run('INSERT INTO customers (id,name,phone) VALUES (?,?,?)', [id,name.trim(),phone?.trim() || null]); await persist()
  return { id, name: name.trim(), phone: phone?.trim() || null, balance: 0, loyalty_points: 0 }
}
