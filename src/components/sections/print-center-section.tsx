'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Barcode, FileText, Printer, RefreshCw, Search, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, formatEGP, paymentMethodLabel, todayISO } from '@/lib/format'
import { PrintPreviewDialog } from '@/components/print-preview-dialog'

type Variant = { id: string; sku: string; barcode?: string | null; size?: string | null; color?: string | null; sellPrice: number; quantity: number; productName: string }
type Product = { id: string; name: string; variants?: Array<Omit<Variant, 'productName'>> }
type SaleList = { id: string; invoiceNo: string; date: string; total: number; customer?: { name?: string | null } | null }
type SaleDetail = SaleList & { paid: number; discount: number; paymentMethod: string; user?: { name?: string | null } | null; items: Array<{ product_name?: string; sku?: string; quantity: number; unitPrice: number; unitCost?: number; total: number; variant?: { product?: { name?: string | null } | null; size?: string | null; color?: string | null; sku?: string | null } }> }

const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
const EAN_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

function validEAN13(code: string) {
  if (!/^\d{13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.slice(0, 12).reduce((sum, d, i) => sum + d * (i % 2 ? 3 : 1), 0)
  return (10 - (check % 10)) % 10 === digits[12]
}

function EanSvg({ code }: { code: string }) {
  if (!validEAN13(code)) return <div className="font-mono text-xs">{code || 'بدون باركود صالح'}</div>
  const d = code.split('').map(Number)
  const bits = `101${d.slice(1,7).map((n,i)=>EAN_PARITY[d[0]][i] === 'L' ? EAN_L[n] : EAN_G[n]).join('')}01010${d.slice(7).map(n=>EAN_R[n]).join('')}101`
  return <svg viewBox={`0 0 ${bits.length} 45`} className="h-16 w-full" preserveAspectRatio="none" role="img" aria-label={`باركود ${code}`}>
    {bits.split('').map((b,i) => b === '1' ? <rect key={i} x={i} y={0} width={1} height={38} fill="currentColor" /> : null)}
    <text x={bits.length/2} y={44} fontSize="7" textAnchor="middle" fill="currentColor">{code}</text>
  </svg>
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))
}

