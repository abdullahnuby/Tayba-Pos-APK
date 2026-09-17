import { exportDatabaseBytes } from '@/lib/db/client'

export type BackupEntry = {
  filename: string
  size: number
  createdAt: string
  updatedAt: string
}

function getBridge() {
  return typeof window !== 'undefined' ? window.taybaBackup : undefined
}

export function isDesktopBackupAvailable(): boolean {
  return !!getBridge()
}

function buildFilename() {
  return `tayba-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`
}

export async function createDesktopBackup(filename = buildFilename()) {
  const bridge = getBridge()
  if (!bridge) throw new Error('النسخ التلقائي متاح في نسخة Windows فقط')
  const bytes = await exportDatabaseBytes()
  return bridge.save(bytes, filename)
}

export async function listDesktopBackups(): Promise<BackupEntry[]> {
  const bridge = getBridge()
  if (!bridge) return []
  return bridge.list()
}

export async function deleteDesktopBackup(filename: string) {
  const bridge = getBridge()
  if (!bridge) throw new Error('إدارة النسخ الاحتياطية المحلية متاحة في نسخة Windows فقط')
  return bridge.remove(filename)
}

export async function openDesktopBackupFolder() {
  const bridge = getBridge()
  if (!bridge) throw new Error('مجلد النسخ الاحتياطية متاح في نسخة Windows فقط')
  return bridge.openFolder()
}

export async function runAutomaticDesktopBackup() {
  const bridge = getBridge()
  if (!bridge) return { skipped: true as const, reason: 'not-desktop' as const }

  const existing = await bridge.list()
  const today = new Date().toISOString().slice(0, 10)
  const hasBackupToday = existing.some((entry) => entry.filename.includes(`-${today}T`))
  if (hasBackupToday) return { skipped: true as const, reason: 'already-backed-up' as const }

  const created = await createDesktopBackup()

  const after = await bridge.list()
  const keep = after.slice(0, 7)
  const keepNames = new Set(keep.map((entry) => entry.filename))
  await Promise.all(after.slice(7).filter((entry) => !keepNames.has(entry.filename)).map((entry) => bridge.remove(entry.filename)))

  return { skipped: false as const, backup: created }
}
