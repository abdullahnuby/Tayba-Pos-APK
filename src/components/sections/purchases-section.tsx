'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Receipt, RefreshCw, Trash2, Search, Plus, Minus, PackageSearch, Truck, Wallet, X, Check, Calculator, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDateTime, formatEGP, paymentMethodLabel,
  saleStatusBadgeVariant, saleStatusLabel, todayISO, daysAgoISO,
} from '@/lib/format'
import { unitLabel } from '@/lib/units'

interface Variant { id: string; sku: string; size: string | null; color: string | null; costPrice: number; quantity: number; purchaseUnit?: string; purchaseUnitFactor?: number; baseUnit?: string; product: { name: string } }
interface Supplier { id: string; name: string; balance: number }
interface LineItem { variantId: string; quantity: number; unitCost: number; enteredQuantity: number; unit: string; unitFactor: number }

interface PurchaseRow {
  id: string; invoiceNo: string; date: string; status: string
  total: number; paid: number; discount: number; paymentMethod: string
  supplier: { name: string } | null
  items: unknown[]
}

interface PurchaseItem {
  id: string; variantId: string; quantity: number; unitCost: number; total: number
  enteredQuantity?: number | null; unit?: string | null; unitFactor?: number | null
  variant: { sku: string; size: string | null; color: string | null; product: { name: string } }
}

interface PurchaseDetail extends PurchaseRow {
  items: PurchaseItem[]
}

type Period = 'today' | 'week' | 'month' | 'custom'

function periodRange(period: Period, customFrom: string, customTo: string) {
  if (period === 'today') return { from: todayISO(), to: todayISO() }
  if (period === 'week') return { from: daysAgoISO(6), to: todayISO() }
  if (period === 'month') return { from: daysAgoISO(29), to: todayISO() }
  return { from: customFrom, to: customTo }
}

function money(n: number) { return `${formatEGP(n)} ج.م` }
function clampMoney(n: number) { return Math.max(0, Math.round((Number(n) || 0) * 100) / 100) }

function TouchNumberPad({ value, onChange, onDone }: { value: number; onChange: (n: number) => void; onDone?: () => void }) {
  const [raw, setRaw] = useState(String(value || ''))
  function press(k: string) {
    let next = raw
    if (k === 'clear') next = ''
    else if (k === 'back') next = raw.slice(0, -1)
    else if (k === '.') next = raw.includes('.') ? raw : `${raw || '0'}.`
    else next = raw === '0' ? k : raw + k
    setRaw(next)
    onChange(clampMoney(Number(next) || 0))
  }
  return <div className="rounded-3xl border bg-muted/20 p-3 select-none touch-manipulation">
    <div className="mb-3 flex h-14 items-center justify-between rounded-2xl bg-background px-4 text-2xl font-black tabular-nums"><span>{raw || '0'}</span><span className="text-sm font-semibold text-muted-foreground">ج.م</span></div>
    <div className="grid grid-cols-3 gap-2">
      {['1','2','3','4','5','6','7','8','9','.','0','back'].map(k => <Button key={k} type="button" variant="outline" className="h-14 rounded-2xl text-xl font-black" onClick={() => press(k)}>{k === 'back' ? '⌫' : k}</Button>)}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => press('clear')}>مسح</Button><Button type="button" className="h-12 rounded-2xl" onClick={onDone}><Check className="me-1"/> تم</Button></div>
  </div>
}

