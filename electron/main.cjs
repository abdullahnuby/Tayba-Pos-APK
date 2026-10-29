const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

function smokeLog(stage, details = {}) {
  if (process.env.KAYAN_SMOKE_TEST !== '1' || !process.env.KAYAN_SMOKE_RESULT_PATH) return
  try {
    fs.appendFileSync(process.env.KAYAN_SMOKE_RESULT_PATH + '.log', JSON.stringify({
      at: new Date().toISOString(), stage, ...details,
    }) + '\n', 'utf8')
  } catch (error) {
    try { process.stderr.write('[KAYAN_SMOKE_TEST] ' + String(error) + '\n') } catch {}
  }
}

smokeLog('electron-main-module-loaded', { platform: process.platform, version: process.versions.electron })
if (process.env.KAYAN_SMOKE_TEST === '1') {
  process.on('uncaughtException', (error) => {
    smokeLog('uncaught-exception', { message: error?.message, stack: error?.stack })
    try { process.stderr.write(String(error?.stack || error) + '\n') } catch {}
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    smokeLog('unhandled-rejection', { reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason) })
  })
}
const { buildMachineId, getStatus, activateWithKey } = require('./license.cjs')
const { listWindowsPrinters, rawPrint } = require('./device.cjs')

const isDev = !app.isPackaged
const isSmokeTest = process.env.KAYAN_SMOKE_TEST === '1'
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

// "Save as": the user picks the folder and file name in a native dialog.
// Returns { canceled: true } when the dialog is dismissed, otherwise the real
// path that was written and its verified size.
ipcMain.handle('backup:save-as', async (event, payload) => {
  if (!payload || !payload.bytes) throw new Error('بيانات النسخة الاحتياطية غير صالحة')
  const bytes = Buffer.from(payload.bytes)
  if (bytes.length < 100 || bytes.subarray(0, 16).toString('utf8') !== 'SQLite format 3\u0000') {
    throw new Error('ملف النسخة الاحتياطية ليس SQLite صالحًا')
  }
  const suggested = safeBackupName(payload.filename)
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined
  const result = await dialog.showSaveDialog(owner, {
    title: 'اختر مكان حفظ النسخة الاحتياطية',
    defaultPath: path.join(app.getPath('documents'), suggested),
    buttonLabel: 'حفظ النسخة',
    filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }],
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  fs.writeFileSync(result.filePath, bytes)
  const written = fs.statSync(result.filePath).size
  if (written !== bytes.length) throw new Error('لم يكتمل حفظ الملف، أعد المحاولة أو اختر مكانًا آخر')
  return { canceled: false, filename: path.basename(result.filePath), path: result.filePath, size: written }
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
  const pageCss = '@page{size:' + (mode === 'a4' ? 'A4' : '80mm auto') + ';margin:' + (mode === 'a4' ? '12mm' : '3mm') + '}body{margin:0;color:#111;font-size:12px;font-family:Arial,sans-serif}'
  const isFullDocument = /<html[\s>]/i.test(htmlBody)
  let html
  if (isFullDocument) {
    // The UI currently sends a complete HTML document, not only a body fragment.
    // Inject print rules into its head instead of nesting <html>/<head>/<body> tags.
    const printRules = '<style id="kayan-native-print-rules">' + pageCss + '</style>'
    if (/<\/head>/i.test(htmlBody)) {
      html = htmlBody.replace(/<\/head>/i, printRules + '</head>')
    } else {
      html = htmlBody.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8">' + printRules + '</head>')
    }
  } else {
    html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>' + pageCss + '</style></head><body>' + htmlBody + '</body></html>'
  }
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
  smokeLog('create-window-start')
  const win = new BrowserWindow({
    show: !isSmokeTest,
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
  smokeLog('browser-window-created', { isSmokeTest })
  win.webContents.on('render-process-gone', (_event, details) => smokeLog('render-process-gone', details))
  win.webContents.on('console-message', (_event, details) => { if (details.level >= 2) smokeLog('renderer-console-error', { message: details.message, line: details.lineNumber, source: details.sourceId }) })
  if (isSmokeTest) {
    let smokeFinished = false
    let smokeTimeout
    const finishSmokeTest = (result) => {
      if (smokeFinished) return
      smokeFinished = true
      if (smokeTimeout) clearTimeout(smokeTimeout)
      const report = { ...result, testedAt: new Date().toISOString() }
      try {
        if (process.env.KAYAN_SMOKE_RESULT_PATH) fs.writeFileSync(process.env.KAYAN_SMOKE_RESULT_PATH, JSON.stringify(report, null, 2), 'utf8')
      } catch (error) {
        console.error('[KAYAN_SMOKE_TEST] Could not write report:', error)
        app.exit(1)
        return
      }
      app.exit(report.ok ? 0 : 1)
    }
    smokeTimeout = setTimeout(() => finishSmokeTest({ ok: false, stage: 'timeout', reason: 'Renderer did not complete the startup smoke test within 25 seconds' }), 25000)
    win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      smokeLog('did-fail-load', { errorCode, errorDescription, url: validatedURL, isMainFrame })
      if (isMainFrame !== false) finishSmokeTest({ ok: false, stage: 'did-fail-load', errorCode, errorDescription, url: validatedURL })
    })
    win.webContents.once('did-finish-load', async () => {
      smokeLog('did-finish-load')
      try {
        const result = await win.webContents.executeJavaScript("new Promise((resolve) => {\n  const started = Date.now();\n  const inspect = () => {\n    const root = document.getElementById('root');\n    const text = (root?.innerText || '').trim();\n    const setupMarker = Boolean(document.querySelector('#setup-pin')) && text.includes('إعداد النظام لأول مرة');\n    const brandImages = Array.from(document.querySelectorAll('.kayan-brand__logo, .kayan-mark__image'));\n    const imagesLoaded = brandImages.every((image) => image.complete);\n    const brokenBrandAssets = brandImages.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src);\n    if (setupMarker && imagesLoaded) {\n      resolve({ ok: brokenBrandAssets.length === 0, title: document.title, marker: 'setup-pin-button', rootChildren: root?.children.length || 0, brokenBrandAssets, reason: brokenBrandAssets.length ? 'KAYAN brand assets failed to load' : undefined, text: text.slice(0, 400) });\n      return;\n    }\n    if (Date.now() - started >= 15000) {\n      resolve({ ok: false, title: document.title, marker: null, rootChildren: root?.children.length || 0, brokenBrandAssets, reason: 'First-run setup screen did not render or KAYAN brand assets did not load', text: text.slice(0, 600) });\n      return;\n    }\n    setTimeout(inspect, 100);\n  };\n  inspect();\n})")
        finishSmokeTest({ ...result, stage: 'renderer-ui' })
      } catch (error) {
        finishSmokeTest({ ok: false, stage: 'renderer-evaluation', reason: error instanceof Error ? error.message : String(error) })
      }
    })
  }
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    smokeLog('load-file-requested', { path: path.join(__dirname, '..', 'dist', 'index.html'), exists: fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html')) })
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
