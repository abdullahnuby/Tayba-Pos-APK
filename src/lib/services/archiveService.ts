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
  if (bytes.byteLength < 100) throw new Error('ملف النسخة الاحتياطية صغير بشكل غير منطقي')
  const db = await getDb()
  // PRAGMA integrity_check is read-only and validates the currently exported DB.
  const result = db.exec('PRAGMA integrity_check')
  const value = result[0]?.values?.[0]?.[0]
  if (value !== 'ok') throw new Error(`فشل فحص سلامة قاعدة البيانات: ${String(value ?? 'unknown')}`)
  // SQLite magic header: "SQLite format 3\\0".
  const header = new TextDecoder().decode(bytes.subarray(0, 16))
  if (header !== 'SQLite format 3\u0000') throw new Error('ملف النسخة الاحتياطية ليس قاعدة SQLite صالحة')
}

async function persistBackupMeta(meta: { id: string; filename: string; bytes: number; createdAt: string; location: string }) {
  await set('tayba-last-daily-archive', new Date().toISOString().slice(0, 10))
  await set('tayba-last-backup-meta', meta)
}

async function ensureNativeDocumentsPermission() {
  const current = await Filesystem.checkPermissions()
  if (current.publicStorage === 'granted') return
  const requested = await Filesystem.requestPermissions()
  if (requested.publicStorage !== 'granted') {
    throw new Error('يلزم السماح للتطبيق بالوصول إلى مجلد المستندات لحفظ النسخة الاحتياطية')
  }
}

async function writeNativeBackup(bytes: Uint8Array, filename: string) {
  await ensureNativeDocumentsPermission()
  const path = `TaybaPOS/Backups/${filename}`
  const base64 = toBase64(bytes)
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  })

  // Verify the exact file we just wrote before claiming success. Stat avoids
  // reading the entire backup back into memory a second time.
  const stat = await Filesystem.stat({ path, directory: Directory.Documents })
  if (Number(stat.size || 0) !== bytes.byteLength) {
    throw new Error('تم إنشاء ملف النسخة لكن حجمه لا يطابق قاعدة البيانات الأصلية')
  }
  const uri = await Filesystem.getUri({ path, directory: Directory.Documents })
  return { path, uri: uri.uri }
}

export async function createLocalArchive(input?: { bytes?: Uint8Array; filename?: string; share?: boolean }) {
  const bytes = input?.bytes ?? await exportDatabaseBytes()
  await validateSqliteBytes(bytes)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const filename = input?.filename ?? backupFilename()
  const location = Capacitor.isNativePlatform()
    ? 'Documents/TaybaPOS/Backups'
    : 'اختيار المستخدم / Downloads'

  let path = ''
  let uri = ''
  if (Capacitor.isNativePlatform()) {
    const saved = await writeNativeBackup(bytes, filename)
    path = saved.path
    uri = saved.uri
  }

  await persistBackupMeta({ id, filename, bytes: bytes.byteLength, createdAt, location })

  if (input?.share && Capacitor.isNativePlatform()) {
    const canShare = await Share.canShare()
    if (canShare.value) {
      await Share.share({
        title: 'نسخة قاعدة بيانات طيبة',
        text: `نسخة احتياطية: ${filename}`,
        url: uri,
        dialogTitle: 'مشاركة النسخة الاحتياطية',
      })
    }
  }

  return { ok: true, archiveId: id, filename, bytes: bytes.byteLength, createdAt, path, uri, location }
}

export async function shareBackup(bytes: Uint8Array, filename: string) {
  if (!Capacitor.isNativePlatform()) return { ok: false, supported: false }
  await validateSqliteBytes(bytes)
  const saved = await writeNativeBackup(bytes, filename)
  const canShare = await Share.canShare()
  if (!canShare.value) return { ok: false, supported: false, uri: saved.uri }
  await Share.share({
    title: 'نسخة قاعدة بيانات طيبة',
    text: `نسخة احتياطية: ${filename}`,
    url: saved.uri,
    dialogTitle: 'مشاركة النسخة الاحتياطية',
  })
  return { ok: true, supported: true, uri: saved.uri }
}

export async function restoreLatestArchive() {
  throw new Error('اختر ملف SQLite من زر استعادة النسخة الاحتياطية')
}

export async function restoreDatabaseBytes(bytes: Uint8Array) {
  await validateSqliteBytes(bytes)
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
  return { ...result, skipped: false, date: today }
}
