import { Capacitor } from '@capacitor/core'
import { get, set } from 'idb-keyval'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { getDb, exportDatabaseBytes, replaceDatabaseBytes } from '../db/client'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function backupFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `tayba-backup-${stamp}.sqlite`
}

async function validateSqliteBytes(bytes: Uint8Array): Promise<void> {
  const db = await getDb()
  // The exported bytes come from the active database; run a non-mutating
  // integrity check before writing them to the external backup target.
  const result = db.exec('PRAGMA integrity_check')
  const value = result[0]?.values?.[0]?.[0]
  if (value !== 'ok') throw new Error(`فشل فحص سلامة قاعدة البيانات: ${String(value ?? 'unknown')}`)
  if (bytes.byteLength < 100) throw new Error('ملف النسخة الاحتياطية صغير بشكل غير منطقي')
}

export async function createLocalArchive() {
  const bytes = await exportDatabaseBytes()
  await validateSqliteBytes(bytes)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const filename = backupFilename()

  // A local history marker only; no business data is written to SQLite.
  await set('tayba-last-daily-archive', new Date().toISOString().slice(0, 10))
  await set('tayba-last-backup-meta', {
    id,
    filename,
    bytes: bytes.byteLength,
    createdAt,
    location: Capacitor.isNativePlatform() ? 'Documents/TaybaPOS/Backups' : 'اختيار المستخدم / Downloads',
  })

  if (Capacitor.isNativePlatform()) {
    const path = `TaybaPOS/Backups/${filename}`
    await Filesystem.writeFile({
      path,
      data: toBase64(bytes),
      directory: Directory.Documents,
      recursive: true,
    })
    const uri = await Filesystem.getUri({ path, directory: Directory.Documents })
    return { ok: true, archiveId: id, filename, bytes: bytes.byteLength, createdAt, path, uri: uri.uri, location: 'Documents/TaybaPOS/Backups' }
  }

  return { ok: true, archiveId: id, filename, bytes: bytes.byteLength, createdAt, path: '', uri: '', location: 'اختيار المستخدم / Downloads' }
}

export async function shareBackup(bytes: Uint8Array, filename: string) {
  if (!Capacitor.isNativePlatform()) return { ok: false, supported: false }
  const tempPath = `TaybaPOS/Backups/${filename}`
  await Filesystem.writeFile({ path: tempPath, data: toBase64(bytes), directory: Directory.Documents, recursive: true })
  const uri = await Filesystem.getUri({ path: tempPath, directory: Directory.Documents })
  const canShare = await Share.canShare()
  if (!canShare.value) return { ok: false, supported: false, uri: uri.uri }
  await Share.share({ title: 'نسخة قاعدة بيانات طيبة', text: `نسخة احتياطية: ${filename}`, url: uri.uri, dialogTitle: 'مشاركة النسخة الاحتياطية' })
  return { ok: true, supported: true, uri: uri.uri }
}

export async function restoreLatestArchive() {
  throw new Error('الاستعادة من نسخة محلية محفوظة على الجهاز تتم باختيار الملف يدويًا من شاشة النسخ والاستعادة')
}

export async function restoreDatabaseBytes(bytes: Uint8Array) {
  if (bytes.byteLength < 100) throw new Error('ملف النسخة الاحتياطية غير صالح')
  // replaceDatabaseBytes performs schema validation before replacing storage.
  await replaceDatabaseBytes(bytes)
  await set('tayba-last-restore-at', new Date().toISOString())
  return { ok: true, bytes: bytes.byteLength, requiresRestart: true }
}

export async function getLocalBackup() {
  const bytes = await exportDatabaseBytes()
  await validateSqliteBytes(bytes)
  return { id: crypto.randomUUID(), bytes, filename: backupFilename() }
}

export async function ensureDailyLocalArchive() {
  const today = new Date().toISOString().slice(0, 10)
  const last = await get<string>('tayba-last-daily-archive')
  if (last === today) return { ok: true, skipped: true, date: today }
  const result = await createLocalArchive()
  await set('tayba-last-daily-archive', today)
  return { ...result, skipped: false, date: today }
}
