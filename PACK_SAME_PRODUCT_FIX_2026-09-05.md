# Fix — Same Product Sold as Different Packs

## Root cause
The same variant can have the same rounded per-piece price for different packs. Example:
- Half dozen: 350 / 6 = 58.333...
- Dozen: 700 / 12 = 58.333...

The previous sale-line merge key used only `variantId + rounded per-piece price`. That could collapse the two different sale units into one backend line.

## Fix
Sale payloads now carry:
- `unit`
- `factor`
- `lineTotalCents` (integer cents)

The backend line identity includes the sale unit/factor and exact line total, and subtotal calculation uses integer cents. This preserves:
- Half dozen = 350 EGP
- Dozen = 700 EGP
- Invoice total = 1,050 EGP

The existing `lineTotal` remains for compatibility, but cents are authoritative when supplied.
