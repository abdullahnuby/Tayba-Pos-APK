'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, Pencil, Plus, Search, Trash2, User, Users, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatEGP } from '@/lib/format'
import { EmptyState } from '@/components/empty-state'

interface Customer {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  notes?: string | null
  balance: number
  loyaltyPoints: number
  _count?: { sales: number }
  totalPurchases?: number
}

type CustomerForm = { name: string; phone: string; address: string; notes: string }

const EMPTY_FORM: CustomerForm = { name: '', phone: '', address: '', notes: '' }

export function CustomersSection() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)

  const customersQuery = useQuery<Customer[] | { items?: Customer[] }>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers')
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل العملاء')
      if (!Array.isArray(payload) && !Array.isArray(payload?.items)) {
        throw new Error('استجابة قائمة العملاء غير صالحة')
      }
      return payload
    },
  })

  const customers: Customer[] = Array.isArray(customersQuery.data)
    ? customersQuery.data
    : (customersQuery.data?.items ?? [])

  const summary = useMemo(() => customers.reduce((value, customer) => ({
    count: value.count + 1,
    receivables: value.receivables + Math.max(0, Number(customer.balance || 0)),
    purchases: value.purchases + Number(customer.totalPurchases || 0),
    loyalty: value.loyalty + Number(customer.loyaltyPoints || 0),
  }), { count: 0, receivables: 0, purchases: 0, loyalty: 0 }), [customers])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return customers
    return customers.filter(customer =>
      customer.name.toLocaleLowerCase().includes(query) ||
      String(customer.phone || '').includes(query) ||
      String(customer.address || '').toLocaleLowerCase().includes(query),
    )
  }, [customers, search])

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/customers/${editing.id}` : '/api/customers'
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim(), phone: form.phone.trim() || null }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'فشل حفظ بيانات العميل')
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setOpen(false)
      toast.success(editing ? 'تم تحديث بيانات العميل' : 'تمت إضافة العميل')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'فشل حذف العميل')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('تم حذف العميل')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function start(customer?: Customer) {
    setEditing(customer || null)
    setForm(customer ? {
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    } : EMPTY_FORM)
    setOpen(true)
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight">العملاء</h2>
          <p className="text-xs text-muted-foreground">ملف موحد لكل عميل: المشتريات، الرصيد، ونقاط الولاء.</p>
        </div>
        <Button className="h-9 rounded-lg px-3 text-sm" onClick={() => start()}>
          <Plus className="me-1 size-4" /> عميل جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">عدد العملاء</p><p className="mt-1 text-xl font-black tabular-nums">{summary.count.toLocaleString('en-US')}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">أرصدة العملاء المستحقة</p><p className="mt-1 text-lg font-black tabular-nums">{formatEGP(summary.receivables)} ج</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">إجمالي مشتريات العملاء</p><p className="mt-1 text-lg font-black tabular-nums">{formatEGP(summary.purchases)} ج</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">نقاط الولاء القائمة</p><p className="mt-1 text-xl font-black tabular-nums">{summary.loyalty.toLocaleString('en-US')}</p></CardContent></Card>
      </div>

      <Card className="kayan-search-shell"><CardContent className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 rounded-lg border-0 bg-secondary/45 pe-10 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو العنوان" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{filtered.length} عميل ظاهر من أصل {customers.length}</span>
          {search && <button type="button" className="font-bold text-primary" onClick={() => setSearch('')}>مسح البحث</button>}
        </div>
      </CardContent></Card>

      {customersQuery.isError && <Card className="border-destructive/40 bg-destructive/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-3"><div><p className="text-sm font-bold text-destructive">تعذر تحديث قائمة العملاء</p><p className="mt-1 text-xs text-muted-foreground">{customersQuery.error instanceof Error ? customersQuery.error.message : 'حدث خطأ أثناء قراءة العملاء.'}</p></div><Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => void customersQuery.refetch()}><RefreshCw className="me-1 size-3.5"/> إعادة المحاولة</Button></CardContent></Card>}

      {customersQuery.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : customersQuery.isError && !customersQuery.data ? (
        <EmptyState title="تعذر تحميل العملاء" description="أعد المحاولة. لم يتم تغيير أي بيانات." icon={Users} />
      ) : filtered.length === 0 ? (
        <EmptyState title={search ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء بعد'} description={search ? 'جرّب البحث باسم أو رقم هاتف مختلف.' : 'أضف العميل الأول للبدء في تسجيل المبيعات الآجلة ومتابعة الرصيد.'} icon={Users} />
      ) : (
        <Card className="kayan-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_150px] gap-3 border-b bg-secondary/30 px-4 py-2 text-[10px] font-black text-muted-foreground md:grid">
            <span>العميل</span><span>الفواتير</span><span>إجمالي المشتريات</span><span>الرصيد</span><span>إجراءات</span>
          </div>
          <div className="divide-y divide-border/70">
            {filtered.map(customer => (
              <div key={customer.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_150px] md:items-center md:px-4 md:py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><User className="size-4"/></div>
                  <div className="min-w-0"><p className="truncate text-sm font-black">{customer.name}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{customer.phone || 'بدون هاتف'}</p>{customer.address && <p className="truncate text-[10px] text-muted-foreground">{customer.address}</p>}</div>
                </div>
                <div className="flex items-center justify-between text-xs md:block"><span className="text-muted-foreground md:hidden">الفواتير</span><b>{customer._count?.sales || 0}</b></div>
                <div className="flex items-center justify-between text-xs md:block"><span className="text-muted-foreground md:hidden">المشتريات</span><b>{formatEGP(customer.totalPurchases || 0)} ج</b></div>
                <div className="flex items-center justify-between text-xs md:block"><span className="text-muted-foreground md:hidden">الرصيد</span>{customer.balance > 0 ? <Badge variant="destructive">{formatEGP(customer.balance)} ج مستحق</Badge> : <Badge variant="secondary">لا يوجد مستحق</Badge>}</div>
                <div className="flex gap-2 md:justify-end">
                  <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg md:flex-none" onClick={() => start(customer)}><Pencil className="me-1 size-3.5"/> تعديل</Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" disabled={remove.isPending || Number(customer.balance || 0) > 0} aria-label={`حذف العميل ${customer.name}`} onClick={() => { if (window.confirm(`حذف ${customer.name}؟`)) remove.mutate(customer.id) }}><Trash2 className="size-4"/></Button>
                </div>
                {customer.balance > 0 && <p className="flex items-center gap-1 text-[10px] text-amber-700 md:hidden"><AlertTriangle className="size-3"/> لا يمكن حذف عميل عليه رصيد</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={value => !save.isPending && setOpen(value)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل العميل' : 'إضافة عميل'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} dir="ltr"/></div>
            <div><Label>العنوان</Label><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })}/></div>
            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>إلغاء</Button><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{save.isPending ? 'جارٍ الحفظ...' : 'حفظ العميل'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
