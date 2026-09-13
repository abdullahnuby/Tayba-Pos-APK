'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Wallet, Plus, Trash2, RefreshCw, Building2, Users, Receipt, TrendingDown, TrendingUp, Target, HandCoins, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatEGP, todayISO, daysAgoISO } from '@/lib/format'

interface PnL {
  from: string; to: string
  revenue: number; cogs: number; grossProfit: number; grossMargin: number
  operatingExpenses: number; fixedExpenses: number; totalExpenses: number
  expensesByCategory: Array<{ category: string; type: string; total: number; count: number }>
  netProfit: number; netMargin: number
  budgetVsActual: Array<{ category: string; planned: number; actual: number; variance: number }>
}

interface RecurringExpense {
  id: string; name: string; category: string; amount: number; frequency: string
  day_of_month: number; active: number; note: string | null
}

interface OwnerTx {
  id: string; type: 'contribution' | 'withdrawal'; amount: number; date: string; note: string | null; balanceAfter: number
}
interface OwnerLedger { items: OwnerTx[]; totalContributions: number; totalWithdrawals: number; netBalance: number }

const EXPENSE_CATEGORIES = ['إيجار', 'مرتبات', 'كهرباء وماء', 'صيانة', 'تسويق وإعلان', 'نقل وشحن', 'اتصالات وإنترنت', 'ضرائب ورسوم', 'مصاريف أخرى']

function money(v: number) { return `${formatEGP(v)} ج.م` }

