import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { openNumericPad } from '@/components/numeric-pad'
import type { Customer, PaymentMethod } from './sales-types'

type Props = {
  checkout: boolean
  saveSalePending: boolean
  setCheckout: (v: boolean) => void
  total: number
  paymentMethod: PaymentMethod
  quickPay: (m: PaymentMethod) => void
  paid: number
  setPaid: (v: number) => void
  change: number
  remaining: number
  selectedCustomer: Customer | undefined
  submit: () => void
  money: (value: number) => string
}

export function CheckoutDialog({ checkout, saveSalePending, setCheckout, total, paymentMethod, quickPay, paid, setPaid, change, remaining, selectedCustomer, submit, money }: Props) {
  return (
      <Dialog open={checkout} onOpenChange={v => !saveSalePending && setCheckout(v)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
          <DialogHeader>
            <DialogTitle>تأكيد البيع — {money(total)}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['cash', 'نقدي'],
                ['card', 'بطاقة'],
                ['transfer', 'تحويل'],
                ['credit', 'آجل'],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                onClick={() => quickPay(m)}
                className={`min-h-16 rounded-xl border p-1.5 font-black active:scale-[.98] ${
                  paymentMethod === m ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'bg-card'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {paymentMethod !== 'credit' && (
            <div className="mt-2">
              <Label>المبلغ المستلم</Label>
              <button
                type="button"
                className="mt-1 flex h-12 w-full items-center justify-center rounded-xl border bg-background text-xl font-black tabular-nums"
                onClick={() =>
                  openNumericPad({
                    value: String(paid),
                    title: 'المبلغ المستلم',
                    min: 0,
                    decimal: true,
                    onCommit: v => setPaid(Math.max(0, Number(v) || 0)),
                  })
                }
              >
                {paid}
              </button>
            </div>
          )}

          {paymentMethod !== 'credit' && (
            <div className="mt-2 rounded-xl bg-muted p-3 text-sm">
              {change > 0 ? (
                <>
                  الباقي: <b className="text-primary">{money(change)}</b>
                </>
              ) : remaining > 0 ? (
                <>
                  متبقي: <b className="text-destructive">{money(remaining)}</b>
                </>
              ) : (
                'المبلغ مكتمل'
              )}
            </div>
          )}

          {paymentMethod === 'credit' && (
            <div className="mt-2 rounded-xl bg-muted p-3 text-sm">
              المتبقي على العميل ({selectedCustomer?.name || 'اختر عميلًا'}): <b>{money(total)}</b>
            </div>
          )}

          <Button className="mt-2 h-14 w-full rounded-2xl text-base font-black" disabled={saveSalePending} onClick={submit}>
            {saveSalePending ? 'جارٍ الحفظ...' : 'تأكيد البيع'}
          </Button>
        </DialogContent>
      </Dialog>
  )
}