export function PrintCenterSection() {
  const [active, setActive] = useState<'invoice' | 'labels' | 'report'>('invoice')
  const [saleId, setSaleId] = useState('')
  const [labelQty, setLabelQty] = useState(1)
  const [search, setSearch] = useState('')
  const [reportFrom, setReportFrom] = useState(todayISO())
  const [reportTo, setReportTo] = useState(todayISO())
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)
  const [showPreviewPage, setShowPreviewPage] = useState(false)

  const sales = useQuery<{ items: SaleList[] }>({ queryKey: ['print-sales'], queryFn: async () => { const r = await fetch('/api/sales?status=completed&pageSize=500'); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'تعذر تحميل الفواتير'); return j } })
  const selectedSaleList = useMemo(() => sales.data?.items?.find(x => x.id === saleId) || sales.data?.items?.[0], [sales.data, saleId])
  const detail = useQuery<SaleDetail>({ queryKey: ['print-sale-detail', selectedSaleList?.id], queryFn: async () => { const r = await fetch(`/api/sales/${selectedSaleList!.id}`); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'تعذر تحميل تفاصيل الفاتورة'); return j }, enabled: !!selectedSaleList?.id })
  const products = useQuery<{ items: Product[] }>({ queryKey: ['print-products'], queryFn: async () => { const r = await fetch('/api/products?pageSize=1000'); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'تعذر تحميل الأصناف'); return j } })
  const report = useQuery<any>({ queryKey: ['print-report', reportFrom, reportTo], queryFn: async () => { const r = await fetch(`/api/reports?from=${reportFrom}&to=${reportTo}`); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'تعذر تحميل التقرير'); return j }, enabled: active === 'report' })
  const variants = useMemo(() => (products.data?.items || []).flatMap(p => (p.variants || []).map(v => ({ ...v, productName: p.name }))).filter(v => !search.trim() || v.productName.toLowerCase().includes(search.trim().toLowerCase()) || v.sku.toLowerCase().includes(search.trim().toLowerCase()) || String(v.barcode || '').includes(search.trim())).slice(0, 30), [products.data, search])

  const buildInvoiceHtml = (d: SaleDetail) => {
    const rows = (d.items || []).map(it => `<tr><td>${escapeHtml(it.product_name || it.variant?.product?.name || 'صنف')}<div class="muted">${escapeHtml(it.sku || it.variant?.sku || '')}${it.variant?.size ? ` · ${escapeHtml(it.variant.size)}` : ''}${it.variant?.color ? ` · ${escapeHtml(it.variant.color)}` : ''}</div></td><td>${it.quantity}</td><td>${formatEGP(it.unitPrice)} ج.م</td><td>${formatEGP(it.total)} ج.م</td></tr>`).join('')
    return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}.sheet{max-width:780px;margin:auto}.head{text-align:center;border-bottom:1px dashed #999;padding-bottom:14px}.title{font-size:26px;font-weight:800}.meta{font-size:12px;color:#555;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px 6px;border-bottom:1px solid #eee;text-align:right;font-size:13px}th{background:#f5f5f5}.muted{font-size:10px;color:#777;margin-top:3px}.totals{margin-top:18px;margin-right:auto;width:300px}.row{display:flex;justify-content:space-between;padding:6px 0}.grand{font-size:18px;font-weight:800;border-top:1px solid #222;margin-top:6px;padding-top:10px}@media print{@page{margin:8mm}body{padding:0}.sheet{max-width:none}}</style></head><body><div class="sheet"><div class="head"><div class="title">KAYAN</div><div>فاتورة مبيعات</div><div class="meta">رقم الفاتورة: ${escapeHtml(d.invoiceNo)} · ${escapeHtml(formatDateTime(d.date))} · ${escapeHtml(d.user?.name || '')}</div><div class="meta">العميل: ${escapeHtml(d.customer?.name || 'عميل نقدي')} · الدفع: ${escapeHtml(paymentMethodLabel(d.paymentMethod))}</div></div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="row"><span>الخصم</span><b>${formatEGP(d.discount)} ج.م</b></div><div class="row grand"><span>الإجمالي</span><b>${formatEGP(d.total)} ج.م</b></div><div class="row"><span>المدفوع</span><b>${formatEGP(d.paid)} ج.م</b></div><div class="row"><span>الباقي</span><b>${formatEGP(Math.max(0,d.total-d.paid))} ج.م</b></div></div><p style="text-align:center;margin-top:28px;font-size:11px;color:#666">شكرًا لتعاملكم مع KAYAN</p></div></body></html>`
  }

  const buildReportHtml = (r: any) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}.sheet{max-width:900px;margin:auto}h1{text-align:center;margin:0 0 4px}.meta{text-align:center;color:#666;font-size:12px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}.kpi{border:1px solid #ddd;padding:10px}.kpi b{display:block;font-size:16px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border:1px solid #ddd;text-align:right;font-size:12px}th{background:#f5f5f5}@media print{@page{margin:8mm}}</style></head><body><div class="sheet"><h1>تقرير المبيعات والربحية</h1><div class="meta">${escapeHtml(reportFrom)} إلى ${escapeHtml(reportTo)}</div><div class="kpis"><div class="kpi">الفواتير<b>${r.salesCount ?? 0}</b></div><div class="kpi">صافي المبيعات<b>${formatEGP(r.netSales)} ج.م</b></div><div class="kpi">الربح الإجمالي<b>${formatEGP(r.grossProfit)} ج.م</b></div><div class="kpi">الربح الصافي<b>${formatEGP(r.netProfit)} ج.م</b></div></div><table><thead><tr><th>التاريخ</th><th>المبيعات</th><th>المرتجعات</th><th>الربح</th></tr></thead><tbody>${(r.dailyTrend||[]).map((x:any)=>`<tr><td>${escapeHtml(x.date)}</td><td>${formatEGP(x.sales)} ج</td><td>${formatEGP(x.returns)} ج</td><td>${formatEGP(x.profit)} ج</td></tr>`).join('')}</tbody></table><h3>الأصناف الأكثر مبيعًا</h3><table><thead><tr><th>الصنف</th><th>SKU</th><th>الكمية</th><th>الإيراد</th><th>الربح</th></tr></thead><tbody>${(r.bestSelling||[]).slice(0,25).map((x:any)=>`<tr><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.sku)}</td><td>${x.qty}</td><td>${formatEGP(x.revenue)} ج</td><td>${formatEGP(x.profit)} ج</td></tr>`).join('')}</tbody></table></div></body></html>`

  const buildLabelsHtml = () => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;margin:0;padding:8mm;color:#111}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.label{border:1px solid #111;padding:7px;text-align:center;break-inside:avoid}.name{font-weight:800;font-size:12px}.meta{font-size:9px}.barcode{font-family:monospace;font-size:9px;letter-spacing:2px;margin:6px 0}.price{font-weight:800;font-size:12px}@media print{@page{margin:5mm}body{padding:0}}</style></head><body><div class="grid">${variants.flatMap(v => Array.from({length:labelQty}).map(() => `<div class="label"><div class="name">${escapeHtml(v.productName)}</div><div class="meta">${escapeHtml(v.size || 'مقاس عام')}${v.color ? ` · ${escapeHtml(v.color)}` : ''}</div><div class="barcode">${escapeHtml(v.barcode || v.sku)}</div><div class="price">${formatEGP(v.sellPrice)} ج.م</div><div class="meta">${escapeHtml(v.sku)}</div></div>`)).join('')}</div></body></html>`

  const openInvoicePreview = () => {
    if (!detail.data) return
    setPreview({ title: `فاتورة ${detail.data.invoiceNo}`, html: buildInvoiceHtml(detail.data) })
  }
  const openReportPreview = () => {
    if (!report.data) return
    setPreview({ title: 'تقرير المبيعات والربحية', html: buildReportHtml(report.data) })
  }
  const openLabelsPreview = () => {
    if (!variants.length) return
    setPreview({ title: 'باركود وملصقات', html: buildLabelsHtml() })
  }

  return <div className="space-y-5 pb-24">
    <div className="no-print"><h2 className="text-2xl font-black">مركز الطباعة</h2><p className="text-sm text-muted-foreground">معاينة فعلية للمستند قبل الطباعة، ثم طباعة فقط بعد المراجعة.</p></div>
    <div className="no-print flex flex-wrap gap-2"><Button variant={active==='invoice'?'default':'outline'} onClick={()=>setActive('invoice')}><FileText className="me-2 size-4"/>الفواتير</Button><Button variant={active==='report'?'default':'outline'} onClick={()=>setActive('report')}><FileText className="me-2 size-4"/>التقارير</Button><Button variant={active==='labels'?'default':'outline'} onClick={()=>setActive('labels')}><Barcode className="me-2 size-4"/>باركود وملصقات</Button></div>

    {active==='invoice' && <Card><CardHeader className="no-print"><CardTitle>الفاتورة — اختيار ثم معاينة</CardTitle></CardHeader><CardContent className="space-y-4"><div className="no-print flex flex-wrap gap-2"><select className="h-11 min-w-[320px] rounded-xl border bg-background px-3" value={selectedSaleList?.id||''} onChange={e=>setSaleId(e.target.value)}><option value="">اختر فاتورة</option>{(sales.data?.items||[]).map(s=><option key={s.id} value={s.id}>{s.invoiceNo} — {formatDateTime(s.date)} — {formatEGP(s.total)} ج.م</option>)}</select><Button onClick={openInvoicePreview} disabled={!detail.data}><Eye className="me-2 size-4"/>معاينة الفاتورة</Button><Button variant="outline" onClick={()=>void sales.refetch()}><RefreshCw className="me-2 size-4"/>تحديث</Button></div>{detail.isLoading?<div className="py-10 text-center text-muted-foreground">جاري تحميل تفاصيل الفاتورة...</div>:detail.data?<div className="mx-auto max-w-[760px] rounded-2xl border bg-white p-6 text-black"><div className="text-center"><div className="text-2xl font-black">KAYAN</div><div>فاتورة مبيعات</div><div className="text-xs text-gray-500">{detail.data.invoiceNo} · {formatDateTime(detail.data.date)}</div></div><div className="my-4 border-t border-dashed"/><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">الكمية</th><th className="p-2 text-right">سعر الوحدة</th><th className="p-2 text-right">الإجمالي</th></tr></thead><tbody>{detail.data.items.map((it,i)=><tr key={i} className="border-b"><td className="p-2"><b>{it.product_name || it.variant?.product?.name || 'صنف'}</b><div className="text-xs text-muted-foreground">{it.sku || it.variant?.sku || '—'}{it.variant?.size ? ` · ${it.variant.size}`:''}{it.variant?.color ? ` · ${it.variant.color}`:''}</div></td><td className="p-2">{it.quantity}</td><td className="p-2">{formatEGP(it.unitPrice)} ج.م</td><td className="p-2 font-bold">{formatEGP(it.total)} ج.م</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end"><div className="w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>الخصم</span><b>{formatEGP(detail.data.discount)} ج.م</b></div><div className="flex justify-between text-lg font-black"><span>الإجمالي</span><b>{formatEGP(detail.data.total)} ج.م</b></div><div className="flex justify-between"><span>المدفوع</span><b>{formatEGP(detail.data.paid)} ج.م</b></div><div className="flex justify-between"><span>الباقي</span><b>{formatEGP(Math.max(0,detail.data.total-detail.data.paid))} ج.م</b></div></div></div></div>:<div className="py-10 text-center text-muted-foreground">لا توجد فاتورة محددة.</div>}</CardContent></Card>}

    {active==='report' && <Card><CardHeader className="no-print"><CardTitle>التقرير — معاينة قبل الطباعة</CardTitle></CardHeader><CardContent className="space-y-4"><div className="no-print flex flex-wrap items-end gap-2"><div><label className="text-xs">من</label><Input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)} /></div><div><label className="text-xs">إلى</label><Input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)} /></div><Button onClick={openReportPreview} disabled={!report.data}><Eye className="me-2 size-4"/>معاينة التقرير</Button></div>{report.data&&<div className="rounded-2xl border bg-white p-5 text-black"><h3 className="text-xl font-black text-center">تقرير المبيعات والربحية</h3><p className="text-center text-xs text-gray-500">{reportFrom} إلى {reportTo}</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-gray-50 p-3">الفواتير<strong className="block text-lg">{report.data.salesCount||0}</strong></div><div className="rounded-xl bg-gray-50 p-3">صافي المبيعات<strong className="block text-lg">{formatEGP(report.data.netSales)} ج</strong></div><div className="rounded-xl bg-gray-50 p-3">الربح الإجمالي<strong className="block text-lg">{formatEGP(report.data.grossProfit)} ج</strong></div><div className="rounded-xl bg-gray-50 p-3">الربح الصافي<strong className="block text-lg">{formatEGP(report.data.netProfit)} ج</strong></div></div></div>}</CardContent></Card>}

    {active==='labels' && <Card><CardHeader className="no-print"><CardTitle>الباركود والملصقات — معاينة قبل الطباعة</CardTitle></CardHeader><CardContent className="space-y-4"><div className="no-print flex flex-wrap gap-2"><div className="relative min-w-[280px] flex-1"><Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="pr-9" placeholder="اسم المنتج / SKU / باركود" value={search} onChange={e=>setSearch(e.target.value)}/></div><Input className="w-28" type="number" min={1} max={100} value={labelQty} onChange={e=>setLabelQty(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/><Button onClick={openLabelsPreview} disabled={!variants.length}><Eye className="me-2 size-4"/>معاينة الملصقات</Button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{variants.slice(0,9).map(v=><div key={v.id} className="rounded-xl border bg-white p-3 text-center text-black"><div className="truncate text-xs font-black">{v.productName}</div><div className="text-[10px]">{v.size||'مقاس عام'}{v.color?` · ${v.color}`:''}</div><div className="my-1"><EanSvg code={String(v.barcode||'')}/></div><div className="text-sm font-black">{formatEGP(v.sellPrice)} ج.م</div><div className="font-mono text-[9px]">{v.sku}</div></div>)}</div></CardContent></Card>}

    <Dialog open={showPreviewPage} onOpenChange={setShowPreviewPage}><DialogContent className="max-w-6xl"><DialogHeader><DialogTitle>معاينة قبل الطباعة</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">اختياري: استخدم هذه المعاينة لفتح المستند داخل التطبيق قبل الانتقال للطباعة.</p><DialogFooter><Button onClick={()=>setShowPreviewPage(false)}>إغلاق</Button></DialogFooter></DialogContent></Dialog>
    <PrintPreviewDialog open={!!preview} title={preview?.title || 'معاينة'} html={preview?.html || ''} onOpenChange={open=>!open&&setPreview(null)} />
  </div>
}
