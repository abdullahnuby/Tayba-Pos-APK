# Tayba POS — Android Tablet Numeric Pad Root Fix v2

This is NOT the previous pointer-events patch. This version fixes the underlying layer/hit-testing problem.

Replace/add:
- `src/components/numeric-pad.tsx`
- `src/tablet-input-contract.css`
- `REFERENCE_PARITY_TODO.md`

## Why v2 is different
The prior patch changed pointer handlers but the keypad was still rendered in the normal React tree. When opened from a Radix Dialog, the dialog/modal layer could still win hit-testing or swallow touches. The visible keypad could therefore appear on screen while the touch went to the content underneath.

This version:
1. Uses `createPortal(keypad, document.body)`.
2. Gives the keypad root explicit `pointer-events: auto` and maximum z-index.
3. Stops pointer propagation in capture phase inside the keypad.
4. Forces the body hit-testing state back to `pointer-events:auto` while the keypad exists.
5. Keeps the ref-based numeric state from the previous patch.

## Test order on Android
- Product → New Product → Cost Price: tap keypad digits.
- Product → New Product → Sell Price: tap keypad digits.
- Users → New User → PIN: tap 1 2 3 4.
- Setup → Admin PIN: tap keypad.
- Register → cash amount.
- Suppliers/Returns/Stock → numeric fields.
- Sales → discount/payment (must remain working).
- Verify keypad button touches NEVER activate controls behind it.
- Verify clear/backspace/confirm.

Do not create a new keystore. Build with the existing release signing secrets.
