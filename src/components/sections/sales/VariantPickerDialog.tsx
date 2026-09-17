import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Product, Variant } from './sales-types'

type VariantPickerDialogProps = {
  selectedProduct: Product | null
  money: (value: number) => string
  onOpenChange: (open: boolean) => void
  onPickVariant: (variant: Variant, productName: string) => void
}

/** Shown only when a product has more than one in-stock size/color line —
 * for example a kids' clothing item in sizes 2/4/6, or socks in different
 * colors. A cashier must never have a different size silently substituted
 * for the one the customer picked, so this step is not optional and there
 * is no "skip" path back to auto-picking the first variant. */
export function VariantPickerDialog({ selectedProduct, money, onOpenChange, onPickVariant }: VariantPickerDialogProps) {
  return (
    <Dialog open={!!selectedProduct} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>اختيار المقاس/اللون</DialogTitle>
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
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