export function AccountingSection() {
  const qc = useQueryClient()
  const [from, setFrom] = useState(daysAgoISO(30))
  const [to, setTo] = useState(todayISO())
  const [applied, setApplied] = useState({ from: daysAgoISO(30), to: todayISO() })
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const pnlQ = useQuery<PnL>({
    queryKey: ['pnl', applied],
    queryFn: async () => {
      const r = await fetch(`/api/reports/pnl?from=${applied.from}&to=${applied.to}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل تحميل قائمة الدخل')
      return j
    },
  })

  const recurringQ = useQuery<{ items: RecurringExpense[] }>({
    queryKey: ['recurring-expenses'],
    queryFn: async () => (await fetch('/api/recurring-expenses')).json(),
  })
  const recurring = recurringQ.data?.items || []

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'إيجار', amount: '', dayOfMonth: '1', note: '' })

  const addRecurring = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/recurring-expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, category: form.category, amount: Number(form.amount), dayOfMonth: Number(form.dayOfMonth), note: form.note }),
      })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'فشل الحفظ'); return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-expenses'] })
      toast.success('تم إضافة المصروف الثابت — هيتسجل تلقائيًا كل شهر')
      setAddOpen(false)
      setForm({ name: '', category: 'إيجار', amount: '', dayOfMonth: '1', note: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleRecurring = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const r = await fetch(`/api/recurring-expenses/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      if (!r.ok) throw new Error((await r.json()).error || 'فشل التعديل')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error || 'فشل الحذف')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-expenses'] }); toast.success('تم حذف المصروف الثابت') },
    onError: (e: Error) => toast.error(e.message),
  })

  const generateDue = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/recurring-expenses/generate-due', { method: 'POST' })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'فشل'); return j
    },
    onSuccess: (j: { created: number }) => {
      qc.invalidateQueries({ queryKey: ['pnl'] })
      toast.success(j.created > 0 ? `تم تسجيل ${j.created} مصروف ثابت لهذا الشهر` : 'كل المصاريف الثابتة مسجلة بالفعل لهذا الشهر')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [budgetDraft, setBudgetDraft] = useState<Record<string, string>>({})
  const saveBudget = useMutation({
    mutationFn: async (category: string) => {
      const plannedAmount = Number(budgetDraft[category] || 0)
      const r = await fetch('/api/budgets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth: currentMonth, category, plannedAmount }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'فشل حفظ الميزانية')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pnl'] }); toast.success('تم حفظ الميزانية') },
    onError: (e: Error) => toast.error(e.message),
  })

  // ===== رأس المال والسحب الشخصي =====
  const ownerQ = useQuery<OwnerLedger>({
    queryKey: ['owner-transactions'],
    queryFn: async () => (await fetch('/api/owner-transactions')).json(),
  })
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [ownerForm, setOwnerForm] = useState({ type: 'contribution' as 'contribution' | 'withdrawal', amount: '', date: todayISO(), note: '' })

  const addOwnerTx = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/owner-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ownerForm.type, amount: Number(ownerForm.amount), date: ownerForm.date, note: ownerForm.note }),
      })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'فشل الحفظ'); return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-transactions'] })
      toast.success(ownerForm.type === 'contribution' ? 'تم تسجيل الإيداع' : 'تم تسجيل السحب')
      setOwnerOpen(false)
      setOwnerForm({ type: 'contribution', amount: '', date: todayISO(), note: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteOwnerTx = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/owner-transactions/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error || 'فشل الحذف')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owner-transactions'] }); toast.success('تم الحذف') },
    onError: (e: Error) => toast.error(e.message),
  })

  function apply() {
    if (!from || !to) return toast.error('اختر الفترة')
    if (from > to) return toast.error('من تاريخ يجب أن يسبق إلى تاريخ')
    setApplied({ from, to })
  }

  const d = pnlQ.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wallet className="size-6 text-primary" /> النظام المحاسبي</h2>
          <p className="text-sm text-muted-foreground mt-1">قائمة دخل فعلية: المبيعات ناقص تكلفة البضاعة ناقص كل المصاريف (إيجار، مرتبات، تشغيل) = صافي الربح الحقيقي</p>
        </div>
        <Button variant="outline" onClick={() => generateDue.mutate()} disabled={generateDue.isPending} className="gap-2">
          <RefreshCw className={generateDue.isPending ? 'size-4 animate-spin' : 'size-4'} /> ترحيل المصاريف الثابتة المستحقة
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div><label className="text-xs">من</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 h-11" /></div>
          <div><label className="text-xs">إلى</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 h-11" /></div>
          <Button className="h-11" onClick={apply} disabled={pnlQ.isFetching}><RefreshCw className={pnlQ.isFetching ? 'size-4 animate-spin' : 'size-4'} /> تطبيق</Button>
          <Button variant="outline" className="h-11" onClick={() => { const f = daysAgoISO(0); const s = `${new Date().toISOString().slice(0, 8)}01`; setFrom(s); setTo(f); setApplied({ from: s, to: f }) }}>الشهر الحالي</Button>
        </CardContent>
      </Card>

      {pnlQ.isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">جاري تحميل قائمة الدخل...</CardContent></Card>
        : pnlQ.isError ? <Card><CardContent className="p-8 text-center text-destructive">{pnlQ.error instanceof Error ? pnlQ.error.message : 'خطأ'}</CardContent></Card>
        : d && <>
          {/* ===== ملخص قائمة الدخل ===== */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardContent className="p-4"><small className="text-muted-foreground">صافي المبيعات</small><div className="mt-1 text-xl font-black">{money(d.revenue)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><small className="text-muted-foreground">تكلفة البضاعة (COGS)</small><div className="mt-1 text-xl font-black text-amber-600">{money(d.cogs)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><small className="text-muted-foreground">مجمل الربح</small><div className="mt-1 text-xl font-black">{money(d.grossProfit)} <span className="text-xs text-muted-foreground">({d.grossMargin}%)</span></div></CardContent></Card>
            <Card className={d.netProfit >= 0 ? 'border-emerald-200' : 'border-destructive'}><CardContent className="p-4"><small className="text-muted-foreground">صافي الربح الحقيقي</small><div className={`mt-1 text-xl font-black flex items-center gap-1 ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{d.netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{money(d.netProfit)} <span className="text-xs text-muted-foreground">({d.netMargin}%)</span></div></CardContent></Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card><CardContent className="p-4"><small className="text-muted-foreground">إجمالي المصاريف (تشغيلية + ثابتة)</small><div className="mt-1 text-lg font-black">{money(d.totalExpenses)}</div><div className="mt-1 text-xs text-muted-foreground">منها مصاريف ثابتة (إيجار/مرتبات): {money(d.fixedExpenses)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><small className="text-muted-foreground">المصاريف التشغيلية اليومية</small><div className="mt-1 text-lg font-black">{money(d.operatingExpenses)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="size-4" /> المصاريف حسب التصنيف</CardTitle></CardHeader>
            <CardContent>
              {d.expensesByCategory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد مصاريف مسجلة في هذه الفترة</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>التصنيف</TableHead><TableHead>النوع</TableHead><TableHead>العدد</TableHead><TableHead className="text-left">الإجمالي</TableHead></TableRow></TableHeader>
                  <TableBody>{d.expensesByCategory.map(e => (
                    <TableRow key={e.category + e.type}>
                      <TableCell className="font-medium">{e.category}</TableCell>
                      <TableCell><Badge variant={e.type === 'fixed' ? 'default' : 'outline'} className="text-xs">{e.type === 'fixed' ? 'ثابت' : e.type === 'shift' ? 'وردية' : 'تشغيلي'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.count}</TableCell>
                      <TableCell className="text-left font-bold">{money(e.total)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ===== الميزانية مقابل الفعلي ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> الميزانية مقابل الفعلي — {currentMonth}</CardTitle>
              <CardDescription>حدد ميزانية شهرية لكل تصنيف وقارنها بالمصروف الفعلي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {EXPENSE_CATEGORIES.map(cat => {
                const row = d.budgetVsActual.find(b => b.category === cat)
                return (
                  <div key={cat} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                    <div className="min-w-24 font-medium">{cat}</div>
                    <Input type="number" placeholder="الميزانية المخططة" className="h-9 w-40" defaultValue={row?.planned || ''} onChange={e => setBudgetDraft(s => ({ ...s, [cat]: e.target.value }))} />
                    <Button size="sm" variant="outline" onClick={() => saveBudget.mutate(cat)} disabled={saveBudget.isPending}>حفظ</Button>
                    {row && <div className="ms-auto flex items-center gap-3 text-xs">
                      <span>الفعلي: <b>{money(row.actual)}</b></span>
                      <Badge variant={row.variance >= 0 ? 'outline' : 'destructive'}>{row.variance >= 0 ? `متبقي ${money(row.variance)}` : `تجاوز ${money(Math.abs(row.variance))}`}</Badge>
                    </div>}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>}

      {/* ===== رأس المال والسحب الشخصي ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><HandCoins className="size-4" /> رأس المال والسحب الشخصي</CardTitle>
            <CardDescription>فلوسك اللي بتحطها في المشروع من مرتبك، وسحبك الشخصي للبيت — منفصلة عن مصاريف وإيرادات المحل</CardDescription>
          </div>
          <Dialog open={ownerOpen} onOpenChange={setOwnerOpen} modal={false}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> عملية جديدة</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>عملية إيداع أو سحب</DialogTitle><DialogDescription>سجّل أي فلوس بتحطها في المحل من جيبك، أو بتسحبها للاستخدام الشخصي</DialogDescription></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>نوع العملية</Label>
                  <Select value={ownerForm.type} onValueChange={v => setOwnerForm(s => ({ ...s, type: v as 'contribution' | 'withdrawal' }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contribution">إيداع في المشروع (من مرتبي)</SelectItem>
                      <SelectItem value="withdrawal">سحب شخصي (مصاريف البيت)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>القيمة</Label><Input type="number" value={ownerForm.amount} onChange={e => setOwnerForm(s => ({ ...s, amount: e.target.value }))} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={ownerForm.date} onChange={e => setOwnerForm(s => ({ ...s, date: e.target.value }))} /></div>
                </div>
                <div className="space-y-1.5"><Label>ملاحظات (اختياري)</Label><Input value={ownerForm.note} onChange={e => setOwnerForm(s => ({ ...s, note: e.target.value }))} placeholder="مثال: مرتب شهر 9" /></div>
              </div>
              <DialogFooter><Button onClick={() => addOwnerTx.mutate()} disabled={!ownerForm.amount || addOwnerTx.isPending}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {ownerQ.data && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card><CardContent className="p-4"><small className="text-muted-foreground">إجمالي الإيداعات من أول المشروع</small><div className="mt-1 text-lg font-black text-emerald-600">{money(ownerQ.data.totalContributions)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><small className="text-muted-foreground">إجمالي السحب الشخصي</small><div className="mt-1 text-lg font-black text-amber-600">{money(ownerQ.data.totalWithdrawals)}</div></CardContent></Card>
            <Card className={ownerQ.data.netBalance >= 0 ? 'border-emerald-200' : 'border-destructive'}><CardContent className="p-4"><small className="text-muted-foreground">{ownerQ.data.netBalance >= 0 ? 'صافي المستحق لك من المحل' : 'صافي المستحق منك للمحل'}</small><div className={`mt-1 text-lg font-black ${ownerQ.data.netBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(Math.abs(ownerQ.data.netBalance))}</div></CardContent></Card>
          </div>}
          {!ownerQ.data?.items.length ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد عمليات مسجلة بعد</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>النوع</TableHead><TableHead>القيمة</TableHead><TableHead>ملاحظات</TableHead><TableHead>الرصيد بعدها</TableHead><TableHead className="text-left">إجراءات</TableHead></TableRow></TableHeader>
              <TableBody>{ownerQ.data.items.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{t.date}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'contribution' ? 'default' : 'outline'} className="gap-1">
                      {t.type === 'contribution' ? <ArrowUpCircle className="size-3" /> : <ArrowDownCircle className="size-3" />}
                      {t.type === 'contribution' ? 'إيداع' : 'سحب شخصي'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">{money(t.amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.note || '—'}</TableCell>
                  <TableCell className={`text-xs font-bold ${t.balanceAfter >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(t.balanceAfter)}</TableCell>
                  <TableCell className="text-left"><Button variant="ghost" size="icon" onClick={() => deleteOwnerTx.mutate(t.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== المصاريف الثابتة (إيجار، مرتبات...) ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> المصاريف الثابتة الشهرية</CardTitle>
            <CardDescription>إيجار المحل، مرتبات الموظفين، اشتراكات — بتتسجل تلقائيًا كل شهر بدون ما تدخلها يدويًا</CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen} modal={false}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> مصروف ثابت جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>مصروف ثابت جديد</DialogTitle><DialogDescription>هيتم تسجيله تلقائيًا كل شهر في اليوم المحدد</DialogDescription></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>الاسم</Label><Input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="مثال: إيجار المحل / مرتب أحمد" /></div>
                <div className="space-y-1.5"><Label>التصنيف</Label>
                  <Select value={form.category} onValueChange={v => setForm(s => ({ ...s, category: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>القيمة الشهرية</Label><Input type="number" value={form.amount} onChange={e => setForm(s => ({ ...s, amount: e.target.value }))} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label>يوم الاستحقاق بالشهر</Label><Input type="number" min={1} max={28} value={form.dayOfMonth} onChange={e => setForm(s => ({ ...s, dayOfMonth: e.target.value }))} /></div>
                </div>
                <div className="space-y-1.5"><Label>ملاحظات (اختياري)</Label><Input value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button onClick={() => addRecurring.mutate()} disabled={!form.name || !form.amount || addRecurring.isPending}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد مصاريف ثابتة مسجلة — ابدأ بإضافة الإيجار والمرتبات</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>التصنيف</TableHead><TableHead>القيمة الشهرية</TableHead><TableHead>يوم الاستحقاق</TableHead><TableHead>مفعّل</TableHead><TableHead className="text-left">إجراءات</TableHead></TableRow></TableHeader>
              <TableBody>{recurring.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium flex items-center gap-1.5">{r.category === 'مرتبات' ? <Users className="size-3.5 text-muted-foreground" /> : <Building2 className="size-3.5 text-muted-foreground" />}{r.name}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell className="font-bold">{money(r.amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">يوم {r.day_of_month}</TableCell>
                  <TableCell><Switch checked={!!r.active} onCheckedChange={checked => toggleRecurring.mutate({ id: r.id, active: checked })} /></TableCell>
                  <TableCell className="text-left">
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>حذف {r.name}؟</AlertDialogTitle><AlertDialogDescription>لن يتم حذف المصاريف السابقة المسجلة، فقط إيقاف التكرار الشهري.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => deleteRecurring.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
