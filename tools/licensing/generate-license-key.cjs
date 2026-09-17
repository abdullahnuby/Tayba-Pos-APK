#!/usr/bin/env node
// Seller-side tool. Keep the private key outside the repository.
// Usage: node tools/licensing/generate-license-key.cjs <MACHINE_ID>
const fs = require('node:fs')
const crypto = require('node:crypto')
const machineId = String(process.argv[2] || '').trim().toUpperCase()
if (!/^[A-F0-9]{24}$/.test(machineId)) {
  console.error('Usage: node tools/licensing/generate-license-key.cjs <24-char MACHINE_ID>')
  process.exit(1)
}
const privateKey = process.env.TAYBA_LICENSE_PRIVATE_KEY
if (!privateKey) {
  console.error('Set TAYBA_LICENSE_PRIVATE_KEY to your seller private key. Never commit it.')
  process.exit(1)
}
const payload = { product: 'tayba-pos', type: 'lifetime', machineId, issuedAt: new Date().toISOString() }
const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
const sign = crypto.createSign('RSA-SHA256')
sign.update(payloadPart); sign.end()
const signature = sign.sign(privateKey).toString('base64url')
console.log(`${payloadPart}.${signature}`)
