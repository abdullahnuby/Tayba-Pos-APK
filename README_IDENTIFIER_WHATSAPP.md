# Automatic SKU, Barcode and Electronic Receipt

## SKU
A variant created without an SKU receives an automatic unique store-owned SKU, e.g. `TAY-20260904-0001-AB`.
The SKU is a local inventory identifier, not a global trade identifier.

## Barcode
A missing barcode is generated automatically.
- When a valid GS1 Company Prefix owned by the store is configured in Store Settings, the generator creates a GTIN-13-shaped identifier from that prefix plus a local item-reference sequence and calculates the check digit.
- Without a GS1 Company Prefix, the generator creates an EAN-13-shaped internal barcode for this store. It is intentionally **not** described as a globally licensed GTIN.

GS1 states that a globally unique GTIN requires a GS1 Company Prefix issued by a GS1 Member Organisation. The application therefore never falsely labels a locally generated number as a global GS1 identifier.

## Electronic Receipt / WhatsApp
After completing a sale, the receipt dialog contains **إرسال واتساب**.
If the sale is linked to a customer with a phone number, the app opens WhatsApp click-to-chat with the receipt pre-filled. Egyptian mobile numbers entered as `01xxxxxxxxx` are converted to international `20...` format.

The current web version sends the receipt as pre-filled text. Native PDF/document attachment is intentionally left for the Android phase.
