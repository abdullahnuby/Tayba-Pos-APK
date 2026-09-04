import { useCallback, useEffect, useState } from 'react'
import { LoginSection } from './components/login-section'
import { SetupSection } from './components/setup-section'
import { AppShell } from './components/app-shell'
import type { User } from './lib/types'
import { Component, type ErrorInfo, type ReactNode } from 'react'

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' }
  static getDerivedStateFromError(error: unknown) { return { hasError: true, message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' } }
  componentDidCatch(error: Error, _info: ErrorInfo) { console.error('Tayba POS render error', error) }
  render() {
    if (!this.state.hasError) return this.props.children
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-background"><div className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-lg"><div className="text-2xl font-black">حدث خطأ في الشاشة</div><p className="mt-2 text-sm text-muted-foreground">{this.state.message || 'تعذر عرض هذه الصفحة.'}</p><button className="mt-5 h-12 rounded-2xl bg-primary px-6 font-bold text-primary-foreground" onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}>إعادة تحميل</button></div></div>
  }
}

type View = 'loading' | 'setup' | 'login' | 'app'
interface SessionUser extends User { role: 'admin'|'manager'|'cashier' }

export default function App() {
  const [view, setView] = useState<View>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const checkSession = useCallback(async () => {
    try {
      const setup = await fetch('/api/auth/setup')
      const setupData = await setup.json()
      if (setupData.needsSetup) { setView('setup'); return }
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (res.ok && data.user) { setUser(data.user); setView('app') }
      else setView('login')
    } catch { setView('login') }
  }, [])
  useEffect(() => { void checkSession() }, [checkSession])
  if (view === 'loading') return <div className="min-h-screen flex items-center justify-center"><div className="size-8 animate-pulse rounded-full bg-primary/30" /></div>
  if (view === 'setup') return <SetupSection onSetupComplete={checkSession} />
  if (view === 'login' || !user) return <LoginSection onLogin={checkSession} />
  return <AppErrorBoundary><AppShell user={user} onLogout={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); setView('login') }} /></AppErrorBoundary>
}
