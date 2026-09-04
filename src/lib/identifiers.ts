import type { Database } from 'sql.js'
import { query, run } from './db/client'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function nextSequence(db: Database, type: string, dateKey: string, startAt = 0): number {
  const row = query<{ current_value: number }>(db,
    'SELECT current_value FROM document_sequences WHERE document_type=? AND date_key=?',
    [type, dateKey])[0]
  const next = Math.max(Number(row?.current_value ?? startAt), startAt) + 1
  run(db,
    'INSERT INTO document_sequences(document_type,date_key,current_value) VALUES(?,?,?) ON CONFLICT(document_type,date_key) DO UPDATE SET current_value=excluded.current_value',
    [type, dateKey, next])
  return next
}

/** Readable, store-owned SKU; not a global identifier. */
export function generateSku(db: Database, productIdHint?: string): string {
  const suffix = String(productIdHint ?? '').replace(/[^A-Za-z0-9]/g, '').slice(-2).toUpperCase()
  const serial = nextSequence(db, 'SKU', todayKey(), 0)
  return `TAY-${todayKey()}-${String(serial).padStart(4, '0')}${suffix ? `-${suffix}` : ''}`
}

/**
 * Generates a unique EAN-13-shaped INTERNAL barcode using the restricted-circulation 20 prefix.
 * It is NOT a globally licensed GTIN and must not be represented as a GS1 barcode.
 */
export function generateInternalEan13(db: Database): string {
  const serial = nextSequence(db, 'INTERNAL_BARCODE', 'GLOBAL', 999999999)
  const base12 = `20${String(serial).padStart(10, '0').slice(-10)}`
  let sum = 0
  for (let i = 0; i < base12.length; i++) {
    const digit = Number(base12[i])
    sum += digit * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return `${base12}${check}`
}

export function generateAutoBarcode(db: Database): { barcode: string; type: 'gs1-gtin13' | 'internal-ean13' } {
  const prefixRow = query<{ value: string }>(db, "SELECT value FROM settings WHERE key='gs1CompanyPrefix'")[0]
  const prefix = String(prefixRow?.value || '').replace(/\D/g, '')
  if (prefix.length >= 4 && prefix.length <= 11) {
    const itemDigits = 12 - prefix.length
    const serial = nextSequence(db, 'GTIN', 'GLOBAL', 0)
    const capacity = 10 ** itemDigits
    if (serial < capacity) {
      const base12 = `${prefix}${String(serial).padStart(itemDigits, '0')}`
      let sum = 0
      for (let i = 0; i < base12.length; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3)
      const check = (10 - (sum % 10)) % 10
      return { barcode: `${base12}${check}`, type: 'gs1-gtin13' }
    }
  }
  return { barcode: generateInternalEan13(db), type: 'internal-ean13' }
}

export function isEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3)
  return ((10 - (sum % 10)) % 10) === Number(value[12])
}
