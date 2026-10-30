#!/usr/bin/env node
'use strict'

// Issue a permanent offline license for one exact KAYAN device.
// Keep the encrypted private key outside the repository.
// Required environment:
//   KAYAN_LICENSE_PRIVATE_KEY_PATH=C:\\secure\\kayan-license-private-encrypted.pem
//   KAYAN_LICENSE_PASSPHRASE=<passphrase>
// Usage:
//   node scripts/issue-license.cjs C57A00E13C348DB643C56B8A

const fs = require('node:fs')
const crypto = require('node:crypto')

const machineId = String(process.argv[2] || '').trim().toUpperCase()
if (!/^[A-F0-9]{24}$/.test(machineId)) {
  console.error('Usage: node scripts/issue-license.cjs <24-character-device-id>')
  process.exit(2)
}

const privateKeyPath = process.env.KAYAN_LICENSE_PRIVATE_KEY_PATH
const passphrase = process.env.KAYAN_LICENSE_PASSPHRASE
if (!privateKeyPath || !passphrase) {
  console.error('Set KAYAN_LICENSE_PRIVATE_KEY_PATH and KAYAN_LICENSE_PASSPHRASE first.')
  process.exit(2)
}

let privateKey
try {
  privateKey = crypto.createPrivateKey({
    key: fs.readFileSync(privateKeyPath),
    format: 'pem',
    passphrase,
  })
} catch (error) {
  console.error('Could not load the encrypted license signing key. Check its path and passphrase.')
  process.exit(2)
}

const payload = { product: 'tayba-pos', type: 'lifetime', machineId }
const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
const signaturePart = crypto.sign('RSA-SHA256', Buffer.from(payloadPart, 'utf8'), privateKey).toString('base64url')
console.log(payloadPart + '.' + signaturePart)
