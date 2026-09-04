import { getSetting } from '../settings'
import {
  getPendingSyncItems,
  markSyncFailed,
  markSyncProcessing,
  markSyncSucceeded,
  resetStaleProcessing,
  type SyncQueueItem,
} from './queue'

type SyncResponse = {
  ok?: boolean
  error?: string
  results?: Array<{ id: string; ok: boolean; error?: string }>
}

async function send(items: SyncQueueItem[]) {
  const url = (await getSetting('appsScriptUrl'))?.trim() || ''
  const token = (await getSetting('appsScriptToken'))?.trim() || ''
  if (!url) throw new Error('رابط Google Apps Script غير مضبوط')
  if (!token) throw new Error('رمز Google Apps Script غير مضبوط')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const operations = items.map((item) => ({
      id: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      operation: item.operation,
      createdAt: item.created_at,
      payload: JSON.parse(item.payload),
    }))

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify({ action: 'sync', token, operations }),
      signal: controller.signal,
    })

    const body = (await res.json().catch(() => ({}))) as SyncResponse
    if (!res.ok || body.ok !== true) {
      throw new Error(body.error || `Google Apps Script HTTP ${res.status}`)
    }

    return body.results || items.map((item) => ({ id: item.id, ok: true }))
  } finally {
    clearTimeout(timer)
  }
}

export async function syncPending(limit = 25) {
  await resetStaleProcessing()
  const items = await getPendingSyncItems(limit)
  if (!items.length) {
    return { sent: 0, synced: 0, failed: 0, message: 'لا توجد عمليات معلقة' }
  }

  const ids = items.map((item) => item.id)
  await markSyncProcessing(ids)

  try {
    const results = await send(items)
    const succeeded = results.filter((item) => item.ok).map((item) => item.id)
    const failed = results.filter((item) => !item.ok)

    await markSyncSucceeded(succeeded)
    if (failed.length) {
      await markSyncFailed(
        failed.map((item) => item.id),
        (failed[0] && 'error' in failed[0] ? failed[0].error : undefined) || 'فشل مزامنة بعض العمليات',
      )
    }

    return {
      sent: items.length,
      synced: succeeded.length,
      failed: failed.length,
      message: failed.length ? 'تمت المزامنة جزئيًا' : 'تمت المزامنة بنجاح',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر الاتصال بخدمة المزامنة'
    await markSyncFailed(ids, message)
    return {
      sent: items.length,
      synced: 0,
      failed: items.length,
      message,
    }
  }
}
