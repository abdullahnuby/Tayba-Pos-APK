'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Receipt, RefreshCw, Pencil, Trash2, Search, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDate, formatDateTime, formatEGP, paymentMethodLabel,
  saleStatusBadgeVariant, saleStatusLabel, todayISO, daysAgoISO,
} from '@/lib/format'

function money(v: number) { return `${formatEGP(v)} ج.م` }

interface InvoiceRow {
  id: string; invoiceNo: string; date: string; status: string
  total: number; paid: number; discount: number; paymentMethod: string
  customer: { name: string; phone: string | null } | null
  user: { name: string } | null
  itemsCount: number
}

interface InvoiceItem {
  id: string; variantId: string; quantity: number; unitPrice: number; unitCost: number; total: number
  sku?: string; product_name?: string
}

interface InvoiceDetail extends InvoiceRow {
  customerId: string | null
  items: InvoiceItem[]
}

type Period = 'today' | 'week' | 'month' | 'custom'

function periodRange(period: Period, customFrom: string, customTo: string) {
  if (period === 'today') return { from: todayISO(), to: todayISO() }
  if (period === 'week') return { from: daysAgoISO(6), to: todayISO() }
  if (period === 'month') return { from: daysAgoISO(29), to: todayISO() }
  return { from: customFrom, to: customTo }
}

