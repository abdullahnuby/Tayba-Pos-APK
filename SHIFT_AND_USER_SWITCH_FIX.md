# Shift + User Switching Fix

- Cashier can switch user without closing the active register shift.
- Switching user resets the app section to Dashboard before the next login.
- Admin/manager login is independent from the cashier's open shift.
- Button component now defaults to `type="button"`, preventing accidental form submits/navigation refreshes.
- Local DB initialization now performs a final canonical schema repair pass after migrations, fixing missing-table errors in older/corrupted local databases without running v4 indexes before their columns exist.
- `schema_meta` is ensured before migration lookup.
- Static/business regression suite passes.
