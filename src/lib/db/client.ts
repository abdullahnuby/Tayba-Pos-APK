import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Database as SqlDatabase, SqlJsStatic } from 'sql.js'
import { get, set } from 'idb-keyval'
import schemaSql from './schema.sql?raw'

export const IDB_KEY = 'tayba-sqlite-db-v3'
const SCHEMA_VERSION = 4

let dbInstance: SqlDatabase | null = null

function closeSqlDatabase(db: SqlDatabase): void {
  const close = (db as SqlDatabase & { close?: () => void }).close
  if (typeof close === 'function') close.call(db)
}

async function createOrLoadDb(SQL: SqlJsStatic): Promise<SqlDatabase> {
  const saved = await get<Uint8Array>(IDB_KEY)
  if (saved) return new SQL.Database(saved)

  const db = new SQL.Database()
  db.run(schemaSql)
  return db
}

export async function getDb(): Promise<SqlDatabase> {
  if (dbInstance) return dbInstance

  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  dbInstance = await createOrLoadDb(SQL)

  const versionRows = query<{ value: string }>(dbInstance, "SELECT value FROM schema_meta WHERE key = 'schema_version'")
  const version = Number(versionRows[0]?.value ?? 0)
  if (version < 2) {
    try { dbInstance.run("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"); } catch {}
    // Offline auth policy: username + 4-digit PIN only. Legacy password fields remain nullable for migration compatibility and are never read for authentication.
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS customer_ledger (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT, entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_date ON customer_ledger(customer_id, created_at);
      CREATE TABLE IF NOT EXISTS supplier_ledger (id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT, entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_date ON supplier_ledger(supplier_id, created_at);
      CREATE TABLE IF NOT EXISTS cash_ledger (id TEXT PRIMARY KEY, register_session_id TEXT REFERENCES register_sessions(id) ON DELETE SET NULL, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT, amount_in REAL NOT NULL DEFAULT 0, amount_out REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_cash_ledger_session_date ON cash_ledger(register_session_id, created_at);
      INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','2');
    `)
  }

  if (version < 3) {
    try { dbInstance.run("ALTER TABLE sync_queue ADD COLUMN next_attempt_at TEXT") } catch {}
    dbInstance.run("UPDATE sync_queue SET next_attempt_at=created_at WHERE next_attempt_at IS NULL")
    dbInstance.run("INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','3')")
  }

  const addColumn = (table: string, column: string, definition: string) => {
    try { dbInstance!.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`) } catch {}
  }

  if (version < 4) {
    addColumn('sales', 'idempotency_key', 'TEXT')
    addColumn('purchases', 'idempotency_key', 'TEXT')
    addColumn('sale_returns', 'idempotency_key', 'TEXT')
    addColumn('purchase_returns', 'idempotency_key', 'TEXT')
    addColumn('customer_payments', 'idempotency_key', 'TEXT')
    addColumn('supplier_payments', 'idempotency_key', 'TEXT')
    addColumn('cash_ledger', 'idempotency_key', 'TEXT')
    dbInstance.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_idempotency ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_idempotency ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_returns_idempotency ON sale_returns(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_returns_idempotency ON purchase_returns(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_payments_idempotency ON customer_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_payments_idempotency ON supplier_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_idempotency ON cash_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
    `)
  }

  // Canonical repair pass for databases created by older builds. Some legacy
  // databases have the table but are missing columns introduced later.
  // In particular, shift closing reads customer_payments.register_session_id
  // and expenses.register_session_id. Repair them without deleting any data.
  addColumn('customer_payments', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('expenses', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('cash_ledger', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('sales', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('purchases', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  dbInstance.run(`
    CREATE INDEX IF NOT EXISTS idx_customer_payments_session ON customer_payments(register_session_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_session ON expenses(register_session_id, date);
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_session_date ON cash_ledger(register_session_id, created_at);
    INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','4');
  `)

  await persist()
  return dbInstance
}


export async function replaceDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const replacement = new SQL.Database(bytes)
  const required = [
    'schema_meta', 'users', 'products', 'product_variants', 'sales', 'sale_items',
    'purchases', 'purchase_items', 'customers', 'suppliers', 'sync_queue',
  ]
  const missing = required.filter((table) => query<{ n: number }>(replacement,
    `SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name=?`, [table])[0]?.n !== 1)
  if (missing.length) {
    closeSqlDatabase(replacement)
    throw new Error(`النسخة الاحتياطية غير صالحة أو قديمة: ${missing.join(', ')}`)
  }
  closeSqlDatabase(replacement)
  await set(IDB_KEY, bytes)
  if (dbInstance) closeSqlDatabase(dbInstance)
  dbInstance = null
}

export async function exportDatabaseBytes(): Promise<Uint8Array> {
  const db = await getDb()
  return db.export()
}

export async function persist(): Promise<void> {
  if (!dbInstance) return
  await set(IDB_KEY, dbInstance.export())
}

export async function withTransaction<T>(fn: (db: SqlDatabase) => T | Promise<T>): Promise<T> {
  const db = await getDb()
  db.run('BEGIN IMMEDIATE TRANSACTION')
  try {
    const result = await fn(db)
    db.run('COMMIT')
    await persist()
    return result
  } catch (err) {
    try { db.run('ROLLBACK') } catch { /* preserve original failure */ }
    throw err
  }
}

export function query<T = Record<string, unknown>>(db: SqlDatabase, sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params as never)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    return rows
  } finally {
    stmt.free()
  }
}

export function run(db: SqlDatabase, sql: string, params: unknown[] = []): void {
  db.run(sql, params as never)
}
