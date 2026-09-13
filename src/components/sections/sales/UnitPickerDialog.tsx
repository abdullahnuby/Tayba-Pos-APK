import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Variant } from './sales-types'

type Props = {
  unitPickerFor: { v: Variant; productName: string } | null
  setUnitPickerFor: (v: { v: Variant; productName: string } | null) => void
  openQuantityPad: (v: Variant, productName: string, pack?: { factor: number; price: number; unit: string; label: string }) => void
  money: (value: number) => string
}

export function UnitPickerDialog({ unitPickerFor, setUnitPickerFor, openQuantityPad, money }: Props) {
  return (
    <Dialog open={!!unitPickerFor} onOpenChange={o => !o && setUnitPickerFor(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>اختر وحدة البيع</DialogTitle>
          <DialogDescription>{unitPickerFor?.productName}</DialogDescription>
        </DialogHeader>

        {unitPickerFor && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openQuantityPad(unitPickerFor.v, unitPickerFor.productName)}
              className="flex min-h-16 w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98]"
            >
              <div>
                <div className="font-black">قطعة</div>
                <div className="text-xs text-muted-foreground">متوفر {unitPickerFor.v.quantity}</div>
              </div>
              <span className="text-lg font-black text-primary">{money(unitPickerFor.v.sellPrice)}</span>
            </button>

            {!!unitPickerFor.v.quarterDozenPrice && (
              <button
                type="button"
                disabled={unitPickerFor.v.quantity < 3}
                onClick={() => openQuantityPad(unitPickerFor.v, unitPickerFor.productName, {
                  factor: 3,
                  price: unitPickerFor.v.quarterDozenPrice!,
                  unit: 'quarter-dozen',
                  label: 'ربع دستة',
                })}
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
              >
                <div>
                  <div className="font-black">ربع دستة (3 قطع)</div>
                  <div className="text-xs text-muted-foreground">متوفر {Math.floor(unitPickerFor.v.quantity / 3)} وحدة</div>
                </div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.quarterDozenPrice)}</span>
              </button>
            )}

            {!!unitPickerFor.v.halfDozenPrice && (
              <button
                type="button"
                disabled={unitPickerFor.v.quantity < 6}
                onClick={() => openQuantityPad(unitPickerFor.v, unitPickerFor.productName, {
                  factor: 6,
                  price: unitPickerFor.v.halfDozenPrice!,
                  unit: 'half-dozen',
                  label: 'نص دستة',
                })}
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
              >
                <div>
                  <div className="font-black">نص دستة (6 قطع)</div>
                  <div className="text-xs text-muted-foreground">متوفر {Math.floor(unitPickerFor.v.quantity / 6)} وحدة</div>
                </div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.halfDozenPrice)}</span>
              </button>
            )}

            {!!unitPickerFor.v.dozenPrice && (
              <button
                type="button"
                disabled={unitPickerFor.v.quantity < 12}
                onClick={() => openQuantityPad(unitPickerFor.v, unitPickerFor.productName, {
                  factor: 12,
                  price: unitPickerFor.v.dozenPrice!,
                  unit: 'dozen',
                  label: 'دستة',
                })}
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
              >
                <div>
                  <div className="font-black">دستة (12 قطعة)</div>
                  <div className="text-xs text-muted-foreground">متوفر {Math.floor(unitPickerFor.v.quantity / 12)} وحدة</div>
                </div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.dozenPrice)}</span>
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
