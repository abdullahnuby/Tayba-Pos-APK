# Tayba POS — Seller Licensing

The desktop application ships only the RSA public verification key. The seller private key must stay outside the repository.

## Generate a permanent key

1. Obtain the customer's 24-character `MACHINE_ID` from the license/upgrade screen.
2. Keep your private key in a secure password manager or offline file.
3. Set it in the shell as `TAYBA_LICENSE_PRIVATE_KEY`.
4. Run:

```text
node tools/licensing/generate-license-key.cjs MACHINE_ID
```

The command prints a signed lifetime license key. Send that key to the customer.

Never commit the private key, and never put it in the Electron application.

## Important V1 limitation

The 30-day trial is offline/local by design. It detects basic clock rollback and ties its state to the installation anchor, but it is not a server-grade anti-tamper licensing system. A future commercial licensing service can be added without changing the POS data model.
