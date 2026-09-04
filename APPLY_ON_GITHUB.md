# Tayba POS — Android Tablet Input Root Fix

Replace these files in the repository `abdullahnuby/Tayba-Pos-APK` on branch `main`:

- `src/components/numeric-pad.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/main.tsx`
- `src/tablet-input-contract.css` (new file)
- `REFERENCE_PARITY_TODO.md`

Then run GitHub Actions.

## What this fixes

1. Numeric keypad uses Pointer Events directly instead of relying on Android WebView's synthesized click events.
2. Numeric keypad keeps the authoritative request/value in refs, preventing stale callback/state races during rapid touches.
3. Numeric commit has a busy guard to prevent double submit.
4. Clear, backspace, decimal and first-key replacement share one deterministic state path.
5. The central Button component has a coarse-pointer fallback. On touch, an action is executed once and the duplicate synthesized click is suppressed.
6. Submit buttons without an explicit `onClick` use `form.requestSubmit()` on touch, fixing touch submission in forms such as category/brand add.
7. Native text inputs explicitly keep Android's native selection/editing gestures and use 16px text to avoid WebView zoom/focus problems.
8. The custom keypad gets a dedicated highest z-index root.

## Verification checklist on Android

- Login PIN: 1 2 3 4, backspace, clear, confirm.
- Setup PIN: same sequence.
- New user PIN and change PIN.
- Add category: type Arabic text, delete/edit it, press the Add button by touch, press Android Done/Enter.
- Add brand with the same flow.
- Product name/size/color text editing.
- Numeric price/cost/quantity/discount/payment fields.
- Fast repeated touches must not duplicate digits or submit twice.
