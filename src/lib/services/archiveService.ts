import { del, get, keys, set } from 'idb-keyval'
import { v4 as uuid } from 'uuid'
import {
  decryptStoredDatabase,
  encryptDatabase,
  exportDatabaseBytes,
  replaceDatabaseBytes,
  type EncryptedDatabaseBlob,
} from '../db/client'
import { setSetting } from '../settings'

/**
 * In-app safety archives.
 *
 * These are automatic rolling copies of the database kept INSIDE the app
 * (IndexedDB, encrypted with the same key as the live database). They are a
 * safety net — e.g. the automatic copy taken before a restore — and are NOT a
 * substitute for a backup file the user saves outside the app
 * (see backupFileService.ts).
 *
 * History: archives used to be stored as base64 in localStorage with no
 * cleanup. A single copy of a real shop database is several MB, and
 * localStorage is capped at ~5 MB, so after a few days the quota was gone,
 * the daily archive silently stopped working and localStorage (which also
 * holds the login session) was left full. IndexedDB has no such limit, and
 * old copies are now rotated.
 */

const ARCHIVE_PREFIX = 'tayba-archive:'
const LEGACY_LOCALSTORAGE_PREFIX = 'tayba-archive-'
export const MAX_LOCAL_ARCHIVES = 7

type StoredArchive = {
  id: string
  createdAt: string
  reason: string
  blob: EncryptedDatabaseBlob
}

export type LocalArchiveInfo = { key: string; id: string; createdAt: string; reason: string }

/** Frees the space that the old localStorage-based archives were holding. */
export function purgeLegacyLocalStorageArchives(): number {
  let removed = 0
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LEGACY_LOCALSTORAGE_PREFIX)) stale.push(k)
    }
    for (const k of stale) { localStorage.removeItem(k); removed++ }
  } catch { /* storage unavailable: nothing to clean */ }
  return removed
}

export async function listLocalArchives(): Promise<LocalArchiveInfo[]> {
  const all = await keys()
  const rows: LocalArchiveInfo[] = []
  for (const k of all) {
    if (typeof k !== 'string' || !k.startsWith(ARCHIVE_PREFIX)) continue
    const value = await get<StoredArchive>(k)
    if (value?.createdAt) rows.push({ key: k, id: value.id, createdAt: value.createdAt, reason: value.reason })
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function pruneArchives(keep = MAX_LOCAL_ARCHIVES) {
  const rows = await listLocalArchives()
  await Promise.all(rows.slice(keep).map((row) => del(row.key)))
}

export async function createLocalArchive(reason = 'manual') {
  const bytes = await exportDatabaseBytes()
  const id = uuid()
  const createdAt = new Date().toISOString()
  const key = `${ARCHIVE_PREFIX}${createdAt}-${id}`
  const record: StoredArchive = { id, createdAt, reason, blob: await encryptDatabase(bytes) }
  await set(key, record)
  await pruneArchives()
  await setSetting('lastArchiveAt', createdAt)
  await setSetting('lastArchiveKey', key)
  return { ok: true, archiveId: id, key, bytes: bytes.byteLength, createdAt }
}

/** Restores a specific in-app archive, or the newest one when no key is given. */
export async function restoreLatestArchive(key?: string) {
  const target = key ?? (await listLocalArchives())[0]?.key
  if (!target) throw new Error('لا توجد نسخة احتياطية محفوظة داخل التطبيق للاستعادة')
  const record = await get<StoredArchive>(target)
  if (!record?.blob) throw new Error('النسخة الاحتياطية غير موجودة على الجهاز')
  const bytes = await decryptStoredDatabase(record.blob)
  await replaceDatabaseBytes(bytes)
  await setSetting('lastRestoreAt', new Date().toISOString())
  return { ok: true, bytes: bytes.byteLength, requiresRestart: true }
}

export async function restoreDatabaseBytes(bytes: Uint8Array) {
  await replaceDatabaseBytes(bytes)
  await setSetting('lastRestoreAt', new Date().toISOString())
  return { ok: true, bytes: bytes.byteLength, requiresRestart: true }
}

export async function getLocalBackup() {
  const bytes = await exportDatabaseBytes()
  const id = uuid()
  return { id, bytes, filename: `tayba-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite` }
}

export async function ensureDailyLocalArchive() {
  purgeLegacyLocalStorageArchives()
  const today = new Date().toISOString().slice(0, 10)
  let last: string | null = null
  try { last = localStorage.getItem('tayba-last-daily-archive') } catch { /* ignore */ }
  if (last === today) return { ok: true, skipped: true, date: today }
  const result = await createLocalArchive('daily')
  try { localStorage.setItem('tayba-last-daily-archive', today) } catch { /* ignore */ }
  return { ...result, skipped: false, date: today }
}
