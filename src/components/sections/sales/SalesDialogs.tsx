import { Badge } from '@/components/ui/badge'
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
            <Button onClick={() => window.print()}>
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
            <div className="space-y-2">
              {(viewing.items || []).map(item => (
                <div
                  key={item.id}
                  className="flex justify-between rounded-xl border p-3"
                >
                  <span>
                    {item.variant?.product?.name || 'صنف'} × {item.quantity}
                  </span>
                  <b>{money(item.total)}</b>
                </div>
              ))}

              <div className="flex justify-between rounded-xl bg-muted p-3">
                <span>الإجمالي</span>
                <b>{money(viewing.total)}</b>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
