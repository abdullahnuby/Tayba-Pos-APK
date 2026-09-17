// Narrow Electron bridge. No Node/fs/network APIs are exposed to the renderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('taybaLicense', {
  getStatus: () => ipcRenderer.invoke('license:get-status'),
  getSavedCode: () => ipcRenderer.invoke('license:get-saved-code'),
  activateWithKey: (licenseKey) => ipcRenderer.invoke('license:activate-with-key', licenseKey),
})


contextBridge.exposeInMainWorld('taybaBackup', {
  save: (bytes, filename) => ipcRenderer.invoke('backup:save', { bytes, filename }),
  list: () => ipcRenderer.invoke('backup:list'),
  remove: (filename) => ipcRenderer.invoke('backup:delete', filename),
  openFolder: () => ipcRenderer.invoke('backup:open-folder'),
})

contextBridge.exposeInMainWorld('taybaDevices', {
  listPrinters: () => ipcRenderer.invoke('devices:list-printers'),
  printTest: (printerName, mode) => ipcRenderer.invoke('devices:print-test', { printerName, mode }),
  printHtml: (printerName, html, mode) => ipcRenderer.invoke('devices:print-html', { printerName, html, mode }),
  openDrawer: (printerName) => ipcRenderer.invoke('devices:open-drawer', printerName),
})