export function PurchasesSection() {
  const qc = useQueryClient()

  // list/filter state — mirrors SalesInvoicesSection
  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(daysAgoISO(7))
  const [customTo, setCustomTo] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [confirmVoid, setConfirmVoid] = useState(false)

  // new-purchase builder state
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [moneyEditor, setMoneyEditor] = useState<'discount'|'paid'|'price'|'qty'|null>(null)
  const [editingLine, setEditingLine] = useState<number | null>(null)

  const { from, to } = periodRange(period, customFrom, customTo)

  const listQuery = useQuery<{ items: PurchaseRow[] }>({
    queryKey: ['purchases'],
    queryFn: async () => {
      const r = await fetch('/api/purchases?pageSize=500')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل تحميل الفواتير')
      return j
    },
  })

  const detailQuery = useQuery<PurchaseDetail>({
    queryKey: ['purchase-detail', openId],
    queryFn: async () => {
      const r = await fetch(`/api/purchases/${openId}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'تعذر تحميل الفاتورة')
      return j
    },
    enabled: !!openId,
  })

  const allRows = listQuery.data?.items ?? []
  const rows = useMemo(() => {
    return allRows.filter(r => {
      const dd = (r.date || '').slice(0, 10)
      if (from && dd < from) return false
      if (to && dd > to) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!r.invoiceNo.toLowerCase().includes(q) && !String(r.supplier?.name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allRows, from, to, search])

  const totals = useMemo(() => {
    const totalPurchases = rows.reduce((s, r) => s + Number(r.total || 0), 0)
    const totalDiscount = rows.reduce((s, r) => s + Number(r.discount || 0), 0)
    return { count: rows.length, totalPurchases, totalDiscount, avg: rows.length ? totalPurchases / rows.length : 0 }
  }, [rows])

  function openInvoice(id: string) {
    setOpenId(id); setVoidReason(''); setConfirmVoid(false)
  }

  const { data: productsData } = useQuery<{ items: { id: string; name: string; variants: Variant[] }[] }>({ queryKey: ['products-for-purchases'], queryFn: async () => (await fetch('/api/products?pageSize=500')).json() })
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ['suppliers'], queryFn: async () => (await fetch('/api/suppliers')).json() })
  const allVariants = useMemo(() => (Array.isArray(productsData?.items) ? productsData.items : []).flatMap(p => (Array.isArray(p.variants) ? p.variants : []).map(v => ({ ...v, productName: p.name }))), [productsData])
  const products = useMemo(() => {
    const q = productFilter.trim().toLowerCase()
    return allVariants.filter(v => !q || v.productName.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)).slice(0, 60)
  }, [allVariants, productFilter])
  const subtotal = items.reduce((s, i) => s + i.enteredQuantity * i.unitCost, 0)
  const total = Math.max(0, subtotal - discount)
  const remaining = Math.max(0, total - paid)

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!r.ok) throw new Error((await r.json()).error || 'فشل حفظ الفاتورة')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('تم تسجيل فاتورة الشراء وتحديث المخزون')
      setOpen(false); reset()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const voidMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/purchases/${openId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', voidReason: voidReason || 'حذف من صفحة فواتير الشراء' }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'فشل حذف الفاتورة')
      return j
    },
    onSuccess: () => {
      toast.success('تم حذف الفاتورة وإرجاع المخزون')
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['purchases'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function reset() { setSupplierId(''); setDiscount(0); setPaid(0); setPaymentMethod('cash'); setNotes(''); setItems([]); setProductFilter(''); setMoneyEditor(null); setEditingLine(null) }
  function add(v: any) { if (items.some(i => i.variantId === v.id)) return toast.info('الصنف موجود بالفعل'); const unit = v.purchaseUnit || 'piece'; const factor = Number(v.purchaseUnitFactor) || 1; setItems([...items, { variantId: v.id, quantity: factor, enteredQuantity: 1, unitCost: (v.costPrice || 0) * factor, unit, unitFactor: factor }]) }
  function update(i: number, patch: Partial<LineItem>) { setItems(items.map((x, idx) => idx === i ? { ...x, ...patch } : x)) }
  function remove(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function submit() { if (!supplierId) return toast.error('اختر المورد'); if (!items.length) return toast.error('أضف صنفًا واحدًا على الأقل'); if (items.some(i => i.enteredQuantity <= 0 || i.unitCost <= 0)) return toast.error('راجع الكميات والأسعار'); if (paid > total) return toast.error('المدفوع أكبر من الإجمالي'); createMutation.mutate({ supplierId, discount: Number(discount) || 0, paid: Number(paid) || 0, paymentMethod, notes, status: 'completed', items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost, enteredQuantity: i.enteredQuantity, unit: i.unit, unitFactor: i.unitFactor })) }) }

  const d = detailQuery.data

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">فواتير الشراء</h2>
          <p className="text-sm text-muted-foreground">عرض وحذف فواتير الشراء من الموردين.</p>
        </div>
        <Button className="h-11 rounded-2xl px-5 font-bold" onClick={() => { reset(); setOpen(true) }}>
          <Plus className="me-2 size-4" /> فاتورة شراء جديدة
        </Button>
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
            <Input placeholder="بحث برقم الفاتورة أو اسم المورد" value={search} onChange={e => setSearch(e.target.value)} className="h-11 pr-9" />
          </div>
          <Button variant="outline" className="h-11" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
            <RefreshCw className={listQuery.isFetching ? 'animate-spin' : ''} /> تحديث
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><small>عدد الفواتير</small><div className="mt-1 text-xl font-black">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>إجمالي المشتريات</small><div className="mt-1 text-xl font-black">{money(totals.totalPurchases)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>إجمالي الخصومات</small><div className="mt-1 text-xl font-black">{money(totals.totalDiscount)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><small>متوسط الفاتورة</small><div className="mt-1 text-xl font-black">{money(totals.avg)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد فواتير في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>الدفع</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => openInvoice(row.id)}>
                      <TableCell className="font-bold">{row.invoiceNo}</TableCell>
                      <TableCell>{formatDateTime(row.date)}</TableCell>
                      <TableCell>{row.supplier?.name || '—'}</TableCell>
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

          {d && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>المورد</span><b>{d.supplier?.name || 'بدون مورد'}</b>
              </div>
              <div className="space-y-1.5">
                {d.items.map(it => (
                  <div key={it.id} className="flex items-center justify-between rounded-xl border p-2.5 text-sm">
                    <div><b>{it.variant.product.name}</b><div className="text-xs text-muted-foreground">{it.variant.sku} · {it.enteredQuantity ?? it.quantity} {unitLabel(it.unit || 'piece')} × {money(it.unitCost)}</div></div>
                    <b>{money(it.total)}</b>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>الخصم</span><b>{money(d.discount)}</b></div>
                <div className="flex justify-between text-base"><span>الإجمالي</span><b>{money(d.total)}</b></div>
                <div className="flex justify-between"><span>المدفوع</span><b>{money(d.paid)}</b></div>
                <div className="flex justify-between"><span>المتبقي للمورد</span><b>{money(Math.max(0, d.total - d.paid))}</b></div>
              </div>

              {d.status === 'completed' ? (
                <DialogFooter className="mt-2 gap-2 sm:justify-start">
                  {!confirmVoid ? (
                    <Button type="button" variant="destructive" onClick={() => setConfirmVoid(true)}><Trash2 className="size-4" /> حذف الفاتورة</Button>
                  ) : (
                    <div className="w-full space-y-2 rounded-xl border border-destructive/40 p-3">
                      <p className="text-sm font-bold text-destructive">تأكيد الحذف: سيتم إلغاء الفاتورة وإرجاع الأصناف من المخزون وضبط حساب المورد.</p>
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
        </DialogContent>
      </Dialog>

      {/* New purchase — touch-first builder (unchanged) */}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="h-[100dvh] w-screen max-w-none rounded-none p-0 overflow-hidden sm:h-[96dvh] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:rounded-3xl"><div className="flex h-full min-h-0 flex-col bg-background">
        <div className="shrink-0 border-b px-4 py-4"><div className="flex items-center justify-between"><div><DialogTitle className="text-xl font-black">فاتورة شراء جديدة</DialogTitle><DialogDescription>كل خطوات الفاتورة باللمس — بدون لوحة مفاتيح</DialogDescription></div><Button variant="outline" size="icon" className="size-11 rounded-2xl" onClick={() => setOpen(false)}><X/></Button></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5"><div className="grid gap-4 lg:grid-cols-[1.35fr_.95fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border p-3 sm:p-4"><div className="mb-3 flex items-center gap-2"><Truck className="size-5 text-primary"/><h3 className="font-black">1 · اختر المورد</h3></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(Array.isArray(suppliers) ? suppliers : []).map(s => <button key={s.id} type="button" onClick={() => setSupplierId(s.id)} className={`min-h-20 rounded-2xl border p-3 text-right transition active:scale-[.98] ${supplierId === s.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'bg-card'}`}><div className="font-bold">{s.name}</div><div className="mt-1 text-xs text-muted-foreground">{s.balance > 0 ? `عليه ${money(s.balance)}` : 'حسابه سليم'}</div></button>)}</div>{!suppliers.length && <div className="rounded-2xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">أضف موردًا أولاً</div>}</section>

            <section className="rounded-3xl border p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><PackageSearch className="size-5 text-primary"/><h3 className="font-black">2 · أضف الأصناف</h3></div><Badge variant="outline">{items.length} صنف</Badge></div><div className="mb-3 grid grid-cols-3 gap-2"><Button type="button" variant={!productFilter ? 'default' : 'outline'} className="h-11 rounded-2xl" onClick={() => setProductFilter('')}>الكل</Button><Button type="button" variant={productFilter === 'مقاس' ? 'default' : 'outline'} className="h-11 rounded-2xl" onClick={() => setProductFilter('مقاس')}>مقاسات</Button><Button type="button" variant={productFilter === 'لون' ? 'default' : 'outline'} className="h-11 rounded-2xl" onClick={() => setProductFilter('لون')}>ألوان</Button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{products.map(v => <button key={v.id} type="button" onClick={() => add(v)} className={`min-h-28 rounded-2xl border p-3 text-right transition active:scale-[.98] ${items.some(i => i.variantId === v.id) ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20' : 'bg-card hover:bg-muted/40'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="font-bold leading-tight">{v.productName}</div><div className="mt-1 text-xs text-muted-foreground">{v.size || 'مقاس عام'}{v.color ? ` · ${v.color}` : ''}</div></div>{items.some(i => i.variantId === v.id) && <Check className="size-5 shrink-0 text-emerald-600"/>}</div><div className="mt-3 text-xs text-primary">{unitLabel(v.purchaseUnit || 'piece')} × {v.purchaseUnitFactor || 1}</div><div className="mt-1 text-sm font-black">{money((v.costPrice || 0) * (v.purchaseUnitFactor || 1))}</div></button>)}</div></section>

            <section className="space-y-2"><div className="flex items-center gap-2 px-1"><Receipt className="size-5 text-primary"/><h3 className="font-black">3 · الأصناف داخل الفاتورة</h3></div>{items.length === 0 ? <Card className="rounded-3xl border-dashed"><CardContent className="py-12 text-center text-muted-foreground">اضغط على أي صنف لإضافته</CardContent></Card> : items.map((it, i) => { const v = allVariants.find(x => x.id === it.variantId); const lineTotal = it.enteredQuantity * it.unitCost; const perPieceCost = it.unitCost / (it.unitFactor || 1); return <Card key={it.variantId} className="rounded-3xl overflow-hidden"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-black">{v?.productName || 'منتج'}</div><div className="text-sm text-muted-foreground">{v?.size || 'مقاس عام'}{v?.color ? ` · ${v.color}` : ''} · {v?.sku}</div></div><Button variant="outline" size="icon" className="size-11 rounded-2xl text-destructive" onClick={() => remove(i)}><Trash2/></Button></div>
          <div className="mt-3"><div className="mb-1.5 text-xs text-muted-foreground">وحدة الشراء</div><div className="grid grid-cols-4 gap-1.5">{([['piece','قطعة',1],['quarter-dozen','ربع دستة',3],['half-dozen','نص دستة',6],['dozen','دستة',12]] as const).map(([code,label,factor]) => <button key={code} type="button" onClick={() => { const newFactor = factor; const newCost = Math.round(perPieceCost * newFactor * 100) / 100; update(i, { unit: code, unitFactor: newFactor, unitCost: newCost, quantity: it.enteredQuantity * newFactor }) }} className={`rounded-xl border py-2 text-xs font-black active:scale-[.98] ${it.unitFactor === factor ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground'}`}>{label}</button>)}</div></div>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-muted/40 p-2"><div className="mb-1 text-center text-xs text-muted-foreground">الكمية ({unitLabel(it.unit)})</div><div className="flex h-12 items-center"><Button type="button" variant="outline" className="size-12 shrink-0 rounded-xl" onClick={() => { const q = Math.max(1, it.enteredQuantity - 1); update(i, { enteredQuantity: q, quantity: q * it.unitFactor }) }}><Minus/></Button><button type="button" className="flex-1 text-center text-xl font-black tabular-nums active:opacity-60" onClick={() => { setEditingLine(i); setMoneyEditor('qty') }}>{it.enteredQuantity}</button><Button type="button" variant="outline" className="size-12 shrink-0 rounded-xl" onClick={() => { const q = it.enteredQuantity + 1; update(i, { enteredQuantity: q, quantity: q * it.unitFactor }) }}><Plus/></Button></div><div className="mt-1 text-center text-[11px] text-primary">اضغط الرقم للكتابة المباشرة</div></div><button type="button" className="rounded-2xl border p-3 text-right active:scale-[.99]" onClick={() => { setEditingLine(i); setMoneyEditor('price') }}><div className="text-xs text-muted-foreground">سعر {unitLabel(it.unit)}</div><div className="mt-1 text-lg font-black">{money(it.unitCost)}</div><div className="text-[11px] text-primary">اضغط للتعديل</div></button></div>
          <div className="mt-3 rounded-2xl bg-primary/5 p-3"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">إجمالي البند</span><span className="text-lg font-black">{money(lineTotal)}</span></div><div className="mt-0.5 text-[11px] text-muted-foreground">= {it.quantity} {unitLabel(v?.baseUnit)}</div></div>
        </CardContent></Card> })}</section>
          </div>

          <aside className="lg:sticky lg:top-0 lg:h-fit"><Card className="rounded-3xl border-2 overflow-hidden"><CardContent className="p-0"><div className="border-b bg-muted/30 p-4"><div className="flex items-center gap-2"><Calculator className="size-5 text-primary"/><h3 className="font-black">ملخص الفاتورة</h3></div></div><div className="space-y-3 p-4"><div className="flex justify-between"><span>قبل الخصم</span><b>{money(subtotal)}</b></div><button type="button" className="flex w-full items-center justify-between rounded-2xl border p-3 text-right" onClick={() => setMoneyEditor('discount')}><span>الخصم</span><b>{money(discount)}</b></button><div className="flex items-center justify-between rounded-2xl bg-primary/10 p-4"><span className="font-bold">الصافي</span><b className="text-2xl font-black">{money(total)}</b></div><button type="button" className="flex w-full items-center justify-between rounded-2xl border p-3 text-right" onClick={() => setMoneyEditor('paid')}><span className="flex items-center gap-2"><Banknote className="size-5"/> المدفوع</span><b>{money(paid)}</b></button><div className="rounded-2xl bg-muted/50 p-3"><div className="flex justify-between text-sm"><span>المتبقي للمورد</span><b>{money(remaining)}</b></div></div><div><div className="mb-2 text-sm font-bold">طريقة الدفع</div><div className="grid grid-cols-3 gap-2">{[['cash','💵 نقدي'],['card','💳 بطاقة'],['transfer','🔄 تحويل']].map(([id,label]) => <button key={id} type="button" onClick={() => setPaymentMethod(id)} className={`h-14 rounded-2xl border text-sm font-bold ${paymentMethod === id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''}`}>{label}</button>)}</div></div><button type="button" className="h-12 w-full rounded-2xl border p-3 text-right text-sm" onClick={() => setNotes(notes ? '' : 'تمت المراجعة')}>📝 {notes || 'إضافة ملاحظة'}</button></div></CardContent></Card></aside>
        </div></div>
        <div className="shrink-0 border-t bg-background p-3"><div className="mx-auto flex max-w-6xl gap-2"><Button variant="outline" className="h-14 flex-1 rounded-2xl text-base" onClick={() => setOpen(false)}>إلغاء</Button><Button className="h-14 flex-[2] rounded-2xl text-base font-black" onClick={submit} disabled={createMutation.isPending || !items.length || !supplierId}><Wallet className="me-2"/>{createMutation.isPending ? 'جاري الحفظ...' : `حفظ الفاتورة · ${money(total)}`}</Button></div></div>
      </div></DialogContent></Dialog>

      <Dialog open={!!moneyEditor} onOpenChange={() => { setMoneyEditor(null); setEditingLine(null) }}><DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4"><DialogHeader><DialogTitle>{moneyEditor === 'price' ? 'تعديل سعر الوحدة' : moneyEditor === 'qty' ? 'إدخال الكمية' : moneyEditor === 'discount' ? 'إدخال الخصم' : 'إدخال المدفوع'}</DialogTitle><DialogDescription>لوحة أرقام Touch — لا تحتاج لوحة مفاتيح الجهاز</DialogDescription></DialogHeader><TouchNumberPad value={moneyEditor === 'price' && editingLine !== null ? items[editingLine]?.unitCost || 0 : moneyEditor === 'qty' && editingLine !== null ? items[editingLine]?.enteredQuantity || 0 : moneyEditor === 'discount' ? discount : paid} onChange={n => { if (moneyEditor === 'price' && editingLine !== null) update(editingLine, { unitCost: n }); else if (moneyEditor === 'qty' && editingLine !== null) { const q = Math.max(1, Math.round(n)); update(editingLine, { enteredQuantity: q, quantity: q * items[editingLine].unitFactor }) } else if (moneyEditor === 'discount') setDiscount(n); else if (moneyEditor === 'paid') setPaid(n) }} onDone={() => { setMoneyEditor(null); setEditingLine(null) }}/></DialogContent></Dialog>
    </div>
  )
}
