import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Database as SqlDatabase, SqlJsStatic } from 'sql.js'
import { get, set } from 'idb-keyval'
import schemaSql from './schema.sql?raw'

export const IDB_KEY = 'tayba-sqlite-db-v3'
const DB_ENCRYPTION_KEY_IDB = `${IDB_KEY}:aes-key`
const SCHEMA_VERSION = 9

let dbInstance: SqlDatabase | null = null

function closeSqlDatabase(db: SqlDatabase): void {
  const close = (db as SqlDatabase & { close?: () => void }).close
  if (typeof close === 'function') close.call(db)
}

type EncryptedDatabaseBlob = {
  version: 1
  iv: Uint8Array
  data: Uint8Array
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const existing = await get<CryptoKey>(DB_ENCRYPTION_KEY_IDB)
  if (existing) return existing
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  ) as CryptoKey
  await set(DB_ENCRYPTION_KEY_IDB, key)
  return key
}

function isEncryptedBlob(value: unknown): value is EncryptedDatabaseBlob {
  return !!value &&
    typeof value === 'object' &&
    'version' in value &&
    (value as EncryptedDatabaseBlob).version === 1 &&
    'iv' in value &&
    'data' in value
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function decryptStoredDatabase(value: EncryptedDatabaseBlob): Promise<Uint8Array> {
  const key = await getEncryptionKey()
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(value.iv) },
    key,
    asArrayBuffer(value.data),
  )
  return new Uint8Array(plain)
}

async function encryptDatabase(bytes: Uint8Array): Promise<EncryptedDatabaseBlob> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(bytes),
  )
  return { version: 1, iv, data: new Uint8Array(encrypted) }
}

