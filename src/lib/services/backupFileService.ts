import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { assertDatabaseIntegrity, exportDatabaseBytes } from '../db/client'

/**
 * Saving a backup FILE the user can find again.
 *
 * The previous implementation created a hidden <a download> link. That gave a
 * "success" toast but no way to choose where the file went, and on the Android
 * WebView it did not reliably produce a file at all. Each platform now uses
 * its proper mechanism, and the result always says where the file ended up:
 *
 *  - Windows (Electron): native "Save as" dialog — the user picks the folder.
 *  - Android (Capacitor): the file is written to Documents/TaybaPOS/Backups
 *    (kept for sure, path is shown) AND the system share sheet is opened so
 *    the user can send it to Drive / Files / WhatsApp / a USB drive etc.
 *  - Browser: "Save as" picker when supported, otherwise a normal download
 *    into the browser's Downloads folder (and we say so).
 */

export type BackupSaveResult = {
  status: 'saved' | 'shared' | 'cancelled'
  method: 'electron-dialog' | 'android-documents' | 'android-share' | 'file-picker' | 'browser-download'
  filename: string
  size: number
  /** Human-readable location shown to the user. */
  location: string
  /** Extra line explaining what to do next (e.g. share sheet advice). */
  note?: string
}

const SQLITE_HEADER = 'SQLite format 3\u0000'
const ANDROID_BACKUP_DIR = 'TaybaPOS/Backups'
const ANDROID_SHARE_DIR = 'tayba-share'

export function buildBackupFilename(prefix = 'tayba-backup') {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`
}

export function assertSqliteBytes(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 100) {
    throw new Error('ملف النسخة الاحتياطية فارغ أو غير صالح')
  }
  const header = new TextDecoder().decode(bytes.subarray(0, 16))
  if (header !== SQLITE_HEADER) throw new Error('ملف النسخة الاحتياطية ليس SQLite صالحًا')
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function toBlob(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/x-sqlite3' })
}

function isUserCancel(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /abort|cancel/i.test(text)
}

/* ------------------------------ Android ------------------------------ */

async function saveOnAndroid(bytes: Uint8Array, filename: string): Promise<BackupSaveResult> {
  const data = toBase64(bytes)

  // 1) A copy in a temporary folder that the share sheet is guaranteed to be
  //    able to read. Older temporary copies are cleared first.
  try { await Filesystem.rmdir({ path: ANDROID_SHARE_DIR, directory: Directory.Cache, recursive: true }) } catch { /* nothing to clear */ }
  const temp = await Filesystem.writeFile({
    path: `${ANDROID_SHARE_DIR}/${filename}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  })

  // 2) A permanent copy in the public Documents folder. This can be refused
  //    on some Android versions, so it is best-effort — the share sheet below
  //    is the user's own way to choose a location in that case.
  let documentsSaved = false
  try {
    try { await Filesystem.requestPermissions() } catch { /* not required on newer Android */ }
    await Filesystem.writeFile({
      path: `${ANDROID_BACKUP_DIR}/${filename}`,
      data,
      directory: Directory.Documents,
      recursive: true,
    })
    const stat = await Filesystem.stat({ path: `${ANDROID_BACKUP_DIR}/${filename}`, directory: Directory.Documents })
    documentsSaved = Number(stat.size) === bytes.byteLength
  } catch { documentsSaved = false }

  // 3) Let the user pick where the file goes.
  let shared = false
  let cancelled = false
  try {
    const canShare = await Share.canShare().catch(() => ({ value: true }))
    if (canShare.value) {
      await Share.share({
        title: 'نسخة احتياطية — طيبة POS',
        text: filename,
        files: [temp.uri],
        dialogTitle: 'اختر مكان حفظ النسخة الاحتياطية',
      })
      shared = true
    }
  } catch (error) {
    if (isUserCancel(error)) cancelled = true
  }

  if (documentsSaved) {
    return {
      status: 'saved',
      method: 'android-documents',
      filename,
      size: bytes.byteLength,
      location: `Documents/${ANDROID_BACKUP_DIR}/${filename}`,
      note: shared
        ? 'تم أيضًا فتح قائمة المشاركة لاختيار مكان آخر (Drive / ملفات / فلاشة).'
        : 'افتح تطبيق «الملفات» ← Documents ← TaybaPOS ← Backups لتجدها.',
    }
  }
  if (shared) {
    return {
      status: 'shared',
      method: 'android-share',
      filename,
      size: bytes.byteLength,
      location: 'المكان الذي اخترته من قائمة المشاركة',
      note: 'لو اخترت تطبيقًا لا يحفظ الملف (مثل الرسائل) كرر العملية واختر «حفظ في الملفات» أو Drive.',
    }
  }
  if (cancelled) {
    return {
      status: 'cancelled',
      method: 'android-share',
      filename,
      size: bytes.byteLength,
      location: '—',
      note: 'تم إلغاء اختيار المكان ولم يتم حفظ النسخة. اضغط «تنزيل نسخة» مرة أخرى.',
    }
  }
  throw new Error('تعذر حفظ النسخة على الجهاز ولا فتح قائمة المشاركة. تأكد من صلاحية التخزين ثم أعد المحاولة.')
}

