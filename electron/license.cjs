// Tayba POS — commercial local licensing bridge.
// Trial is intentionally local/offline for V1. Permanent licenses are signed
// with an RSA private key that MUST stay outside the application source.

const crypto = require('node:crypto')
const os = require('node:os')
const fs = require('node:fs')

const PRODUCT_ID = 'tayba-pos'
const TRIAL_DAYS = 30

// Public verification key only. The matching private key is NEVER shipped.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA3qHeqNJX3YaP5nLghwaq
IgKOs5pHp+nirv9CtN44eCJ34zANIwWDW7xLY4k1efD/hFi30cVvKTsy2pGUVs1Q
mMV4dCWHuJyUE0c1RySHrS8GYc6qk8pdjRVSVAQsJSBNlvR0kEe5xoV/S2OLck2M
hgQDnt/EQtW/fhdruk3SNfgxae0brRzslP/Qu6p7liKJdwKO860j7L7S1guFzvKV
/FiThHxljcn2EX+W/fYDX/XEo+1X0b4S+r2sXHyzXH0pEXU/ZKyvo3BZ/7M6w0Pf
i9efBxFR5kgqCFgHB+uBJEw9Yz2jtxa00sauXJ9Tgstc21xdigD9DfXXnmze9VcN
c2N0FOnF2LlWt9nynFrlzwkI18PYu2uUPZUp2WPcgCnz3ZJJqHE1Whg94kA5/ggN
6P0d2xvhgxVFn3SS1TvgwEb49720vK36UPUVKOAE1DJSJx7agmttZKQmA77c3N5H
tAWqjh56w3U9lmiykopW7zn5ERuh8SJh7re5derTVdxDAgMBAAE=
-----END PUBLIC KEY-----`

// Keep the former verification key during migration so any already-issued
// licenses made with the previous issuer remain valid after this update.
const LEGACY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqeHvBlaqbjqXmMy5fc/w
AyPR5aTMQaau4WYh4DYrxqBbtxx9SS1+vaQvmRd9yR6T8n4mJXo3V8dPuS9uv0tE
Bme5RSFUMTB8iQ8Sgukqio2/P2YPbRKQqsGBPxjCgpLsCD4PjNGrG6AWKT4FRnXl
HHlreNK/LLMPDENvwhNg6zRS07NNhAyfr2PKou/0Royak5BZ5IIT9mwRGhxtmSNc
dvEmupnw9eMDm6AmQVIw8v8KeHQsiryIcJZvb2lnsYVcgAbEIhTlxZO0W7Olfs5y
DdnY7Jpul+QNyF0VubUeMVEk2XjBDrVek3kztmvMiEuajT82LiA2oz7hp78UYkSU
RwIDAQAB
-----END PUBLIC KEY-----`
const VERIFICATION_KEYS = [PUBLIC_KEY, LEGACY_PUBLIC_KEY]

function buildMachineId(anchor) {
  const parts = [os.hostname(), os.platform(), os.arch(), (os.cpus()?.[0]?.model || 'unknown-cpu').trim(), anchor || '']
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24).toUpperCase()
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

function verifySignedLicense(raw, machineId) {
  try {
    const [payloadPart, signaturePart] = String(raw || '').trim().split('.')
    if (!payloadPart || !signaturePart) return { ok: false, error: 'صيغة الترخيص غير صحيحة' }
    const payload = decode(payloadPart)
    if (payload.product !== PRODUCT_ID || payload.type !== 'lifetime') return { ok: false, error: 'الترخيص غير صالح لهذا المنتج' }
    if (payload.machineId !== machineId) return { ok: false, error: 'الترخيص غير مرتبط بهذا الجهاز' }
    const signature = Buffer.from(signaturePart, 'base64url')
    const signatureValid = VERIFICATION_KEYS.some((publicKey) => {
      const verify = crypto.createVerify('RSA-SHA256')
      verify.update(payloadPart)
      verify.end()
      return verify.verify(publicKey, signature)
    })
    if (!signatureValid) return { ok: false, error: 'توقيع الترخيص غير صالح' }
    return { ok: true, payload }
  } catch {
    return { ok: false, error: 'تعذر قراءة الترخيص' }
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function writeJson(file, value) {
  fs.mkdirSync(require('node:path').dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

function getStatus({ licenseFile, trialFile, machineId }) {
  const license = readJson(licenseFile)
  if (license?.key) {
    const checked = verifySignedLicense(license.key, machineId)
    if (checked.ok) return { state: 'active', type: 'lifetime', machineId, activatedAt: license.activatedAt || null }
  }

  let trial = readJson(trialFile)
  if (!trial) {
    const now = Date.now()
    trial = { product: PRODUCT_ID, machineId, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + TRIAL_DAYS * 86400000).toISOString() }
    writeJson(trialFile, trial)
  }

  const started = Date.parse(trial.startedAt)
  const expires = Date.parse(trial.expiresAt)
  const now = Date.now()
  const valid = Number.isFinite(started) && Number.isFinite(expires) && trial.machineId === machineId && expires > now
  const tamperedClock = Number.isFinite(started) && now + 5 * 60 * 1000 < started
  if (tamperedClock) return { state: 'expired', type: 'trial', machineId, expiresAt: trial.expiresAt, reason: 'clock_rollback' }
  if (!valid) return { state: 'expired', type: 'trial', machineId, expiresAt: trial.expiresAt }
  return { state: 'trial', type: 'trial', machineId, expiresAt: trial.expiresAt, daysLeft: Math.max(0, Math.ceil((expires - now) / 86400000)) }
}

function activateWithKey(rawKey, { licenseFile, machineId }) {
  const checked = verifySignedLicense(rawKey, machineId)
  if (!checked.ok) return { ok: false, error: checked.error }
  writeJson(licenseFile, { key: String(rawKey).trim(), machineId, activatedAt: new Date().toISOString() })
  return { ok: true, type: 'lifetime', machineId }
}

module.exports = { PRODUCT_ID, TRIAL_DAYS, PUBLIC_KEY, buildMachineId, getStatus, activateWithKey, encode }
