import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedBasics } from '../../__tests__/fixtures'

const cap = vi.hoisted(() => ({ native: false }))
const fs = vi.hoisted(() => ({
  writeFile: vi.fn(), stat: vi.fn(), rmdir: vi.fn(), requestPermissions: vi.fn(),
}))
const share = vi.hoisted(() => ({ share: vi.fn(), canShare: vi.fn() }))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => cap.native } }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' } }))
vi.mock('@capacitor/share', () => ({ Share: share }))

import { saveBackupFile, assertSqliteBytes } from '../backupFileService'

const w = window as any

beforeEach(async () => {
  await seedBasics()
  cap.native = false
  delete w.taybaBackup
  delete w.showSaveFilePicker
  Object.values(fs).forEach(f => f.mockReset())
  Object.values(share).forEach(f => f.mockReset())
})
afterEach(() => { delete w.taybaBackup; delete w.showSaveFilePicker })

describe('assertSqliteBytes', () => {
  it('rejects empty and non-SQLite files', () => {
    expect(() => assertSqliteBytes(new Uint8Array(10))).toThrow()
    expect(() => assertSqliteBytes(new Uint8Array(500).fill(65))).toThrow(/SQLite/)
  })
})

describe('saveBackupFile — Windows (Electron)', () => {
  it('uses the native Save As dialog and reports the real path', async () => {
    const saveAs = vi.fn(async (bytes: Uint8Array, name: string) => ({ canceled: false, filename: name, path: 'D:\\Backups\\' + name, size: bytes.byteLength }))
    w.taybaBackup = { saveAs }
    const r = await saveBackupFile('tayba-backup-test.sqlite')
    expect(r.status).toBe('saved')
    expect(r.location).toBe('D:\\Backups\\tayba-backup-test.sqlite')
    expect(saveAs).toHaveBeenCalledOnce()
    expect(new TextDecoder().decode(saveAs.mock.calls[0][0].subarray(0, 15))).toBe('SQLite format 3')
  })
  it('reports cancel when the dialog is dismissed', async () => {
    w.taybaBackup = { saveAs: vi.fn(async () => ({ canceled: true })) }
    expect((await saveBackupFile()).status).toBe('cancelled')
  })
})

describe('saveBackupFile — browser', () => {
  it('writes the exact bytes through the file picker', async () => {
    const chunks: Blob[] = []
    w.showSaveFilePicker = vi.fn(async () => ({ name: 'mine.sqlite', createWritable: async () => ({ write: async (b: Blob) => { chunks.push(b) }, close: async () => {} }) }))
    const r = await saveBackupFile('tayba-backup-x.sqlite')
    expect(r.method).toBe('file-picker')
    expect(r.filename).toBe('mine.sqlite')
    expect(chunks[0].size).toBe(r.size)
  })
  it('treats picker AbortError as cancel, not failure', async () => {
    w.showSaveFilePicker = vi.fn(async () => { throw new DOMException('x', 'AbortError') })
    expect((await saveBackupFile()).status).toBe('cancelled')
  })
})

describe('saveBackupFile — Android', () => {
  beforeEach(() => {
    cap.native = true
    fs.writeFile.mockImplementation(async ({ directory, path }: any) => ({ uri: `file://${directory}/${path}` }))
    fs.stat.mockImplementation(async () => ({ size: -1 }))
    fs.rmdir.mockResolvedValue(undefined)
    fs.requestPermissions.mockResolvedValue({})
    share.canShare.mockResolvedValue({ value: true })
    share.share.mockResolvedValue({})
  })

  it('saves to Documents/TaybaPOS/Backups, verifies size, and opens the share sheet', async () => {
    fs.stat.mockImplementation(async () => ({ size: fs.writeFile.mock.calls.find(c => c[0].directory === 'DOCUMENTS')![0].data.length ? realSize() : 0 }))
    function realSize() { return atobLen(fs.writeFile.mock.calls.find(c => c[0].directory === 'DOCUMENTS')![0].data) }
    const r = await saveBackupFile('tayba-backup-a.sqlite')
    expect(r.status).toBe('saved')
    expect(r.location).toBe('Documents/TaybaPOS/Backups/tayba-backup-a.sqlite')
    expect(share.share).toHaveBeenCalledOnce()
    expect(share.share.mock.calls[0][0].files[0]).toContain('CACHE')
  })

  it('falls back to the share sheet when Documents is refused', async () => {
    fs.writeFile.mockImplementation(async ({ directory, path }: any) => {
      if (directory === 'DOCUMENTS') throw new Error('denied')
      return { uri: `file://${directory}/${path}` }
    })
    const r = await saveBackupFile('tayba-backup-b.sqlite')
    expect(r.status).toBe('shared')
  })

  it('says nothing was saved if Documents failed and the user cancelled sharing', async () => {
    fs.writeFile.mockImplementation(async ({ directory, path }: any) => {
      if (directory === 'DOCUMENTS') throw new Error('denied')
      return { uri: `file://${directory}/${path}` }
    })
    share.share.mockRejectedValue(new Error('Share canceled'))
    expect((await saveBackupFile()).status).toBe('cancelled')
  })
})

function atobLen(b64: string) { return atob(b64).length }
