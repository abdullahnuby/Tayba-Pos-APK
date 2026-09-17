/// <reference types="vite/client" />

declare module '*.sql?raw' {
  const content: string
  export default content
}


declare global {
  interface Window {
    taybaDevices?: {
      listPrinters: () => Promise<Array<{ name: string; isDefault: boolean; workOffline: boolean; status: number; portName: string; driverName: string }>>
      printTest: (printerName: string, mode: 'receipt' | 'a4') => Promise<{ ok: boolean }>
      printHtml: (printerName: string, html: string, mode: 'receipt' | 'a4') => Promise<{ ok: boolean }>
      openDrawer: (printerName: string) => Promise<{ ok: boolean }>
    }
    taybaBackup?: {
      save: (bytes: Uint8Array, filename?: string) => Promise<{ filename: string; path: string; size: number }>
      list: () => Promise<Array<{ filename: string; size: number; createdAt: string; updatedAt: string }>>
      remove: (filename: string) => Promise<{ ok: boolean }>
      openFolder: () => Promise<string>
    }
  }
}

export {}
