import { getDb, exportDatabaseBytes, replaceDatabaseBytes } from '../db/client'
import { setSetting } from '../settings'
import { v4 as uuid } from 'uuid'

export async function createLocalArchive() {
  const db = await getDb()
  const bytes = db.export()
  const id = uuid()
  const key = `tayba-archive-${id}`
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const base64 = btoa(binary)
  localStorage.setItem(key, base64)
  await setSetting('lastArchiveAt', new Date().toISOString())
  await setSetting('lastArchiveKey', key)
  return { ok: true, archiveId: id, key, bytes: bytes.byteLength, createdAt: new Date().toISOString() }
}

export async function restoreLatestArchive() {
  const key = localStorage.getItem('tayba-restore-key')
  if (!key) throw new Error('لا توجد نسخة احتياطية محددة للاستعادة')
  const value = localStorage.getItem(key)
  if (!value) throw new Error('النسخة الاحتياطية غير موجودة على الجهاز')
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0))
  await replaceDatabaseBytes(bytes)
  localStorage.removeItem('tayba-restore-key')
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
  const last = localStorage.getItem('tayba-last-daily-archive')
  const today = new Date().toISOString().slice(0,10)
  if (last === today) return {ok:true,skipped:true,date:today}
  const result = await createLocalArchive()
  localStorage.setItem('tayba-last-daily-archive', today)
  return { ...result, skipped:false, date:today }
}
