# Cashier Product Card Fix — 2026-09-05

## Problem
The cashier product cards were visually overflowing: the Add button could render outside the card and overlap the content of the next row.

## Root cause
The cashier-specific CSS forced each product card to fixed heights (84px desktop / 70px mobile) while the card content + Add button required more vertical space. The grid also forced `grid-auto-rows: minmax(0, 1fr)`, allowing content to overflow its allocated row.

## Fix
- Product grid rows now use `max-content` instead of fractional fixed rows.
- Product cards use `height: auto` and a safe minimum height.
- Cards use `box-sizing: border-box` and `overflow: hidden`.
- Increased grid gap slightly to prevent visual crowding.
- Mobile cards use the same content-driven sizing instead of a 70px fixed height.
- Added `overflow-hidden` to the product card JSX as an additional containment guard.
- The Add button remains a normal in-flow element; no absolute positioning is used.

## Validation
The repository source was reviewed against the current uploaded working ZIP. The GitHub `main` branch is older than the uploaded working ZIP, so this fix is applied to the current working ZIP rather than overwriting the older GitHub branch with an incomplete merge.

A full production build could not be executed in this environment because `node_modules` are not installed in the working archive. The relevant source/CSS structure was checked directly.