export function SalesInvoicesSection() {
  const qc = useQueryClient()
  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(daysAgoISO(7))
  const [customTo, setCustomTo] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editDiscount, setEditDiscount] = useState(0)
  const [editItems, setEditItems] = useState<Array<{ variantId: string; quantity: number; price: number; name: string; sku: string }>>([])
  const [voidReason, setVoidReason] = useState('')
  const [confirmVoid, setConfirmVoid] = useState(false)

  const { from, to } = periodRange(period, customFrom, customTo)

  const listQuery = useQuery<{ items: InvoiceRow[] }>({
    queryKey: ['sales-invoices', from, to, search],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'completed', from, to, pageSize: '500' })
      if (search.trim()) params.set('search', search.trim())
      const r = await fetch(`/api/sales?${params.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل تحميل الفواتير')
      return j
    },
  })

  const detailQuery = useQuery<InvoiceDetail>({
    queryKey: ['sale-detail', openId],
    queryFn: async () => {
      const r = await fetch(`/api/sales/${openId}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'تعذر تحميل الفاتورة')
      return j
    },
    enabled: !!openId,
  })

  const items = listQuery.data?.items ?? []
  const totals = useMemo(() => {
    const totalSales = items.reduce((s, r) => s + Number(r.total || 0), 0)
    const totalDiscount = items.reduce((s, r) => s + Number(r.discount || 0), 0)
    return { count: items.length, totalSales, totalDiscount, avg: items.length ? totalSales / items.length : 0 }
  }, [items])

  function openInvoice(id: string) {
    setOpenId(id); setEditMode(false); setVoidReason(''); setConfirmVoid(false)
  }

  function startEdit(d: InvoiceDetail) {
    setEditDate(d.date?.slice(0, 10) || todayISO())
    setEditDiscount(Number(d.discount || 0))
    setEditItems(d.items.map(i => ({ variantId: i.variantId, quantity: Number(i.quantity), price: Number(i.unitPrice), name: i.product_name || '', sku: i.sku || '' })))
    setEditMode(true)
  }

  const editMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sales/${openId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          date: editDate ? new Date(editDate).toISOString() : undefined,
          discount: editDiscount,
          items: editItems.map(i => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل تعديل الفاتورة')
      return j
    },
    onSuccess: () => {
      toast.success('تم تعديل الفاتورة')
      setEditMode(false)
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      qc.invalidateQueries({ queryKey: ['sale-detail', openId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const voidMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sales/${openId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', voidReason: voidReason || 'حذف من صفحة الفواتير' }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل حذف الفاتورة')
      return j
    },
    onSuccess: () => {
      toast.success('تم حذف الفاتورة وإرجاع المخزون')
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function updateItemQty(idx: number, delta: number) {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it))
  }
  function updateItemPrice(idx: number, value: string) {
    const v = Number(value)
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, price: Number.isFinite(v) ? v : it.price } : it))
  }
  const editTotal = editItems.reduce((s, i) => s + i.quantity * i.price, 0) - editDiscount

  const d = detailQuery.data

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black">فواتير المبيعات</h2>
        <p className="text-sm text-muted-foreground">عرض وتعديل وحذف فواتير البيع — تعديل التاريخ متاح أيضًا.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {([['today', 'اليوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['custom', 'فترة مخصصة']] as [Period, string][]).map(([k, l]) => (
              <Button key={k} type="button" size="sm" variant={period === k ? 'default' : 'ghost'} className="h-9" onClick={() => setPeriod(k)}>{l}</Button>
            ))}
          </div>
          {period === 'custom' && <>
            <div><label className="text-xs">من</label><Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="mt-1 h-11" /></div>
            <div><label className="text-xs">إلى</label><Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="mt-1 h-11" /></div>
          </>}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث برقم الفاتورة أو اسم العميل" value={search} onChange={e => setSearch(e.target.value)} className="h-11 pr-9" />
          </div>
          <Button variant="outline" className="h-11" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
            <RefreshCw className={listQuery.isFetching ? 'animate-spin' : ''} /> تحديث
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><small>عدد الفواتير</small><div className="mt-1 text-xl font-black">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>إجمالي المبيعات</small><div className="mt-1 text-xl font-black">{money(totals.totalSales)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>إجمالي الخصومات</small><div className="mt-1 text-xl font-black">{money(totals.totalDiscount)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>متوسط الفاتورة</small><div className="mt-1 text-xl font-black">{money(totals.avg)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد فواتير في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الكاشير</TableHead>
                    <TableHead>الدفع</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(row => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => openInvoice(row.id)}>
                      <TableCell className="font-bold">{row.invoiceNo}</TableCell>
                      <TableCell>{formatDateTime(row.date)}</TableCell>
                      <TableCell>{row.customer?.name || '—'}</TableCell>
                      <TableCell>{row.user?.name || '—'}</TableCell>
                      <TableCell>{paymentMethodLabel(row.paymentMethod)}</TableCell>
                      <TableCell className="font-bold">{money(row.total)}</TableCell>
                      <TableCell><Badge variant={saleStatusBadgeVariant(row.status)}>{saleStatusLabel(row.status)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={v => { if (!v) setOpenId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="size-5" /> فاتورة {d?.invoiceNo}</DialogTitle>
            <DialogDescription>{d && formatDateTime(d.date)} — {d && paymentMethodLabel(d.paymentMethod)}</DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading && <div className="p-6 text-center text-muted-foreground">جاري التحميل...</div>}

          {d && !editMode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>العميل</span><b>{d.customer?.name || 'عميل نقدي'}</b>
              </div>
              <div className="space-y-1.5">
                {d.items.map(it => (
                  <div key={it.id} className="flex items-center justify-between rounded-xl border p-2.5 text-sm">
                    <div><b>{it.product_name}</b><div className="text-xs text-muted-foreground">{it.sku} · {it.quantity} × {money(it.unitPrice)}</div></div>
                    <b>{money(it.total)}</b>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>الخصم</span><b>{money(d.discount)}</b></div>
                <div className="flex justify-between text-base"><span>الإجمالي</span><b>{money(d.total)}</b></div>
                <div className="flex justify-between"><span>المدفوع</span><b>{money(d.paid)}</b></div>
              </div>

              {d.status === 'completed' ? (
                <DialogFooter className="mt-2 gap-2 sm:justify-start">
                  <Button type="button" onClick={() => startEdit(d)}><Pencil className="size-4" /> تعديل الفاتورة</Button>
                  {!confirmVoid ? (
                    <Button type="button" variant="destructive" onClick={() => setConfirmVoid(true)}><Trash2 className="size-4" /> حذف الفاتورة</Button>
                  ) : (
                    <div className="w-full space-y-2 rounded-xl border border-destructive/40 p-3">
                      <p className="text-sm font-bold text-destructive">تأكيد الحذف: سيتم إلغاء الفاتورة وإرجاع الأصناف للمخزون.</p>
                      <Input placeholder="سبب الحذف (اختياري)" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
                      <div className="flex gap-2">
                        <Button type="button" variant="destructive" className="flex-1" disabled={voidMutation.isPending} onClick={() => voidMutation.mutate()}>تأكيد الحذف</Button>
                        <Button type="button" variant="outline" onClick={() => setConfirmVoid(false)}>إلغاء</Button>
                      </div>
                    </div>
                  )}
                </DialogFooter>
              ) : (
                <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">هذه الفاتورة {saleStatusLabel(d.status)} ولا يمكن تعديلها.</p>
              )}
            </div>
          )}

          {d && editMode && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">تاريخ الفاتورة</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="mt-1 h-11" />
              </div>
              <div className="space-y-1.5">
                {editItems.map((it, idx) => (
                  <div key={it.variantId + idx} className="rounded-xl border p-2.5 text-sm">
                    <div className="flex items-center justify-between"><b>{it.name}</b><span className="text-xs text-muted-foreground">{it.sku}</span></div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button type="button" size="icon" variant="outline" className="size-8" onClick={() => updateItemQty(idx, -1)}><Minus className="size-3" /></Button>
                      <span className="w-8 text-center font-bold">{it.quantity}</span>
                      <Button type="button" size="icon" variant="outline" className="size-8" onClick={() => updateItemQty(idx, 1)}><Plus className="size-3" /></Button>
                      <Input type="number" value={it.price} onChange={e => updateItemPrice(idx, e.target.value)} className="h-9 flex-1" />
                      <span className="w-24 text-left font-bold">{money(it.quantity * it.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-xs">الخصم</Label>
                <Input type="number" value={editDiscount} onChange={e => setEditDiscount(Number(e.target.value) || 0)} className="mt-1 h-11" />
              </div>
              <div className="flex justify-between rounded-xl bg-muted p-3 font-bold"><span>الإجمالي بعد التعديل</span><span>{money(Math.max(0, editTotal))}</span></div>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button type="button" disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>حفظ التعديل</Button>
                <Button type="button" variant="outline" onClick={() => setEditMode(false)}>تراجع</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
