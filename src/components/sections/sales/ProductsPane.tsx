import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from './sales-types'

type Props = {
  loading: boolean
  visible: Product[]
  chooseProduct: (p: Product) => void
  money: (value: number) => string
}

export function ProductsPane({ loading, visible, chooseProduct, money }: Props) {
  const nameFontSize = (name: string) => {
    const len = name.length
    if (len > 28) return '11px'
    if (len > 22) return '12px'
    if (len > 16) return '13.5px'
    return '15px'
  }

  return (
        <div className="pos-products-pane min-h-0 flex-1 overflow-y-auto p-3 sm:p-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-[9.5rem] rounded-2xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">لا توجد أصناف مطابقة</div>
          ) : (
            <div className="pos-product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-2.5">
              {visible.map(p => {
                const stock = p.variants.reduce((s, v) => s + v.quantity, 0)
                const minPrice = p.variants.length ? Math.min(...p.variants.map(v => v.sellPrice)) : 0
                const outOfStock = stock === 0

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={outOfStock}
                    onClick={() => chooseProduct(p)}
                    aria-label={`إضافة ${p.name}`}
                    className="flex h-[9.5rem] w-full flex-col overflow-hidden rounded-2xl border bg-card p-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-16 shrink-0 items-center justify-center px-1">
                      <div
                        className="line-clamp-2 font-black leading-[1.25]"
                        style={{ fontSize: nameFontSize(p.name) }}
                        title={p.name}
                      >
                        {p.name}
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-1">
                      <span className="text-[13px] font-black leading-tight text-primary">{money(minPrice)}</span>
                      <span
                        className={`text-[10px] font-bold ${outOfStock ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {outOfStock ? 'نفد' : `المخزون: ${stock}`}
                      </span>
                    </div>

                  </button>
                )
              })}
            </div>
          )}
        </div>
  )
}
