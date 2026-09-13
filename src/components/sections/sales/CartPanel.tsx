import { Button } from '@/components/ui/button'
import { openNumericPad } from '@/components/numeric-pad'
import { ReceiptText, Trash2, UserPlus, X } from 'lucide-react'
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
  editItemPrice: (key: string) => void
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

export function CartPanel({ cart, setCart, selectedCustomer, customerPickerOpen, setCustomerPickerOpen, setCustomerDialog, customerSearch, setCustomerSearch, customerId, setCustomerId, visibleCustomers, lineKey, removeItem, changeQty, editItemPrice, money, discount, setDiscount, subtotal, total, user, saveSalePending, setPaid, setCheckout }: Props) {
  return (
        <div className="pos-cart min-h-0 flex max-h-[42dvh] shrink-0 flex-col border-t bg-background lg:max-h-none lg:h-full lg:border-t-0 lg:border-r">
          <div className="flex shrink-0 items-center gap-2 border-b p-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-xl text-destructive disabled:opacity-30"
              disabled={!cart.length}
              onClick={() => setCart([])}
              aria-label="تفريغ السلة"
            >
              <Trash2 className="size-4" />
            </Button>

            <button
              type="button"
              onClick={() => setCustomerPickerOpen(o => !o)}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-2 text-sm font-bold"
            >
              <span className="truncate">{selectedCustomer?.name || 'عميل نقدي'}</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-xl"
              onClick={() => setCustomerDialog(true)}
            >
              <UserPlus className="size-4" />
            </Button>

            <span className="shrink-0 text-sm font-black">السلة ({cart.length})</span>
          </div>

          {customerPickerOpen && (
            <div className="pos-customer-picker absolute end-2 top-12 z-30 flex max-h-72 max-w-[calc(100%-1rem)] flex-wrap gap-2 overflow-y-auto rounded-2xl border bg-background p-2 shadow-xl">
              <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="ابحث عن العميل..." className="h-10 w-full rounded-xl border bg-muted/30 px-3 text-sm outline-none" />
              <button
                type="button"
                onClick={() => {
                  setCustomerId('')
                  setCustomerSearch('')
                  setCustomerPickerOpen(false)
                }}
                className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${
                  !customerId ? 'border-primary bg-primary/10' : 'bg-card'
                }`}
              >
                عميل نقدي
              </button>

              {visibleCustomers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCustomerId(c.id)
                    setCustomerSearch('')
                    setCustomerPickerOpen(false)
                  }}
                  className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${
                    customerId === c.id ? 'border-primary bg-primary/10' : 'bg-card'
                  }`}
                >
                  {c.name}
                </button>
              ))}

              {!visibleCustomers.length && <span className="py-2 text-xs text-muted-foreground">لا يوجد عميل مطابق</span>}
            </div>
          )}

          <div className="pos-cart-list min-h-0 flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed text-center text-muted-foreground">
                <ReceiptText className="mb-2 size-8 opacity-40" />
                <div className="text-sm font-bold">السلة فارغة</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map((it) => {
                  const key = lineKey(it)
                  return (
                  <div key={key} className="flex items-center gap-2 rounded-2xl border bg-card p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive"
                      onClick={() => removeItem(key)}
                    >
                      <X className="size-4" />
                    </Button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => changeQty(key, -1)}>
                        −
                      </Button>
                      <span className="min-w-6 text-center text-sm font-black tabular-nums">{it.quantity}</span>
                      <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => changeQty(key, 1)}>
                        +
                      </Button>
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      {user.role === 'cashier' ? (
                        <span className="block rounded-lg px-1.5 py-1 text-left text-sm font-black tabular-nums">
                          {money(it.price * it.quantity)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => editItemPrice(key)}
                          className="rounded-lg px-1.5 py-1 text-left text-sm font-black tabular-nums hover:bg-muted"
                          title="تعديل سعر البيع"
                        >
                          {money(it.price * it.quantity)}
                        </button>
                      )}
                      <div className="text-[10px] text-muted-foreground">سعر الوحدة: {money(it.price)}</div>
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                      <div className="truncate text-sm font-bold">{it.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {it.packLabel ? (
                          <span className="font-bold text-primary">{it.packLabel}</span>
                        ) : (
                          it.size || 'مقاس عام'
                        )}
                        {it.color ? ` · ${it.color}` : ''}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t bg-card p-2.5 pb-[max(.65rem,env(safe-area-inset-bottom))]">
            <div className="flex items-stretch gap-2">
              <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl border px-2 text-[11px]">
                <span className="text-muted-foreground">الخصم{user.role === 'cashier' ? ' · حتى 5%' : ''}</span>
                <button
                  type="button"
                  className="h-9 w-16 rounded-lg px-1 text-center font-black active:scale-95"
                  onClick={() =>
                    openNumericPad({
                      value: String(discount),
                      title: 'قيمة الخصم',
                      min: 0,
                      max: subtotal,
                      decimal: true,
                      onCommit: v => setDiscount(Math.max(0, Math.min(subtotal, Number(v) || 0))),
                    })
                  }
                  aria-label="قيمة الخصم"
                >
                  {discount}
                </button>
              </div>

              <div className="flex flex-1 items-center justify-between rounded-2xl bg-primary px-3 py-2 text-primary-foreground">
                <span className="text-xs font-bold opacity-90">الإجمالي</span>
                <span className="text-xl font-black tabular-nums">{money(total)}</span>
              </div>
            </div>

            <Button
              type="button"
              className="mt-1.5 h-12 w-full rounded-2xl text-base font-black"
              disabled={!cart.length || saveSalePending}
              onClick={() => {
                setPaid(total)
                setCheckout(true)
              }}
            >
              {saveSalePending ? 'جارٍ الحفظ...' : 'إنهاء الفاتورة'}
            </Button>
          </div>
        </div>
  )
}
