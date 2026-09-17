import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from './sales-types'

type Props = {
  loading: boolean
  visible: Product[]
  chooseProduct: (p: Product) => void
  money: (value: number) => string
}

export function ProductsPane({ loading, visible, chooseProduct, money }: Props) {
  return (
    <div className="pos-products-pane min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">لا توجد أصناف مطابقة</div>
      ) : (
        <div className="pos-product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:content-start">
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
                aria-label={outOfStock ? `${p.name} — نفد المخزون` : `اختيار ${p.name}`}
                className="group flex min-h-[132px] w-full flex-col items-center justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex min-h-[3.25rem] w-full items-center justify-center">
                  <div
                    className="line-clamp-2 w-full text-[15px] font-black leading-6 text-foreground sm:text-[16px]"
                    title={p.name}
                  >
                    {p.name}
                  </div>
                </div>

                <div className="mt-2 flex w-full items-center justify-center">
                  <span className="text-[18px] font-black leading-none text-primary sm:text-[19px]">
                    {money(minPrice)}
                  </span>
                </div>

                <div
                  className={`mt-2 rounded-full px-3 py-1 text-[11px] font-bold ${
                    outOfStock
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {outOfStock ? 'نفد' : `المخزون: ${stock}`}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
