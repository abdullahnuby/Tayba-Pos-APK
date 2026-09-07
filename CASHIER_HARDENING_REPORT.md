# Tayba POS — Cashier Hardening Report

Date: 2026-09-05

## Fixed

- Cashier invoice history is now restricted to invoices created by the logged-in cashier.
- Cashier draft resume is restricted to the owning cashier.
- Cashier sales cannot be attached to another cashier's open register.
- Quick customer creation now works for cashiers; customer modification/deletion remains manager/admin only.
- Cashier invoice discounts above 5% require manager approval.
- Cart line prices can be edited from the POS and are validated server-side.
- Long cashier carts are scrollable instead of being clipped.
- Register cards now show live cash/card/transfer/credit totals from actual completed sales.
- Closing a register now returns a complete shift report and persists calculated register totals.
- Sale/purchase voids now balance customer/supplier ledgers.
- Idempotency moved from notes-string matching to dedicated database columns with unique indexes (schema v4).
- Customer/supplier/cash-movement idempotency paths now use durable keys.

## Verification

- Static release gate: PASS
- Business invariants: PASS
- Date resilience: PASS
- Identifier check digit: PASS
- Multi-item payment: PASS
- Page data shapes: PASS
- Purchase pack total: PASS
- Purchase shape: PASS
- Cashier contracts: PASS (10/10)
- SQLite schema execution: PASS (28 tables)

## Remaining release blockers

1. Full dependency installation and `npm run build` could not be completed because `npm install` timed out in the execution environment.
2. Android project generation and real-device WebView testing are still required.
3. Live Google Apps Script/Sheets synchronization needs an end-to-end test.
