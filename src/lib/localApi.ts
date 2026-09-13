// Local API dispatcher. This file used to contain every route inline (400+ lines);
// the actual route logic now lives in ./api/routes/*.ts, grouped by business domain
// (catalog, parties, sales, purchases, financial/accounting, admin, sync). Shared
// helpers (jsonResponse, currentUser, mapProduct, etc.) live in ./api/shared.ts.
// Adding a new feature area should mean adding a new file under ./api/routes/ and
// registering it in the `handlers` list below — not growing this file.
import { urlOf, currentUser, requireRole, jsonResponse, type RouteCtx } from './api/shared'
import { localRateLimit } from './security'
import { handleAuthRoutes } from './api/routes/auth-routes'
import { handleCatalogRoutes } from './api/routes/catalog-routes'
import { handlePartiesRoutes } from './api/routes/parties-routes'
import { handleSalesRoutes } from './api/routes/sales-routes'
import { handlePurchasesRoutes } from './api/routes/purchases-routes'
import { handleFinancialRoutes } from './api/routes/financial-routes'
import { handleAdminRoutes } from './api/routes/admin-routes'
import { handleSyncRoutes } from './api/routes/sync-routes'

// Order doesn't matter for correctness (each path belongs to exactly one domain),
// but keeping frequently-hit domains first avoids a few unnecessary checks per request.
const handlers = [
  handleCatalogRoutes,
  handlePartiesRoutes,
  handleSalesRoutes,
  handlePurchasesRoutes,
  handleFinancialRoutes,
  handleAdminRoutes,
  handleSyncRoutes,
]

async function route(req: Request) {
  const u = urlOf(req)
  const p = u.pathname.replace(/^\/api/, '') || '/'
  const method = req.method.toUpperCase()
  const user = await currentUser()
  const ipKey = req.headers.get('X-Device-Key') || 'local-device'
  const sensitive = p.startsWith('/auth/') || p === '/sync/google' || p === '/sync/restore' || p === '/sync/retry-failed'
  if (sensitive) {
    const rl = localRateLimit(`${ipKey}:${p}`, p.startsWith('/auth/') ? 8 : 20, 60_000)
    if (!rl.ok) return new Response(JSON.stringify({ error: 'محاولات كثيرة، حاول مرة أخرى لاحقًا', retryAfterMs: rl.retryAfterMs }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const ctx: RouteCtx = { req, u, p, method, user }

    // Auth routes run before the login gate below (setup/login/logout must work
    // while logged out).
    const authResult = await handleAuthRoutes(ctx)
    if (authResult) return authResult

    const authError = requireRole(user)
    if (authError) return authError

    for (const handler of handlers) {
      const result = await handler(ctx)
      if (result) return result
    }

    return jsonResponse({ error: `Unknown local API route: ${p}` }, 404)
  } catch (e) {
    console.error('[TAYBA_API_ERROR]', { path: p, method, error: e })
    return jsonResponse({ error: e instanceof Error ? e.message : 'خطأ غير متوقع', code: 'LOCAL_API_ERROR' }, 500)
  }
}

export function installLocalApi() {
  const original = window.fetch.bind(window)
  ;(window as any).__taybaOriginalFetch = original
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = urlOf(input)
    if (!u.pathname.startsWith('/api/')) return original(input as any, init)
    const req = new Request(u.toString(), { ...init, method: init?.method || 'GET', body: init?.body })
    return route(req)
  }
}
