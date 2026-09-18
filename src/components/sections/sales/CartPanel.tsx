import { Button } from '@/components/ui/button'
import { openNumericPad } from '@/components/numeric-pad'
import { ReceiptText, Trash2, UserPlus, X, UserRound } from 'lucide-react'
import type { CartItem, Customer, SessionUser } from './sales-types'

type Props = {
  cart: CartItem[]
  setCart: (updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void
  selectedCustomer: Customer | undefined
  customerPickerOpen: boolean
  setCustomerPickerOpen: (updater: boolean | ((prev: boolean) => boolean)) => void
  setCustomerDialog: (v: boolean) => void
  customerSearch: string
  setCustomerSearch: (v: string) => void
  customerId: string
  setCustomerId: (v: string) => void
  visibleCustomers: Customer[]
  lineKey: (x: { variantId: string; unit: string }) => string
  removeItem: (key: string) => void
  changeQty: (key: string, delta: number) => void
  money: (value: number) => string
  discount: number
  setDiscount: (v: number) => void
  subtotal: number
  total: number
  user: SessionUser
  saveSalePending: boolean
  setPaid: (v: number) => void
  setCheckout: (v: boolean) => void
}

export function CartPanel(props: Props) {
  const {
    cart, setCart, selectedCustomer, customerPickerOpen, setCustomerPickerOpen,
    setCustomerDialog, customerSearch, setCustomerSearch, customerId, setCustomerId,
    visibleCustomers, lineKey, removeItem, changeQty, money, discount, setDiscount,
    subtotal, total, user, saveSalePending, setPaid, setCheckout,
  } = props

  return (
    <div className="pos-cart min-h-0 flex max-h-[44dvh] shrink-0 flex-col overflow-visible border-t border-border/80 bg-card lg:max-h-none lg:h-full lg:border-t-0 lg:border-r">
      <div className="border-b border-border/80 bg-card px-3 pb-2 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-black">
            <ReceiptText className="size-4 shrink-0 text-primary" />
            <span>الفاتورة</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{cart.length} بنود</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl text-destructive disabled:opacity-30"
            disabled={!cart.length}
            onClick={() => setCart([])}
            aria-label="تفريغ السلة"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="relative mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setCustomerPickerOpen(o => !o)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-right transition hover:border-primary/35"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><UserRound className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-muted-foreground">العميل</span>
              <span className="block truncate text-sm font-black">{selectedCustomer?.name || 'عميل نقدي'}</span>
            </span>
          </button>
          <Button variant="outline" size="icon" className="size-[46px] rounded-xl" onClick={() => setCustomerDialog(true)} aria-label="عميل جديد">
            <UserPlus className="size-4" />
          </Button>

          {customerPickerOpen && (
            <div className="pos-customer-picker absolute end-0 top-[52px] z-40 flex w-[min(360px,calc(100vw-1.5rem))] max-h-80 flex-col gap-2 overflow-hidden rounded-2xl border bg-popover p-2.5 shadow-2xl">
              <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="ابحث عن العميل..." className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25" />
              <div className="flex flex-wrap gap-2 overflow-y-auto">
                <button type="button" onClick={() => { setCustomerId(''); setCustomerSearch(''); setCustomerPickerOpen(false) }} className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${!customerId ? 'border-primary bg-primary/10 text-primary' : 'bg-background'}`}>
                  عميل نقدي
                </button>
                {visibleCustomers.map(c => (
                  <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setCustomerSearch(''); setCustomerPickerOpen(false) }} className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${customerId === c.id ? 'border-primary bg-primary/10 text-primary' : 'bg-background'}`}>
                    {c.name}
                  </button>
                ))}
                {!visibleCustomers.length && <span className="w-full py-3 text-center text-xs text-muted-foreground">لا يوجد عميل مطابق</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pos-cart-list min-h-0 flex-1 overflow-y-auto p-3">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-dashed border-border bg-background/70 p-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><ReceiptText className="size-6" /></div>
              <div className="mt-3 text-sm font-black">السلة جاهزة</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">اضغط على أي منتج من اليسار لإضافته إلى الفاتورة.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((it) => {
              const key = lineKey(it)
              return (
                <div key={key} className="rounded-2xl border border-border/80 bg-background p-2.5 shadow-sm">
                  <div className="flex items-start gap-2">
                    <button type="button" onClick={() => removeItem(key)} className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" aria-label="حذف البند">
                      <X className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{it.name}</div>
                      <div className="mt-0.5 truncate text-[10px] font-bold text-muted-foreground">
                        {it.packLabel ? <span className="text-primary">{it.packLabel}</span> : (it.size || 'مقاس عام')}{it.color ? ` · ${it.color}` : ''}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black tabular-nums">{money(it.price * it.quantity)}</div>
                      <div className="text-[10px] text-muted-foreground">{money(it.price)} / وحدة</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-card px-2 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">الكمية</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => changeQty(key, -1)}>−</Button>
                      <span className="min-w-7 text-center text-sm font-black tabular-nums">{it.quantity}</span>
                      <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => changeQty(key, 1)}>+</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/80 bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-muted-foreground">الإجمالي قبل الخصم</span>
          <span className="font-black tabular-nums">{money(subtotal)}</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground">الخصم{user.role === 'cashier' ? ' · حتى 5%' : ''}</div>
            <div className="mt-0.5 text-xs font-black">اضغط لتعديل القيمة</div>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-base font-black tabular-nums text-primary transition hover:bg-primary/10 active:scale-95" onClick={() => openNumericPad({ value: String(discount), title: 'قيمة الخصم', min: 0, max: subtotal, decimal: true, onCommit: v => setDiscount(Math.max(0, Math.min(subtotal, Number(v) || 0))) })}>
            {money(discount)}
          </button>
        </div>
        <div className="kayan-cart-total flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="text-xs font-bold opacity-80">المطلوب تحصيله</span>
          <span className="text-[24px] font-black leading-none tabular-nums">{money(total)}</span>
        </div>
        <Button type="button" className="mt-2.5 h-[52px] w-full rounded-2xl text-[15px] font-black shadow-lg shadow-primary/10" disabled={!cart.length || saveSalePending} onClick={() => { setPaid(total); setCheckout(true) }}>
          {saveSalePending ? 'جارٍ الحفظ...' : 'إتمام البيع'}
        </Button>
      </div>
    </div>
  )
}
