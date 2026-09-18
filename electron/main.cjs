const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { buildMachineId, getStatus, activateWithKey } = require('./license.cjs')
const { listWindowsPrinters, rawPrint } = require('./device.cjs')

const isDev = !app.isPackaged
const appIconPath = process.platform === 'win32'
  ? path.join(__dirname, '..', 'resources', 'icon.ico')
  : path.join(__dirname, '..', 'resources', 'icon.png')

const licenseDir = () => app.getPath('userData')
const anchorFile = () => path.join(licenseDir(), '.tayba-anchor')
const licenseFile = () => path.join(licenseDir(), '.tayba-license')
const trialFile = () => path.join(licenseDir(), '.tayba-trial')
const backupDir = () => path.join(licenseDir(), 'backups')

function getOrCreateAnchor() {
  try { return fs.readFileSync(anchorFile(), 'utf8').trim() } catch {
    const anchor = crypto.randomUUID()
    try { fs.mkdirSync(licenseDir(), { recursive: true }); fs.writeFileSync(anchorFile(), anchor, 'utf8') } catch { /* best effort */ }
    return anchor
  }
}

function getMachineId() { return buildMachineId(getOrCreateAnchor()) }
function getLicenseStatus() { return getStatus({ licenseFile: licenseFile(), trialFile: trialFile(), machineId: getMachineId() }) }

ipcMain.handle('license:get-status', () => getLicenseStatus())
ipcMain.handle('license:get-saved-code', () => {
  try { return JSON.parse(fs.readFileSync(licenseFile(), 'utf8')).key || null } catch { return null }
})
ipcMain.handle('license:activate-with-key', (_event, key) => activateWithKey(key, { licenseFile: licenseFile(), machineId: getMachineId() }))


function safeBackupName(name) {
  const fallback = `tayba-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`
  const candidate = typeof name === 'string' ? path.basename(name) : ''
  return /^tayba-backup-[0-9TZ._-]+\.sqlite$/i.test(candidate) ? candidate : fallback
}

ipcMain.handle('backup:save', (_event, payload) => {
  if (!payload || !payload.bytes) throw new Error('بيانات النسخة الاحتياطية غير صالحة')
  const bytes = Buffer.from(payload.bytes)
  if (bytes.length < 100 || bytes.subarray(0, 16).toString('utf8') !== 'SQLite format 3\u0000') {
    throw new Error('ملف النسخة الاحتياطية ليس SQLite صالحًا')
  }
  fs.mkdirSync(backupDir(), { recursive: true })
  const filename = safeBackupName(payload.filename)
  const target = path.join(backupDir(), filename)
  fs.writeFileSync(target, bytes, { flag: 'wx' })
  return { filename, path: target, size: bytes.length }
})

ipcMain.handle('backup:list', () => {
  fs.mkdirSync(backupDir(), { recursive: true })
  return fs.readdirSync(backupDir(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^tayba-backup-.*\.sqlite$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(backupDir(), entry.name)
      const stat = fs.statSync(fullPath)
      return { filename: entry.name, size: stat.size, createdAt: stat.birthtime.toISOString(), updatedAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
})

ipcMain.handle('backup:delete', (_event, filename) => {
  const safeName = safeBackupName(filename)
  const target = path.join(backupDir(), safeName)
  if (!fs.existsSync(target)) throw new Error('النسخة الاحتياطية غير موجودة')
  fs.unlinkSync(target)
  return { ok: true }
})

ipcMain.handle('backup:open-folder', () => {
  fs.mkdirSync(backupDir(), { recursive: true })
  shell.openPath(backupDir())
  return backupDir()
})



ipcMain.handle('devices:list-printers', async () => listWindowsPrinters())

ipcMain.handle('devices:print-html', async (_event, payload) => {
  const name = String(payload?.printerName || '').trim()
  if (!name) throw new Error('اختر طابعة أولاً')
  const mode = payload?.mode === 'a4' ? 'a4' : 'receipt'
  const htmlBody = String(payload?.html || '').slice(0, 250000)
  if (!htmlBody) throw new Error('محتوى الطباعة فارغ')
  const bw = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  const html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:' + (mode === 'a4' ? 'A4' : '80mm auto') + ';margin:' + (mode === 'a4' ? '12mm' : '3mm') + '}body{margin:0;color:#111;font-size:12px;font-family:Arial,sans-serif}</style></head><body>' + htmlBody + '</body></html>'
  await new Promise((resolve, reject) => {
    bw.webContents.once('did-finish-load', resolve)
    bw.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(desc || String(code))))
    bw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
  try {
    await new Promise((resolve, reject) => bw.webContents.print({ deviceName: name, silent: true, printBackground: true }, success => success ? resolve() : reject(new Error('فشلت مهمة الطباعة'))))
  } finally { bw.destroy() }
  return { ok: true }
})

ipcMain.handle('devices:print-test', async (_event, payload) => {
  const name = String(payload?.printerName || '').trim()
  if (!name) throw new Error('اختر طابعة أولاً')
  const mode = payload?.mode === 'a4' ? 'a4' : 'receipt'
  const text = mode === 'a4'
    ? '<h1>KAYAN POS</h1><p>اختبار طباعة A4 ناجح.</p><p>التاريخ: ' + new Date().toLocaleString('ar-EG') + '</p>'
    : '<div style="width:72mm;font-family:Arial,sans-serif;text-align:center"><h2 style="margin:0">KAYAN</h2><p>اختبار طباعة الإيصال</p><p>' + new Date().toLocaleString('ar-EG') + '</p><hr/><p>هذه طباعة اختبار من KAYAN POS</p></div>'
  const bw = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await new Promise((resolve, reject) => {
    bw.webContents.once('did-finish-load', resolve)
    bw.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(desc || String(code))))
    const html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:' + (mode === 'a4' ? 'A4' : '80mm auto') + ';margin:' + (mode === 'a4' ? '12mm' : '3mm') + '}body{margin:0;color:#111;font-size:12px}</style></head><body>' + text + '</body></html>'
    bw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
  try {
    await new Promise((resolve, reject) => bw.webContents.print({ deviceName: name, silent: true, printBackground: true }, success => success ? resolve() : reject(new Error('فشلت مهمة الطباعة'))))
  } finally { bw.destroy() }
  return { ok: true }
})

ipcMain.handle('devices:open-drawer', async (_event, printerName) => {
  const name = String(printerName || '').trim()
  if (!name) throw new Error('اختر طابعة الإيصال أولاً')
  const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x32, 0x32])
  return rawPrint(name, pulse)
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#ffffff',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })

  Menu.setApplicationMenu(null)
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' } }
    return { action: 'allow' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
