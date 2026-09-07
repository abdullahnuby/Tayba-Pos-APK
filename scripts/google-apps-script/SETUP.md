# Google Apps Script — Tayba POS Sync

1. Create one Google Spreadsheet for the store.
2. Create these sheets with headers matching the local SQLite column names:
   `Sales`, `SaleItems`, `Purchases`, `PurchaseItems`, `SaleReturns`, `SaleReturnItems`, `PurchaseReturns`, `PurchaseReturnItems`, `CustomerPayments`, `SupplierPayments`, `StockMovements`, `RegisterSessions`, `Expenses`, `SyncLog`.
3. Open **Extensions → Apps Script**, paste `Code.gs`.
4. In **Project Settings → Script Properties**, set `TAYBA_SYNC_TOKEN` to a long random secret.
5. Deploy as a Web App. Keep the deployed URL private and store it in the POS settings together with the same token.
6. The POS sends operation UUIDs. `SyncLog` makes retries idempotent: an already processed operation is acknowledged without inserting it again.

The first release intentionally does not treat Google Sheets as the operating database. The tablet SQLite database remains the source used by the POS while online or offline.
