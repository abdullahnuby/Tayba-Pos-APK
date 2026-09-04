'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { openNumericPad } from '@/components/numeric-pad'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Lock, User, Store, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface SetupProps {
  onSetupComplete: () => void
}

export function SetupSection({ onSetupComplete }: SetupProps) {
  const [form, setForm] = useState({
    username: 'admin',
    pin: '',
    name: 'المدير العام',
    storeName: 'طيبة',
    storeAddress: '',
    storePhone: '',
    vatEnabled: false,
    vatRate: 14,
  })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    document.getElementById('setup-pin')?.focus()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username || !form.pin || !form.name || !form.storeName) {
      toast.error('كل الحقول المطلوبة يجب أن تُملأ')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل الإعداد')
        return
      }
      toast.success('تم إعداد النظام! سجل دخول الآن.')
      onSetupComplete()
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  function next() {
    if (step === 1 && (!form.username || !form.pin || !form.name)) {
      toast.error('أكمل بيانات المدير')
      return
    }
    if (step === 1 && !/^\d{4}$/.test(form.pin)) {
      toast.error('PIN يجب أن يكون 4 أرقام بالضبط')
      return
    }
    if (step === 2 && !form.storeName) {
      toast.error('اسم المحل مطلوب')
      return
    }
    setStep(step + 1)
  }

  function back() {
    setStep(Math.max(1, step - 1))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-amber-50 dark:from-emerald-950/40 dark:via-background dark:to-amber-950/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center pb-6 pt-8">
            <img
              src="/tayba-logo.svg"
              alt="طيبة"
              className="mx-auto mb-4 size-20 rounded-3xl shadow-lg"
            />
            <CardTitle className="text-3xl font-bold tracking-tight">طيبة</CardTitle>
            <CardDescription className="text-base mt-1">
              الخطوة {step} من 3 — إعداد النظام لأول مرة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {/* Step 1: Admin user */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="size-4" /> بيانات المدير
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-username">اسم المستخدم *</Label>
                    <Input
                      id="setup-username"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-name">الاسم الكامل *</Label>
                    <Input
                      id="setup-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-pin">PIN الدخول *</Label>
                    <button
                      id="setup-pin"
                      type="button"
                      onClick={() => openNumericPad({ value: form.pin, title: 'PIN المدير — 4 أرقام', decimal: false, maxLength: 4, password: true, onCommit: (pin) => setForm({ ...form, pin }) })}
                      className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background text-xl font-black tracking-[0.55em]"
                      aria-label="إدخال PIN من 4 أرقام"
                    >
                      {form.pin ? '•'.repeat(form.pin.length) : 'أدخل PIN من 4 أرقام'}
                    </button>
                    <p className="text-xs text-muted-foreground">اسم المستخدم + PIN من 4 أرقام فقط. النظام يعمل بالكامل بدون إنترنت.</p>
                  </div>
                </div>
              )}

              {/* Step 2: Store info */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Store className="size-4" /> بيانات المحل
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-store">اسم المحل *</Label>
                    <Input
                      id="setup-store"
                      value={form.storeName}
                      onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-addr">العنوان</Label>
                    <Input
                      id="setup-addr"
                      value={form.storeAddress}
                      onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-phone">الهاتف</Label>
                    <Input
                      id="setup-phone"
                      value={form.storePhone}
                      onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: VAT settings */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Store className="size-4" /> إعدادات الضريبة (VAT)
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>تفعيل ضريبة القيمة المضافة</Label>
                      <p className="text-xs text-muted-foreground">14% في مصر — اختر "نعم" إذا كنت مسجلاً</p>
                    </div>
                    <Switch
                      checked={form.vatEnabled}
                      onCheckedChange={(c) => setForm({ ...form, vatEnabled: c })}
                    />
                  </div>
                  {form.vatEnabled && (
                    <div className="space-y-1.5">
                      <Label htmlFor="setup-vat">نسبة الضريبة (%)</Label>
                      <button type="button" id="setup-vat" className="flex h-12 w-full items-center justify-center rounded-xl border bg-background font-black" onClick={() => openNumericPad({ value: String(form.vatRate), title: 'نسبة الضريبة (%)', min: 0, max: 100, decimal: true, onCommit: v => setForm({ ...form, vatRate: Number(v) || 0 }) })}>{form.vatRate}</button>
                    </div>
                  )}
                  <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs">
                    <div className="flex items-center gap-1 mb-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" /> جاهز للإعداد
                    </div>
                    <p className="text-muted-foreground">
                      سيتم إنشاء حساب <b>{form.username}</b> كمدير عام باسم <b>{form.name}</b> لمحل <b>{form.storeName}</b>.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={back} className="flex-1">
                    السابق
                  </Button>
                )}
                {step < 3 ? (
                  <Button type="button" onClick={next} className="flex-1">
                    التالي
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <><Loader2 className="size-4 animate-spin" /> جارٍ الإعداد...</>
                    ) : (
                      <><CheckCircle2 className="size-4" /> إعداد النظام</>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
