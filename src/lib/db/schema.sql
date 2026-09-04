PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT, -- deprecated legacy field; authentication uses PIN only
  pin_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','manager','cashier')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  gender TEXT,
  season TEXT,
  material TEXT,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  size TEXT,
  color TEXT,
  material TEXT,
  cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price REAL NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 5,
  reorder_qty INTEGER NOT NULL DEFAULT 10,
  base_unit TEXT NOT NULL DEFAULT 'piece',
  purchase_unit TEXT NOT NULL DEFAULT 'piece',
  purchase_unit_factor INTEGER NOT NULL DEFAULT 1 CHECK (purchase_unit_factor > 0),
  sale_unit TEXT NOT NULL DEFAULT 'piece',
  sale_unit_factor INTEGER NOT NULL DEFAULT 1 CHECK (sale_unit_factor > 0),
  quarter_dozen_price REAL,
  half_dozen_price REAL,
  dozen_price REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_stock ON product_variants(quantity, min_quantity);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  balance REAL NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);

CREATE TABLE IF NOT EXISTS register_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  opening_float REAL NOT NULL DEFAULT 0,
  closing_float REAL,
  expected_cash REAL,
  difference REAL,
  cash_sales REAL NOT NULL DEFAULT 0,
  card_sales REAL NOT NULL DEFAULT 0,
  transfer_sales REAL NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);
CREATE INDEX IF NOT EXISTS idx_register_user_status ON register_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_register_status_opened ON register_sessions(status, opened_at);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  register_session_id TEXT REFERENCES register_sessions(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  change REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','transfer','credit')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided','draft')),
  void_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(date, status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_date ON sales(payment_method, date);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_date ON purchases(supplier_id, date);
CREATE INDEX IF NOT EXISTS idx_purchases_date_status ON purchases(date, status);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL,
  total REAL NOT NULL,
  entered_quantity REAL,
  unit TEXT,
  unit_factor INTEGER
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_variant ON purchase_items(variant_id);

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  refund_method TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_date ON sale_returns(date, status);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY,
  sale_return_id TEXT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  total REAL NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id TEXT PRIMARY KEY,
  purchase_return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
  sale_return_id TEXT REFERENCES sale_returns(id) ON DELETE SET NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date ON customer_payments(customer_id, date);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT,
  debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_date ON customer_ledger(customer_id, created_at);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  purchase_return_id TEXT REFERENCES purchase_returns(id) ON DELETE SET NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_date ON supplier_payments(supplier_id, date);

CREATE TABLE IF NOT EXISTS supplier_ledger (
  id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT,
  debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_date ON supplier_ledger(supplier_id, created_at);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('SALE','PURCHASE','SALE_RETURN','PURCHASE_RETURN','ADJUSTMENT','OPENING_STOCK')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_date ON stock_movements(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  note TEXT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  register_session_id TEXT REFERENCES register_sessions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE TABLE IF NOT EXISTS cash_ledger (
  id TEXT PRIMARY KEY, register_session_id TEXT REFERENCES register_sessions(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL, entry_type TEXT NOT NULL, reference_type TEXT, reference_id TEXT,
  amount_in REAL NOT NULL DEFAULT 0, amount_out REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_session_date ON cash_ledger(register_session_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_sequences (
  document_type TEXT NOT NULL,
  date_key TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (document_type, date_key)
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','synced','failed')),
  last_error TEXT,
  next_attempt_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created ON sync_queue(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_entity_operation ON sync_queue(entity_type, entity_id, operation, status);

INSERT OR IGNORE INTO schema_meta(key, value) VALUES ('schema_version', '3');