/* ------------------------------ Windows ------------------------------ */

async function saveOnElectron(bytes: Uint8Array, filename: string): Promise<BackupSaveResult> {
  const result = await window.taybaBackup!.saveAs!(bytes, filename)
  if (result.canceled) {
    return {
      status: 'cancelled',
      method: 'electron-dialog',
      filename,
      size: bytes.byteLength,
      location: '—',
      note: 'تم إلغاء الحفظ ولم يتم إنشاء أي ملف.',
    }
  }
  return {
    status: 'saved',
    method: 'electron-dialog',
    filename: result.filename || filename,
    size: result.size,
    location: result.path,
  }
}

/* ------------------------------ Browser ------------------------------ */

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<{
    name: string
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
  }>
}

async function saveInBrowser(bytes: Uint8Array, filename: string): Promise<BackupSaveResult> {
  const blob = toBlob(bytes)
  const picker = (window as FilePickerWindow).showSaveFilePicker
  if (typeof picker === 'function') {
    try {
      const handle = await picker.call(window, {
        suggestedName: filename,
        types: [{ description: 'SQLite database', accept: { 'application/x-sqlite3': ['.sqlite', '.db'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return {
        status: 'saved',
        method: 'file-picker',
        filename: handle.name,
        size: bytes.byteLength,
        location: `المجلد الذي اخترته — ${handle.name}`,
      }
    } catch (error) {
      if (isUserCancel(error)) {
        return {
          status: 'cancelled',
          method: 'file-picker',
          filename,
          size: bytes.byteLength,
          location: '—',
          note: 'تم إلغاء الحفظ ولم يتم إنشاء أي ملف.',
        }
      }
      // Any other picker failure: fall through to the plain download below.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return {
    status: 'saved',
    method: 'browser-download',
    filename,
    size: bytes.byteLength,
    location: 'مجلد التنزيلات (Downloads) في هذا المتصفح',
    note: 'هذا المتصفح لا يسمح باختيار المجلد. لتغيير المكان فعّل «اسأل عن مكان الحفظ» من إعدادات التنزيلات.',
  }
}

/* ------------------------------- Public ------------------------------ */

/**
 * Creates a backup of the live database and saves it where the user can find
 * it. Always resolves with the exact location (or `cancelled`).
 */
export async function saveBackupFile(filename = buildBackupFilename()): Promise<BackupSaveResult> {
  await assertDatabaseIntegrity()
  const bytes = await exportDatabaseBytes()
  assertSqliteBytes(bytes)

  if (window.taybaBackup?.saveAs) return saveOnElectron(bytes, filename)
  if (Capacitor.isNativePlatform()) return saveOnAndroid(bytes, filename)
  return saveInBrowser(bytes, filename)
}
