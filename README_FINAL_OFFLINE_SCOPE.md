# Tayba POS — Final Offline Scope

Primary device: Android/tablet.

## Touch contract

- The UI is RTL Arabic-first.
- Every primary action is touch-operable.
- Coarse-pointer controls use generous touch targets (48px baseline).
- POS, payment, login, navigation, dialogs, tables and forms do not require hover.
- Login uses local username + 4-digit PIN; an on-screen PIN keypad is provided.
- SQLite remains the runtime data store.
- Google Sheets production sync and Android packaging are deliberately deferred.

## Release gate

Static checks pass. Full dependency installation, browser E2E and physical-tablet acceptance remain environment/device gates.
