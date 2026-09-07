# Tayba POS Offline — Reference Parity UI

This build is a new standalone project derived from the `abdullahnuby/tayba-pos` reference repository, without modifying the reference repository.

## Reference coverage

The interface mirrors the reference navigation and major workflows:

- Dashboard
- Point of Sale
- Register / shift and cash drawer
- Products and inventory
- Purchases
- Stock adjustments / stocktaking
- Sales returns and purchase returns
- Suppliers
- Customers and collections
- Reports
- Sync status
- Audit log
- Users and roles
- Store settings

## Runtime difference

The UI and business concepts follow the reference system, while runtime is local/offline:

SQLite (sql.js) → Local repositories/services → Sync Queue → Google Apps Script → Google Sheets

Google Sheets is not used as the runtime database for cashier operations.

## Notable POS parity features

- Barcode/SKU-first input
- Product categories
- Variant picker (size / color)
- Pack pricing: piece / quarter dozen / half dozen / dozen when configured
- Customer selection and quick customer creation
- Cash / card / transfer / credit payment modes
- Discount and change calculation
- Hold/resume invoice
- Historical sales date for management roles
- Invoice history and line-item preview
- Receipt sharing/copy and browser print
- Shift-open requirement

## Known verification limitation

The execution environment used for this handoff did not have npm packages installed and could not resolve the external npm registry. The source was therefore checked structurally and with delimiter/syntax sanity checks, but a full `npm run build` was not claimed as completed here.
