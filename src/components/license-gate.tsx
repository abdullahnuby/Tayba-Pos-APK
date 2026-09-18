import { useEffect, useState } from 'react'
import { KayanMark } from '@/components/kayan-brand'

type LicenseStatus = {
  state: 'trial' | 'active' | 'expired'
  type: 'trial' | 'lifetime'
  machineId?: string
  expiresAt?: string
  daysLeft?: number
  reason?: string
}

declare global {
  interface Window {
    taybaLicense?: {
      getStatus: () => Promise<LicenseStatus>
      getSavedCode: () => Promise<string | null>
      activateWithKey: (licenseKey: string) => Promise<{ ok: boolean; error?: string; type?: string }>
    }
  }
}

export function isDesktopBuild() {
  return typeof window !== 'undefined' && !!window.taybaLicense
}

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showActivation, setShowActivation] = useState(false)

  useEffect(() => {
    const api = window.taybaLicense
    if (!api) { setStatus({ state: 'active', type: 'lifetime' }); return }
    void api.getStatus().then(setStatus).catch(() => setStatus({ state: 'expired', type: 'trial' }))
  }, [])

  if (!status) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="size-8 animate-pulse rounded-full bg-primary/30" /></div>
  if (status.state === 'active') return <>{children}</>

  const days = status.daysLeft ?? 0

  const activate = async () => {
    if (!window.taybaLicense || busy || !key.trim()) return
    setBusy(true); setError('')
    try {
      const result = await window.taybaLicense.activateWithKey(key.trim())
      if (!result.ok) throw new Error(result.error || 'كود الترخيص غير صالح')
      setStatus(await window.taybaLicense.getStatus())
      setShowActivation(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تفعيل الترخيص')
    } finally { setBusy(false) }
  }

  if (status.state === 'trial' && !showActivation) {
    return (
      <>
        {children}
        <div dir="rtl" className="fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{days}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-black">الفترة التجريبية المجانية</div><div className="truncate text-xs text-muted-foreground">متبقي {days} يوم — يمكنك الترقية للترخيص الدائم في أي وقت.</div></div>
          <button onClick={() => setShowActivation(true)} className="h-10 shrink-0 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground">ترقية</button>
        </div>
      </>
    )
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-xl">
        <KayanMark className="mx-auto mb-4 size-16" />
        <h1 className="text-2xl font-black">تفعيل KAYAN POS</h1>
        <p className="mt-2 text-sm text-muted-foreground">أدخل كود الترخيص الدائم الذي حصلت عليه بعد الشراء.</p>
        <input dir="ltr" value={key} onChange={e => setKey(e.target.value)} placeholder="License Key" className="mt-6 h-14 w-full rounded-2xl border bg-background px-4 text-center font-mono text-xs outline-none focus:border-primary" />
        {error && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</div>}
        {status.state === 'expired' && <div className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm font-bold text-amber-700">انتهت الفترة التجريبية. لن يتم حذف بياناتك؛ فعّل الترخيص الدائم للمتابعة بنفس قاعدة البيانات.</div>}
        <button onClick={() => void activate()} disabled={busy || !key.trim()} className="mt-5 h-12 w-full rounded-2xl bg-primary font-black text-primary-foreground disabled:opacity-50">{busy ? 'جاري التحقق...' : 'تفعيل دائم'}</button>
        {status.state === 'trial' && <button onClick={() => setShowActivation(false)} className="mt-3 h-11 w-full rounded-2xl border font-bold">العودة للبرنامج ({days} يوم)</button>}
        <p className="mt-5 text-[11px] text-muted-foreground">معرّف الجهاز: <span dir="ltr" className="font-mono">{status.machineId || '—'}</span></p>
      </div>
    </div>
  )
}
