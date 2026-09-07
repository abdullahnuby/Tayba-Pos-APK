# Refactor Changelog

## 2026-09-06

### Security and authorization
- Added role enforcement to the canonical `DELETE /api/products/:id` route.
- Removed the unreachable legacy product route to eliminate conflicting behavior.
- Settings API no longer returns the raw `appsScriptToken`; it returns presence and a masked value.
- Unified the user-facing Google Apps Script token name to `TAYBA_SYNC_TOKEN`.
- Removed the hardcoded release-keystore password from GitHub Actions and replaced it with repository secrets.

### Accounting
- Purchase void now refunds only the cash-paid portion into the cash drawer.
- Card/transfer purchase payments are no longer incorrectly treated as cash refunds.

### Sync
- Consolidated automatic sync ownership into `src/lib/sync/engine.ts`.
- Added a single guarded timer to prevent duplicate auto-sync loops.

### Database and performance
- Raised schema migration version to 5.
- Added indexes for barcode, SKU, register/date reporting, and sync retry lookup.
