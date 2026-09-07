'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Lock, User } from 'lucide-react'
import { openNumericPad } from '@/components/numeric-pad'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface LoginProps { onLogin: () => void }

export function LoginSection({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)


  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !/^\d{4}$/.test(pin)) { toast.error('أدخل اسم المستخدم وPIN من 4 أرقام'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username, pin }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل تسجيل الدخول'); return }
      toast.success(`أهلاً ${data.name}!`)
      onLogin()
    } catch { toast.error('تعذر تسجيل الدخول محليًا') }
    finally { setLoading(false) }
  }

  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/50 via-background to-amber-50/30 dark:from-emerald-950/30 dark:via-background dark:to-amber-950/10 p-4">
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:'easeOut'}} className="w-full max-w-md">
      <Card className="shadow-2xl border-border/50">
        <CardHeader className="text-center pb-6 pt-8">
          <img src="/tayba-logo.svg" alt="طيبة" className="mx-auto mb-4 size-20 rounded-3xl shadow-lg" />
          <CardTitle className="text-3xl font-bold tracking-tight">طيبة</CardTitle>
          <CardDescription className="text-base mt-1">نظام إدارة المحلات — دخول محلي</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="login-username">اسم المستخدم</Label><div className="relative"><User className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input id="login-username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="اسم المستخدم" className="pr-9 h-12" autoComplete="username"/></div></div>
            <div className="space-y-2"><Label htmlFor="login-pin">PIN</Label><button type="button" id="login-pin" onClick={() => openNumericPad({ value: pin, title: 'PIN الدخول — 4 أرقام', decimal: false, maxLength: 4, password: true, onCommit: setPin })} className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background px-3 text-lg font-black tracking-[0.65em]" style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }} aria-label="إدخال PIN من 4 أرقام"><Lock className="me-2 size-5 text-muted-foreground" />{pin ? '•'.repeat(pin.length) : 'أدخل PIN من 4 أرقام'}</button><div className="mt-2 flex items-center justify-center gap-3" aria-label="حالة PIN">{[0,1,2,3].map(i => <span key={i} className={`size-3 rounded-full border-2 ${pin.length>i ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-transparent'}`} />)}</div><p className="text-xs text-muted-foreground">اسم المستخدم + PIN من 4 أرقام فقط، ويعمل بدون إنترنت.</p></div>
            <Button type="submit" className="w-full h-14 text-base font-bold rounded-2xl" disabled={loading || !/^\d{4}$/.test(pin)}>{loading ? <><Loader2 className="size-5 animate-spin"/> جارٍ الدخول...</> : 'دخول'}</Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  </div>
}
