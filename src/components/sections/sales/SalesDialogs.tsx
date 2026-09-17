import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  Eye,
  MessageCircle,
  Play,
  Printer,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDateTime,
  formatEGP,
  saleStatusBadgeVariant,
  saleStatusLabel,
} from '@/lib/format'

import type { Sale } from './sales-types'
import { PrintPreviewDialog } from '@/components/print-preview-dialog'

type SalesDialogsProps = {
  printing: Sale | null
  viewing: Sale | null
  historyOpen: boolean
  sales: Sale[]
  salesLoading: boolean
  onPrintingChange: (open: boolean) => void
  onViewingChange: (sale: Sale | null) => void
  onHistoryChange: (open: boolean) => void
  onResumeDraft: (sale: Sale) => void
  onShareReceipt: (sale: Sale) => void
  onWhatsApp: (sale: Sale) => void
}

function money(value: number) {
  return `${formatEGP(value)} ج.م`
}

export function SalesDialogs({
  printing,
  viewing,
  historyOpen,
  sales,
  salesLoading,
  onPrintingChange,
  onViewingChange,
  onHistoryChange,
  onResumeDraft,
  onShareReceipt,
  onWhatsApp,
}: SalesDialogsProps) {
  const deviceSettings = useQuery<Record<string, string>>({ queryKey: ['device-settings'], queryFn: async () => (await fetch('/api/store-settings')).json(), staleTime: 60000 })
  const [preview, setPreview] = useState<{title:string;html:string}|null>(null)

  const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch))
  const openReceiptPreview = async (sale: Sale) => {
    const full = sale.items?.length ? sale : await (async () => { const r = await fetch(`/api/sales/${sale.id}`); if (!r.ok) throw new Error('تعذر تحميل تفاصيل الفاتورة'); return r.json() as Promise<Sale> })()
    const rows = (full.items || []).map(item => `<tr><td>${escapeHtml(item.variant?.product?.name || 'صنف')}<div class="muted">${escapeHtml(item.variant?.sku || '')}${item.variant?.size ? ` · ${escapeHtml(item.variant.size)}` : ''}${item.variant?.color ? ` · ${escapeHtml(item.variant.color)}` : ''}</div></td><td>${item.quantity}</td><td>${money(item.total)}</td></tr>`).join('')
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;margin:0;padding:20px;color:#111}.sheet{max-width:420px;margin:auto}.head{text-align:center;border-bottom:1px dashed #777;padding-bottom:12px}.title{font-size:22px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:7px;border-bottom:1px solid #eee;text-align:right;font-size:12px}.muted{font-size:9px;color:#777}.total{display:flex;justify-content:space-between;border-top:1px solid #222;margin-top:12px;padding-top:10px;font-weight:800;font-size:16px}@media print{@page{size:80mm auto;margin:4mm}body{padding:0}.sheet{max-width:none}}</style></head><body><div class="sheet"><div class="head"><div class="title">طيبة</div><div>فاتورة مبيعات</div><div>${escapeHtml(full.invoiceNo)} · ${escapeHtml(formatDateTime(full.date))}</div><div>${escapeHtml(full.customer?.name || 'عميل نقدي')}</div></div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>الإجمالي</span><span>${money(full.total)}</span></div><div style="text-align:center;margin-top:16px;font-size:10px;color:#666">شكرًا لتعاملكم مع طيبة</div></div></body></html>`
    setPreview({title:`فاتورة ${full.invoiceNo}`,html})
  }

  const printToConfiguredPrinter = async () => {
    if (!preview) return
    const api = typeof window !== 'undefined' ? window.taybaDevices : undefined
    let printer = ''
    try { printer = JSON.parse(deviceSettings.data?.deviceConfig || '{}').receiptPrinter || '' } catch { /* fallback */ }
    if (!api || !printer) { window.print(); return }
    try { await api.printHtml(printer, preview.html, 'receipt'); toast.success('تم إرسال الفاتورة للطابعة') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'فشل إرسال الفاتورة للطابعة'); window.print() }
  }

  const loadInvoice = async (id: string) => {
    try {
      const response = await fetch(`/api/sales/${id}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل تفاصيل الفاتورة')
      }
      onViewingChange(payload as Sale)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل تفاصيل الفاتورة',
      )
    }
  }

  return (
    <>
      <Dialog
        open={!!printing}
        onOpenChange={open => !open && onPrintingChange(false)}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>الفاتورة تمت بنجاح</DialogTitle>
          </DialogHeader>

          {printing && (
            <div
              id="printable-invoice"
              className="rounded-xl border bg-white p-4 text-black"
            >
              <div className="text-center text-xl font-black">طيبة</div>
              <div className="mt-2 text-sm">فاتورة: {printing.invoiceNo}</div>
              <div className="text-sm">
                التاريخ: {formatDateTime(printing.date)}
              </div>

              {(printing.items || []).map(item => (
                <div
                  key={item.id}
                  className="flex justify-between border-b py-2 text-sm"
                >
                  <span>
                    {item.variant?.product?.name || 'صنف'} × {item.quantity}
                  </span>
                  <b>{money(item.total)}</b>
                </div>
              ))}

              <div className="mt-3 flex justify-between font-black">
                <span>الإجمالي</span>
                <span>{money(printing.total)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => printing && void openReceiptPreview(printing)}>
              <Printer className="size-4" />
              طباعة
            </Button>
            <Button
              variant="outline"
              onClick={() => printing && onShareReceipt(printing)}
            >
              <Share2 className="size-4" />
              مشاركة
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12 rounded-2xl"
              onClick={() => printing && onWhatsApp(printing)}
            >
              <MessageCircle className="size-4" />
              إرسال واتساب
            </Button>
            <Button
              className="h-12 rounded-2xl"
              onClick={() => onPrintingChange(false)}
            >
              <CheckCircle2 className="size-4" />
              فاتورة جديدة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={onHistoryChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل الفواتير</DialogTitle>
          </DialogHeader>

          {salesLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-2">
              {sales.map(sale => (
                <div key={sale.id} className="rounded-xl border p-3">
                  <div className="flex justify-between">
                    <b>{sale.invoiceNo}</b>
                    <Badge variant={saleStatusBadgeVariant(sale.status)}>
                      {saleStatusLabel(sale.status)}
                    </Badge>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(sale.date)} ·{' '}
                    {sale.customer?.name || 'عميل نقدي'}
                  </div>

                  <div className="mt-2 flex justify-between gap-2">
                    <b>{money(sale.total)}</b>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void loadInvoice(sale.id)}
                      >
                        <Eye className="size-4" />
                        عرض
                      </Button>

                      {sale.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => onResumeDraft(sale)}
                        >
                          <Play className="size-4" />
                          استئناف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!sales.length && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  لا توجد فواتير
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewing}
        onOpenChange={open => !open && onViewingChange(null)}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>الفاتورة {viewing?.invoiceNo}</DialogTitle>
          </DialogHeader>

          {viewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl border p-3"><span className="text-muted-foreground">العميل</span><b className="block mt-1">{viewing.customer?.name || 'عميل نقدي'}</b></div><div className="rounded-xl border p-3"><span className="text-muted-foreground">طريقة الدفع</span><b className="block mt-1">{viewing.paymentMethod}</b></div></div>
              <div className="overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">الكمية</th><th className="p-2 text-right">سعر/بند</th><th className="p-2 text-right">الإجمالي</th></tr></thead><tbody>{(viewing.items||[]).map(item=><tr key={item.id} className="border-b last:border-0"><td className="p-2"><b>{item.variant?.product?.name || 'صنف'}</b><div className="text-xs text-muted-foreground">{item.variant?.sku || '—'}{item.variant?.size ? ` · ${item.variant.size}`:''}{item.variant?.color ? ` · ${item.variant.color}`:''}</div></td><td className="p-2">{item.quantity}</td><td className="p-2">{money(item.total / Math.max(1,item.quantity))}</td><td className="p-2 font-bold">{money(item.total)}</td></tr>)}</tbody></table></div>
              <div className="space-y-1 rounded-2xl bg-muted p-3 text-sm"><div className="flex justify-between"><span>الخصم</span><b>{money((viewing as Sale & { discount?: number }).discount || 0)}</b></div><div className="flex justify-between text-base font-black"><span>الإجمالي</span><b>{money(viewing.total)}</b></div><div className="flex justify-between"><span>المدفوع</span><b>{money(viewing.paid)}</b></div><div className="flex justify-between"><span>الباقي</span><b>{money(Math.max(0, viewing.total - viewing.paid))}</b></div></div>
              <Button className="w-full" onClick={() => void openReceiptPreview(viewing)}><Printer className="size-4"/> معاينة وطباعة الفاتورة</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PrintPreviewDialog open={!!preview} title={preview?.title || 'معاينة'} html={preview?.html || ''} onOpenChange={open => !open && setPreview(null)} onPrint={printToConfiguredPrinter} />
    </>
  )
}
