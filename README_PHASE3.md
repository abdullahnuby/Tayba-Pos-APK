# Tayba POS Offline — Phase 3 UI Rebuild

## What changed
- Fixed the recurring Vite/sql.js ESM error by importing the UMD distribution explicitly from `sql.js/dist/sql-wasm.js` and letting Vite emit the WASM through `?url` asset handling.
- Added a real SVG favicon at `/favicon.svg`; the repeated `/favicon.ico` 404 is eliminated by an explicit `<link rel="icon">`.
- Rebuilt the visual shell as a mobile-first Arabic RTL POS interface.
- Added responsive sidebar navigation, mobile bottom navigation, dashboard KPIs, POS product grid, cart/payment panel, inventory table, register screen, parties, reports, and settings.
- Kept SQLite/local business logic isolated from UI components.

## Run

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

The runtime receives the final emitted WASM URL directly from Vite, so it does not depend on `/node_modules/sql.js/...` being publicly accessible.

## Important

The reference repository `abdullahnuby/tayba-pos` is not part of this project and must remain untouched.

## Error fixes

The recurring `sql-wasm-browser.js does not provide an export named default` issue is avoided by bypassing the package browser condition and importing the explicit UMD distribution `sql.js/dist/sql-wasm.js`. The WASM binary is loaded through Vite's `?url` asset pipeline instead of `/node_modules/...`. A real `/favicon.ico` is also shipped as a fallback for browsers or cached shells that still request it.
