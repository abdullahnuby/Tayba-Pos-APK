import { PackagePlus } from 'lucide-react'
import type { Product } from './sales-types'

type ProductGridProps = {
  products: Product[]
  onSelectProduct: (product: Product) => void
  money: (value: number) => string
}

export function ProductGrid({ products, onSelectProduct, money }: ProductGridProps) {
  return (
    <div className="pos-product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-2.5" aria-label="منتجات نقطة البيع">
      {products.map(product => {
        const stock = product.variants.reduce((sum, variant) => sum + variant.quantity, 0)
        const minPrice = product.variants.length
          ? Math.min(...product.variants.map(variant => variant.sellPrice))
          : 0
        const outOfStock = stock === 0

        return (
          <button
            key={product.id}
            type="button"
            disabled={outOfStock}
            onClick={() => onSelectProduct(product)}
            aria-label={outOfStock ? `${product.name} — نفد المخزون` : `اختيار ${product.name} لإضافته إلى الفاتورة`}
            className="group flex min-h-[9.5rem] w-full flex-col overflow-hidden rounded-2xl border bg-card p-2.5 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="min-h-[2.5rem]">
              <div className="line-clamp-2 text-[13px] font-black leading-5" title={product.name}>
                {product.name}
              </div>
            </div>

            <div className="mt-1 text-[10px] text-muted-foreground">
              {product.variants.length} {product.variants.length === 1 ? 'خيار' : 'مقاسات/ألوان'}
            </div>

            <div className="mt-auto flex items-end justify-between gap-1">
              <span className="text-[13px] font-black leading-tight text-primary">{money(minPrice)}</span>
              <span className={`text-[10px] font-bold ${outOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                {outOfStock ? 'نفد' : `المخزون: ${stock}`}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-2 py-2 text-xs font-black text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <PackagePlus className="size-4" />
              اختيار وإضافة
            </div>
          </button>
        )
      })}
    </div>
  )
}
