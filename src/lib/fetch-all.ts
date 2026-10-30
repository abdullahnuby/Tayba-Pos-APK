export interface CompleteList<T> {
  items: T[]
  total: number
}

/**
 * Read every page of a paged local API list.
 *
 * The API intentionally caps pageSize at 200 to keep responses predictable.
 * Asking for 500/1000 does not disable that cap, so screens that need the full
 * catalogue must follow the returned page/total contract instead of assuming a
 * single response contains every product.
 */
export async function fetchAllPagedItems<T>(
  path: string,
  pageSize = 200,
): Promise<CompleteList<T>> {
  const safePageSize = Math.max(1, Math.min(Math.floor(pageSize) || 200, 200))
  const [pathname, rawQuery = ''] = path.split('?', 2)
  const params = new URLSearchParams(rawQuery)
  params.set('pageSize', String(safePageSize))

  const items: T[] = []
  let total = Number.POSITIVE_INFINITY

  for (let page = 1; page <= 100; page += 1) {
    params.set('page', String(page))
    const response = await fetch(`${pathname}?${params.toString()}`)
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        payload?.error || `تعذر تحميل القائمة (HTTP ${response.status})`,
      )
    }

    if (!payload || !Array.isArray(payload.items)) {
      throw new Error('استجابة القائمة غير صالحة؛ لم يتم اعتماد بيانات ناقصة.')
    }

    const pageItems = payload.items as T[]
    const serverTotal = Number(payload.total)
    if (Number.isFinite(serverTotal) && serverTotal >= 0) total = serverTotal

    items.push(...pageItems)

    if (pageItems.length === 0 || items.length >= total || pageItems.length < safePageSize) {
      return { items, total: Number.isFinite(total) ? total : items.length }
    }
  }

  throw new Error('تجاوزت القائمة الحد الآمن لعدد الصفحات؛ لم يتم اعتماد نتائج ناقصة.')
}
