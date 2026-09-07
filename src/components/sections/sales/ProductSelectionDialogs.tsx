import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Product, Variant } from './sales-types'

type ProductSelectionDialogsProps = {
  selectedProduct: Product | null
  pendingAdd: { v: Variant; productName: string } | null
  unitPickerFor: { v: Variant; productName: string } | null
  money: (value: number) => string
  onSelectedProductChange: (product: Product | null) => void
  onPendingAddChange: (value: { v: Variant; productName: string } | null) => void
  onUnitPickerChange: (value: { v: Variant; productName: string } | null) => void
  onPickVariant: (variant: Variant, productName: string) => void
  onAddVariant: (
    variant: Variant,
    productName?: string,
    pack?: { factor: number; price: number; unit: string; label: string },
  ) => void
}

export function ProductSelectionDialogs({
  selectedProduct,
  pendingAdd,
  unitPickerFor,
  money,
  onSelectedProductChange,
  onPendingAddChange,
  onUnitPickerChange,
  onPickVariant,
  onAddVariant,
}: ProductSelectionDialogsProps) {
  return <>
    <Dialog open={!!selectedProduct} onOpenChange={open => !open && onSelectedProductChange(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>اختيار المقاس واللون</DialogTitle>
          <DialogDescription>{selectedProduct?.name}</DialogDescription>
        </DialogHeader>
        {selectedProduct && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(selectedProduct.variants || []).filter(v => v.quantity > 0).map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onPickVariant(v, selectedProduct.name)}
                className="min-h-28 rounded-3xl border p-4 text-right transition active:scale-[.98] hover:border-primary/60 hover:bg-primary/5"
              >
                <div className="font-black">{v.size || 'مقاس عام'}</div>
                <div className="mt-1 text-sm text-muted-foreground">{v.color || 'لون عام'}</div>
                <div className="mt-3 text-lg font-black text-primary">{money(v.sellPrice)}</div>
                <div className="mt-1 text-xs text-muted-foreground">متوفر {v.quantity}</div>
                <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-center text-xs font-black text-primary">اختيار وإضافة</div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={!!pendingAdd} onOpenChange={open => !open && onPendingAddChange(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>تأكيد إضافة الصنف</DialogTitle>
          <DialogDescription>لن تتم إضافة أي شيء إلى الفاتورة حتى تضغط تأكيد الإضافة.</DialogDescription>
        </DialogHeader>
        {pendingAdd && (
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="text-lg font-black">{pendingAdd.productName}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {pendingAdd.v.size || 'مقاس عام'}{pendingAdd.v.color ? ` · ${pendingAdd.v.color}` : ''}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">قطعة واحدة</span>
              <b className="text-xl text-primary">{money(pendingAdd.v.sellPrice)}</b>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onPendingAddChange(null)}>إلغاء</Button>
          <Button type="button" onClick={() => { if (!pendingAdd) return; onAddVariant(pendingAdd.v, pendingAdd.productName); onPendingAddChange(null) }}>
            تأكيد الإضافة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!unitPickerFor} onOpenChange={open => !open && onUnitPickerChange(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>اختيار وحدة البيع</DialogTitle>
          <DialogDescription>
            {unitPickerFor?.productName}{unitPickerFor?.v.size ? ` · ${unitPickerFor.v.size}` : ''}
          </DialogDescription>
        </DialogHeader>
        {unitPickerFor && (
          <div className="space-y-2">
            <button type="button" onClick={() => onAddVariant(unitPickerFor.v, unitPickerFor.productName)} className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98]">
              <div><div className="font-black">قطعة</div><div className="text-xs text-muted-foreground">متوفر {unitPickerFor.v.quantity}</div></div>
              <span className="text-lg font-black text-primary">{money(unitPickerFor.v.sellPrice)}</span>
            </button>
            {!!unitPickerFor.v.quarterDozenPrice && (
              <button type="button" disabled={unitPickerFor.v.quantity < 3} onClick={() => onAddVariant(unitPickerFor.v, unitPickerFor.productName, { factor: 3, price: unitPickerFor.v.quarterDozenPrice!, unit: 'quarter-dozen', label: 'ربع دستة' })} className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40">
                <div><div className="font-black">ربع دستة (3 قطع)</div><div className="text-xs text-muted-foreground">{unitPickerFor.v.quantity < 3 ? 'مخزون غير كافٍ' : `يلزم 3 من ${unitPickerFor.v.quantity}`}</div></div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.quarterDozenPrice)}</span>
              </button>
            )}
            {!!unitPickerFor.v.halfDozenPrice && (
              <button type="button" disabled={unitPickerFor.v.quantity < 6} onClick={() => onAddVariant(unitPickerFor.v, unitPickerFor.productName, { factor: 6, price: unitPickerFor.v.halfDozenPrice!, unit: 'half-dozen', label: 'نص دستة' })} className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40">
                <div><div className="font-black">نص دستة (6 قطع)</div><div className="text-xs text-muted-foreground">{unitPickerFor.v.quantity < 6 ? 'مخزون غير كافٍ' : `يلزم 6 من ${unitPickerFor.v.quantity}`}</div></div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.halfDozenPrice)}</span>
              </button>
            )}
            {!!unitPickerFor.v.dozenPrice && (
              <button type="button" disabled={unitPickerFor.v.quantity < 12} onClick={() => onAddVariant(unitPickerFor.v, unitPickerFor.productName, { factor: 12, price: unitPickerFor.v.dozenPrice!, unit: 'dozen', label: 'دستة' })} className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40">
                <div><div className="font-black">دستة (12 قطعة)</div><div className="text-xs text-muted-foreground">{unitPickerFor.v.quantity < 12 ? 'مخزون غير كافٍ' : `يلزم 12 من ${unitPickerFor.v.quantity}`}</div></div>
                <span className="text-lg font-black text-primary">{money(unitPickerFor.v.dozenPrice)}</span>
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>
}
