# Reference parity business layer

The new app keeps the reference API shapes at the `window.fetch('/api/...')` boundary while executing locally.

Business rules implemented in this phase:
- cashier price band 95%-110% with manager override flag
- pack-price exception
- MWA purchase cost
- historical sale-item COGS
- proportional sale discounts in profit helper
- customer/supplier ledger entries
- cash ledger entries linked to register sessions
- partial cash becomes customer receivable when a customer is selected
- cash/card/transfer/credit settlement rules at service boundary
- stock never becomes negative
- sale/purchase void and sale resume paths record stock/accounting/audit/sync changes
