import { Skeleton } from '@/components/ui/skeleton'
import { Barcode, PackageOpen } from 'lucide-react'
import type { Product } from './sales-types'
import { EmptyState } from '@/components/empty-state'

type Props = {
  loading: boolean
  visible: Product[]
  chooseProduct: (p: Product) => void
  money: (value: number) => string
}

export function ProductsPane({ loading, visible, chooseProduct, money }: Props) {
  return (
    <div className="pos-products-pane min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-[156px] rounded-[20px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="لا توجد أصناف مطابقة"
          description="جرّب كلمة بحث أخرى أو غيّر التصنيف. يمكنك أيضًا إدخال الباركود مباشرة."
          icon={PackageOpen}
          className="mx-auto max-w-xl"
        />
      ) : (
        <div className="pos-product-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map(p => {
            const stock = p.variants.reduce((s, v) => s + v.quantity, 0)
            const minPrice = p.variants.length ? Math.min(...p.variants.map(v => v.sellPrice)) : 0
            const outOfStock = stock === 0
            const initial = p.name.trim().charAt(0) || '•'
            const code = p.variants[0]?.sku || p.variants[0]?.barcode || ''

            return (
              <button
                key={p.id}
                type="button"
                disabled={outOfStock}
                onClick={() => chooseProduct(p)}
                aria-label={outOfStock ? `${p.name} — نفد المخزون` : `اختيار ${p.name}`}
                className="kayan-product-card group flex w-full flex-col disabled:cursor-not-allowed disabled:opacity-55"
              >
                <div className="flex w-full items-start justify-between gap-2 pt-1">
                  <span className="kayan-product-card__mark">{initial}</span>
                  <span className={outOfStock ? 'rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-black text-destructive' : 'kayan-product-card__stock'}>
                    <span className={`size-1.5 rounded-full ${outOfStock ? 'bg-destructive' : 'bg-primary'}`} />
                    {outOfStock ? 'نفد' : `${stock} متاح`}
                  </span>
                </div>

                <div className="mt-3 min-h-[42px] w-full text-right">
                  <div className="line-clamp-2 text-sm font-black leading-5 sm:text-[15px]" title={p.name}>
                    {p.name}
                  </div>
                  {p.category?.name && <div className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{p.category.name}</div>}
                </div>

                <div className="mt-auto flex w-full items-end justify-between gap-2 pt-3">
                  <div className="min-w-0 text-right">
                    <div className="text-[10px] font-bold text-muted-foreground">يبدأ من</div>
                    <div className="mt-0.5 text-[17px] font-black leading-none text-primary">{money(minPrice)}</div>
                  </div>
                  {code && <span className="flex shrink-0 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[9px] font-bold text-muted-foreground"><Barcode className="size-3" /> <span className="max-w-16 truncate font-mono">{code}</span></span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
