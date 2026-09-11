import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { openNumericPad } from '@/components/numeric-pad'
import { ReceiptText, Trash2, UserPlus, X } from 'lucide-react'
import type { CartItem, Customer, SessionUser } from './sales-types'

interface CartPanelProps {
  user: SessionUser
  cart: CartItem[]
  customers: Customer[]
  customerId: string
  customerPickerOpen: boolean
  customerSearch: string
  selectedCustomer: Customer | undefined
  subtotal: number
  total: number
  discount: number
  saveSalePending: boolean
  onSetCart: (value: CartItem[] | ((current: CartItem[]) => CartItem[])) => void
  onCustomerPickerChange: (value: boolean) => void
  onCustomerSearchChange: (value: string) => void
  onCustomerChange: (value: string) => void
  onOpenCustomerDialog: () => void
  onSearchReset: () => void
  onDiscountChange: (value: number) => void
  onCheckout: () => void
  onRemoveItem: (index: number) => void
  onChangeQty: (index: number, delta: number) => void
  visibleCustomers: Customer[]
}

export function CartPanel({
  user,
  cart,
  customers,
  customerId,
  customerPickerOpen,
  customerSearch,
  selectedCustomer,
  subtotal,
  total,
  discount,
  saveSalePending,
  onSetCart,
  onCustomerPickerChange,
  onCustomerSearchChange,
  onCustomerChange,
  onOpenCustomerDialog,
  onSearchReset,
  onDiscountChange,
  onCheckout,
  onRemoveItem,
  onChangeQty,
  visibleCustomers,
}: CartPanelProps) {
  void customers
  void onSearchReset

  return (
    <div className="pos-cart min-h-0 flex max-h-[42dvh] shrink-0 flex-col border-t bg-background lg:max-h-none lg:h-full lg:border-t-0 lg:border-r">
      <div className="flex shrink-0 items-center gap-2 border-b p-2.5">
        <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl text-destructive disabled:opacity-30" disabled={!cart.length} onClick={() => onSetCart([])} aria-label="تفريغ السلة">
          <Trash2 className="size-4" />
        </Button>
        <button type="button" onClick={() => onCustomerPickerChange(!customerPickerOpen)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-2 text-sm font-bold">
          <span className="truncate">{selectedCustomer?.name || 'عميل نقدي'}</span>
        </button>
        <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-xl" onClick={onOpenCustomerDialog} aria-label="إضافة عميل">
          <UserPlus className="size-4" />
        </Button>
        <span className="shrink-0 text-sm font-black">السلة ({cart.length})</span>
      </div>

      {customerPickerOpen && (
        <div className="pos-customer-picker absolute end-2 top-12 z-30 flex max-h-72 max-w-[calc(100%-1rem)] flex-wrap gap-2 overflow-y-auto rounded-2xl border bg-background p-2 shadow-xl">
          <Input value={customerSearch} onChange={e => onCustomerSearchChange(e.target.value)} placeholder="ابحث عن العميل..." className="h-10 w-full bg-muted/30 text-sm" />
          <button type="button" onClick={() => { onCustomerChange(''); onCustomerSearchChange(''); onCustomerPickerChange(false) }} className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${!customerId ? 'border-primary bg-primary/10' : 'bg-card'}`}>
            عميل نقدي
          </button>
          {visibleCustomers.map(customer => (
            <button key={customer.id} type="button" onClick={() => { onCustomerChange(customer.id); onCustomerSearchChange(''); onCustomerPickerChange(false) }} className={`min-w-max rounded-xl border px-3 py-2 text-xs font-bold ${customerId === customer.id ? 'border-primary bg-primary/10' : 'bg-card'}`}>
              {customer.name}
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
            {cart.map((item, index) => (
              <div key={`${item.variantId}-${item.unit}`} className="flex items-center gap-2 rounded-2xl border bg-card p-2">
                <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" onClick={() => onRemoveItem(index)} aria-label={`حذف ${item.name}`}><X className="size-4" /></Button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => onChangeQty(index, -1)} aria-label="تقليل الكمية">−</Button>
                  <span className="min-w-6 text-center text-sm font-black tabular-nums">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => onChangeQty(index, 1)} aria-label="زيادة الكمية">+</Button>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="rounded-lg px-1.5 py-1 text-left text-sm font-black tabular-nums" aria-label="إجمالي الصنف">
                    {`${item.price * item.quantity}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ج.م
                  </div>
                  <div className="text-[10px] text-muted-foreground">سعر الوحدة: {item.price.toLocaleString('ar-EG')} ج.م</div>
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="truncate text-sm font-bold">{item.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{item.packLabel ? <span className="font-bold text-primary">{item.packLabel}</span> : item.size || 'مقاس عام'}{item.color ? ` · ${item.color}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-card p-2.5 pb-[max(.65rem,env(safe-area-inset-bottom))]">
        <div className="flex items-stretch gap-2">
          <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl border px-2 text-[11px]">
            <span className="text-muted-foreground">الخصم{user.role === 'cashier' ? ' · حتى 5%' : ''}</span>
            <button type="button" className="h-9 w-16 rounded-lg px-1 text-center font-black active:scale-95" onClick={() => openNumericPad({ value: String(discount), title: 'قيمة الخصم', min: 0, max: subtotal, decimal: true, onCommit: (value: string) => onDiscountChange(Math.max(0, Math.min(subtotal, Number(value) || 0))) })} aria-label="قيمة الخصم">{discount}</button>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-2xl bg-primary px-3 py-2 text-primary-foreground"><span className="text-xs font-bold opacity-90">الإجمالي</span><span className="text-xl font-black tabular-nums">{total.toLocaleString('ar-EG')} ج.م</span></div>
        </div>
        <Button type="button" className="mt-1.5 h-12 w-full rounded-2xl text-base font-black" disabled={!cart.length || saveSalePending} onClick={onCheckout}>{saveSalePending ? 'جارٍ الحفظ...' : 'إنهاء الفاتورة'}</Button>
      </div>
    </div>
  )
}
