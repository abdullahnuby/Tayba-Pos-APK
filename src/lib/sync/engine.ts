import { getSetting } from '../settings'
import { getSyncStats } from './queue'
import { syncPending } from './google'

let running = false
let timer: number | null = null
let cleanupOnline: (() => void) | null = null

export async function runSyncNow() {
  if (running || !navigator.onLine) {
    return { sent: 0, synced: 0, failed: 0, message: 'غير متاح حاليًا' }
  }

  const enabled = (await getSetting('autoSyncEnabled')) !== 'false'
  const url = (await getSetting('appsScriptUrl'))?.trim() || ''
  const token = (await getSetting('appsScriptToken'))?.trim() || ''
  if (!enabled || !url || !token) {
    return { sent: 0, synced: 0, failed: 0, message: 'المزامنة غير مهيأة' }
  }

  running = true
  try {
    return await syncPending(25)
  } finally {
    running = false
  }
}

export async function getSyncStatus() {
  const stats = await getSyncStats()
  return {
    pending: (stats.pending || 0) + (stats.failed || 0),
    processing: stats.processing || 0,
    synced: stats.synced || 0,
  }
}

export function startAutoSync(intervalMs = 30_000) {
  if (timer !== null) return () => undefined

  const tick = () => {
    void runSyncNow()
  }

  window.addEventListener('online', tick)
  timer = window.setInterval(tick, intervalMs)
  cleanupOnline = () => window.removeEventListener('online', tick)
  void tick()

  return () => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    cleanupOnline?.()
    cleanupOnline = null
  }
}