async function createOrLoadDb(SQL: SqlJsStatic): Promise<SqlDatabase> {
  const saved = await get<Uint8Array | EncryptedDatabaseBlob>(IDB_KEY)
  if (saved) {
    const bytes = isEncryptedBlob(saved) ? await decryptStoredDatabase(saved) : saved
    const db = new SQL.Database(bytes)
    // PRAGMA settings are per-connection in SQLite, not stored in the file.
    // schema.sql sets `PRAGMA foreign_keys = ON` but that only ever ran on
    // the very first launch when the database was created fresh — every
    // time the app reopens and loads the saved bytes here (i.e. every
    // launch after the first), foreign key enforcement was silently OFF
    // for the rest of that session. Re-issuing it on every load closes
    // that gap for good.
    db.run('PRAGMA foreign_keys = ON')
    return db
  }

  const db = new SQL.Database()
  db.run(schemaSql)
  db.run('PRAGMA foreign_keys = ON')
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

  if (version < 6) {
    addColumn('sales', 'created_role', 'TEXT')
    addColumn('sales', 'manager_approved', 'INTEGER NOT NULL DEFAULT 0')
    dbInstance.run(`
      CREATE INDEX IF NOT EXISTS idx_sales_created_role
        ON sales(created_role, manager_approved, status);
      INSERT OR REPLACE INTO schema_meta(key,value)
        VALUES ('schema_version','6');
    `)
  }

  if (version < 7) {
    addColumn('sale_returns', 'manager_approved', 'INTEGER NOT NULL DEFAULT 0')
    dbInstance.run(`
      CREATE INDEX IF NOT EXISTS idx_sale_returns_manager_approved
        ON sale_returns(manager_approved, status);
      INSERT OR REPLACE INTO schema_meta(key,value)
        VALUES ('schema_version','7');
    `)
  }

  if (version < 8) {
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        frequency TEXT NOT NULL DEFAULT 'monthly',
        day_of_month INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL DEFAULT (date('now')),
        end_date TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        last_generated_period TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(active);
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        period_month TEXT NOT NULL,
        category TEXT NOT NULL,
        planned_amount REAL NOT NULL CHECK (planned_amount >= 0),
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(period_month, category)
      );
      CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_month);
    `)
    addColumn('expenses', 'expense_type', "TEXT NOT NULL DEFAULT 'operating'")
    addColumn('expenses', 'recurring_expense_id', 'TEXT REFERENCES recurring_expenses(id) ON DELETE SET NULL')
    addColumn('expenses', 'period_month', 'TEXT')
    dbInstance.run(`
      CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category, date);
      CREATE INDEX IF NOT EXISTS idx_expenses_period ON expenses(period_month);
      INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','8');
    `)
  }

  if (version < 9) {
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS owner_transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('contribution','withdrawal')),
        amount REAL NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL DEFAULT (date('now')),
        note TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_owner_transactions_date ON owner_transactions(date);
      INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','9');
    `)
  }

  // Canonical repair pass for databases created by older builds. Some legacy
  // databases have the table but are missing columns introduced later.
  // In particular, shift closing reads customer_payments.register_session_id
  // and expenses.register_session_id. Repair them without deleting any data.
  // Columns required by shift accounting. Keep this repair idempotent so an
  // already-migrated database is untouched while old databases are upgraded.
  addColumn('customer_payments', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('expenses', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('cash_ledger', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('sales', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('purchases', 'register_session_id', 'TEXT REFERENCES register_sessions(id) ON DELETE SET NULL')
  addColumn('register_sessions', 'cash_sales', 'REAL NOT NULL DEFAULT 0')
  addColumn('register_sessions', 'card_sales', 'REAL NOT NULL DEFAULT 0')
  addColumn('register_sessions', 'transfer_sales', 'REAL NOT NULL DEFAULT 0')
  addColumn('register_sessions', 'expected_cash', 'REAL')
  addColumn('register_sessions', 'difference', 'REAL')
  addColumn('register_sessions', 'closing_float', 'REAL')
  addColumn('register_sessions', 'closed_at', 'TEXT')
  dbInstance.run(`
    CREATE INDEX IF NOT EXISTS idx_customer_payments_session ON customer_payments(register_session_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_session ON expenses(register_session_id, date);
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_session_date ON cash_ledger(register_session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
    CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
    CREATE INDEX IF NOT EXISTS idx_sales_register_status_date ON sales(register_session_id, status, date);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry ON sync_queue(status, next_attempt_at);
    INSERT OR REPLACE INTO schema_meta(key,value) VALUES ('schema_version','9');
  `)

  await persist()
  return dbInstance
}


export async function replaceDatabaseBytes(bytes: Uint8Array): Promise<void> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 100) {
    throw new Error('ملف النسخة الاحتياطية فارغ أو غير صالح')
  }

  const headerBytes = bytes.subarray(0, 16)
  const header = new TextDecoder().decode(headerBytes)
  if (header !== 'SQLite format 3\u0000') {
    throw new Error('الملف المحدد ليس قاعدة SQLite صالحة')
  }

  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  let replacement: SqlDatabase | null = null

  try {
    replacement = new SQL.Database(bytes)

    const integrity = query<{ integrity_check: string }>(
      replacement,
      'PRAGMA integrity_check',
    )[0]?.integrity_check

    if (integrity !== 'ok') {
      throw new Error('فشل فحص سلامة النسخة الاحتياطية: قاعدة البيانات تالفة')
    }

    const required = [
      'schema_meta', 'users', 'products', 'product_variants', 'sales', 'sale_items',
      'purchases', 'purchase_items', 'customers', 'suppliers', 'sync_queue',
    ]

    const missing = required.filter((table) =>
      query<{ n: number }>(
        replacement!,
        `SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name=?`,
        [table],
      )[0]?.n !== 1,
    )

    if (missing.length) {
      throw new Error(
        `النسخة الاحتياطية غير متوافقة مع هذا الإصدار. الجداول المفقودة: ${missing.join(', ')}`,
      )
    }

    const versionRow = query<{ value: string }>(
      replacement,
      "SELECT value FROM schema_meta WHERE key='schema_version'",
    )[0]

    const version = Number(versionRow?.value ?? 0)
    if (!Number.isFinite(version) || version < 1) {
      throw new Error('النسخة الاحتياطية لا تحتوي على إصدار قاعدة بيانات معروف')
    }

    // Persist the validated database as a clean SQLite export so restore never
    // stores a partially-read or malformed input buffer.
    const normalized = replacement.export()
    await set(IDB_KEY, await encryptDatabase(normalized))

    if (dbInstance) closeSqlDatabase(dbInstance)
    dbInstance = null
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('تعذر استيراد النسخة الاحتياطية')
  } finally {
    if (replacement) closeSqlDatabase(replacement)
  }
}

export async function exportDatabaseBytes(): Promise<Uint8Array> {
  const db = await getDb()
  return db.export()
}

export async function persist(): Promise<void> {
  if (!dbInstance) return
  await set(IDB_KEY, await encryptDatabase(dbInstance.export()))
}

// sql.js is a single in-memory SQLite connection — it has no real
// multi-transaction support of its own. Two `withTransaction` calls fired
// close together (a double-tap on "complete sale", two quick requests
// racing) can each get past their own `await getDb()` before either one
// reaches `BEGIN IMMEDIATE`, so the second call's BEGIN lands while the
// first transaction is still open. SQLite then throws "cannot start a
// transaction within a transaction" — which looked, from the outside, like
// a false "insufficient stock" rejection of a perfectly valid sale. This
// queue forces every transaction to fully commit or roll back before the
// next one is allowed to start, so concurrent requests queue up safely
// instead of colliding.
let transactionQueue: Promise<unknown> = Promise.resolve()

export function withTransaction<T>(fn: (db: SqlDatabase) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
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
  const scheduled = transactionQueue.then(run, run)
  // Keep the queue alive even if this transaction fails — a rejected
  // promise must not poison every transaction queued after it.
  transactionQueue = scheduled.catch(() => {})
  return scheduled
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
