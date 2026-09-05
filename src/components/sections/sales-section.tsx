'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { openNumericPad } from '@/components/numeric-pad'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Banknote,
  Barcode,
  CheckCircle2,
  Eye,
  History,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Share2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDateTime,
  formatEGP,
  saleStatusBadgeVariant,
  saleStatusLabel,
} from '@/lib/format'
import { useAppStore } from '@/lib/store'

type Role = 'admin' | 'manager' | 'cashier'

interface SessionUser {
  id: string
  username: string
  name: string
  role: Role
}

interface Variant {
  id: string
  sku: string
  barcode: string | null
  size: string | null
  color: string | null
  sellPrice: number
  quantity: number
  product: {
    id: string
    name: string
  }
  saleUnit?: string | null
  saleUnitFactor?: number | null
  quarterDozenPrice?: number | null
  halfDozenPrice?: number | null
  dozenPrice?: number | null
}

interface Product {
  id: string
  name: string
  category?: { id: string; name: string } | null
  variants: Variant[]
}

interface Customer {
  id: string
  name: string
  phone?: string | null
}

interface CartItem {
  variantId: string
  name: string
  sku: string
  size: string | null
  color: string | null
  price: number
  quantity: number
  max: number
  unit: string
  factor: number
  packLabel?: string
}

interface SaleItem {
  id: string
  quantity: number
  total: number
  variant: {
    product: { name: string }
    sku: string
    size: string | null
    color: string | null
  }
}

interface Sale {
  id: string
  invoiceNo: string
  date: string
  total: number
  paid: number
  change: number
  paymentMethod: string
  status: string
  customer?: { name: string; phone?: string | null } | null
  items: SaleItem[]
}

interface ApiError extends Error {
  needsManagerApproval?: boolean
}

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'

function money(v: number) {
  return `${formatEGP(v)} ج.م`
}

export function SalesSection({ user }: { user: SessionUser }) {
  const qc = useQueryClient()
  const setSection = useAppStore(s => s.setSection)

  const barcodeRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [unitPickerFor, setUnitPickerFor] = useState<{ v: Variant; productName: string } | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDialog, setCustomerDialog] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' })

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paid, setPaid] = useState(0)
  const [discount, setDiscount] = useState(0)

  const [checkout, setCheckout] = useState(false)
  const [historical, setHistorical] = useState(false)
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))

  const [historyOpen, setHistoryOpen] = useState(false)
  const [viewing, setViewing] = useState<Sale | null>(null)
  const [printing, setPrinting] = useState<Sale | null>(null)

  const [managerDialog, setManagerDialog] = useState(false)
  const [managerUsername, setManagerUsername] = useState('')
  const [managerPin, setManagerPin] = useState('')

  /**
   * IMPORTANT:
   * This stores the complete sale payload that was rejected
   * because manager approval is required.
   * It must NOT be used by customer creation.
   */
  const [pendingSalePayload, setPendingSalePayload] = useState<Record<string, unknown> | null>(null)

  const [productPage, setProductPage] = useState(0)

  const { data: shiftData, isLoading: shiftLoading } = useQuery<{
    items: Array<{ id: string; status: string; openingFloat: number }>
  }>({
    queryKey: ['register-sessions'],
    queryFn: async () => {
      const r = await fetch('/api/register-sessions')
      if (!r.ok) throw new Error('register')
      return r.json()
    },
    refetchInterval: 30000,
  })

  const openShift = shiftData?.items?.find(x => x.status === 'open')

  const productsQuery = useQuery<{ items: Product[] }>({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const r = await fetch('/api/products?pageSize=500')
      if (!r.ok) throw new Error('products')
      return r.json()
    },
    staleTime: 30000,
  })

  const customersQuery = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const r = await fetch('/api/customers')
      if (!r.ok) throw new Error('customers')
      return r.json()
    },
    staleTime: 30000,
  })

  const salesQuery = useQuery<{ items: Sale[] }>({
    queryKey: ['sales'],
    queryFn: async () => {
      const r = await fetch('/api/sales?pageSize=100')
      if (!r.ok) throw new Error('sales')
      return r.json()
    },
  })

  const products = (Array.isArray(productsQuery.data?.items) ? productsQuery.data.items : []).map(p => ({
    ...p,
    variants: Array.isArray(p.variants) ? p.variants : [],
  }))

  const customers: Customer[] = Array.isArray(customersQuery.data)
    ? customersQuery.data
    : Array.isArray((customersQuery.data as any)?.items)
      ? ((customersQuery.data as any).items as Customer[])
      : []

  const sales = (Array.isArray(salesQuery.data?.items) ? salesQuery.data.items : []).map(s => ({
    ...s,
    items: Array.isArray(s.items) ? s.items : [],
  }))

  const categoryCounts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of products) {
      const id = p.category?.id || 'none'
      const name = p.category?.name || 'بدون تصنيف'
      const cur = map.get(id)
      if (cur) cur.count += 1
      else map.set(id, { id, name, count: 1 })
    }
    return Array.from(map.values())
  }, [products])

  const categories = useMemo(
    () => [{ id: 'all', name: 'الكل', count: products.length }, ...categoryCounts],
    [products, categoryCounts]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter(
        p =>
          (category === 'all' || (p.category?.id || 'none') === category) &&
          (!q ||
            p.name.toLowerCase().includes(q) ||
            p.variants.some(v => v.sku.toLowerCase().includes(q) || (v.barcode || '').includes(q)))
      )
      .slice(0, 200)
  }, [products, search, category])

  const productPageSize = 12
  const productPageCount = Math.max(1, Math.ceil(visible.length / productPageSize))
  const visiblePage = visible.slice(productPage * productPageSize, (productPage + 1) * productPageSize)

  useEffect(() => {
    setProductPage(0)
  }, [search, category, visible.length])

  useEffect(() => {
    if (productPage >= productPageCount) {
      setProductPage(Math.max(0, productPageCount - 1))
    }
  }, [productPage, productPageCount])

  const selectedCustomer = customers.find(c => c.id === customerId)
  const visibleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => c.name.toLowerCase().includes(q) || String(c.phone || '').includes(q))
  }, [customers, customerSearch])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = Math.max(0, subtotal - discount)
  const change = Math.max(0, paid - total)
  const remaining = Math.max(0, total - paid)

  /**
   * Customer creation.
   * Manager approval must NEVER be triggered here.
   * Manager approval belongs to sales only.
   */
  const saveCustomer = useMutation<Customer, Error, { name: string; phone: string }>({
    mutationFn: async data => {
      const r = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'تعذر إضافة العميل')
      return j
    },
    onSuccess: c => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setCustomerId(c.id)
      setCustomerDialog(false)
      setCustomerForm({ name: '', phone: '' })
      toast.success('تم إضافة العميل')
    },
    onError: e => {
      toast.error(e.message)
    },
  })

  /**
   * Sale mutation.
   * This is where manager approval is handled.
   */
  const saveSale = useMutation<Sale, ApiError, Record<string, unknown>>({
    mutationFn: async payload => {
      const r = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) {
        const error = new Error(j.error || 'تعذر حفظ الفاتورة') as ApiError
        error.needsManagerApproval = Boolean(j.needsManagerApproval)
        throw error
      }
      return j as Sale
    },
    onSuccess: sale => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['pos-products'] })
      qc.invalidateQueries({ queryKey: ['register-sessions'] })

      setCheckout(false)
      setPendingSalePayload(null)

      if (sale.status === 'draft') {
        resetSale()
        toast.success(`تم تعليق الفاتورة ${sale.invoiceNo}`)
      } else {
        setPrinting(sale)
        resetSale()
        toast.success(`تمت الفاتورة ${sale.invoiceNo}`)
      }
    },
    onError: e => {
      if (
        e.needsManagerApproval ||
        e.message.includes('يحتاج موافقة المدير') ||
        e.message.includes('خارج حدود الكاشير') ||
        e.message.includes('موافقة المدير')
      ) {
        /**
         * IMPORTANT:
         * The rejected payload must already be stored by submit().
         * This mutation only opens the dialog.
         */
        setManagerDialog(true)
        return
      }
      toast.error(e.message)
    },
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      barcodeRef.current?.focus()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [])

  function resetSale() {
    setCart([])
    setCustomerId('')
    setCustomerPickerOpen(false)
    setCustomerSearch('')
    setPaymentMethod('cash')
    setPaid(0)
    setDiscount(0)
    setHistorical(false)
    setSaleDate(new Date().toISOString().slice(0, 10))
    setSearch('')
    setTimeout(() => {
      barcodeRef.current?.focus()
    }, 100)
  }

  function hasPackPricing(v: Variant) {
    return (v.quarterDozenPrice ?? 0) > 0 || (v.halfDozenPrice ?? 0) > 0 || (v.dozenPrice ?? 0) > 0
  }

  function chooseProduct(p: Product) {
    const available = p.variants.filter(v => v.quantity > 0)
    if (!available.length) return toast.error('الصنف غير متوفر')
    if (available.length === 1) return handlePickVariant(available[0], p.name)
    setSelectedProduct(p)
  }

  function handlePickVariant(v: Variant, productName: string) {
    if (v.quantity <= 0) return toast.error('الصنف غير متوفر')
    if (hasPackPricing(v)) setUnitPickerFor({ v, productName })
    else addVariant(v, productName)
  }

  function addVariant(
    v: Variant,
    productName = v.product.name,
    pack?: { factor: number; price: number; unit: string; label: string }
  ) {
    if (v.quantity <= 0) return toast.error('الصنف غير متوفر')

    const factor = pack?.factor ?? (Number(v.saleUnitFactor) || 1)
    const unit = pack?.unit ?? (v.saleUnit || 'piece')
    const price = pack?.price ?? v.sellPrice

    if (v.quantity < factor) return toast.error('لا يوجد مخزون كافٍ لهذه الوحدة')

    setCart(prev => {
      const found = prev.find(i => i.variantId === v.id && i.unit === unit)

      if (found) {
        if ((found.quantity + 1) * factor > v.quantity) {
          toast.error('لا يوجد مخزون كافٍ')
          return prev
        }
        return prev.map(i => (i === found ? { ...i, quantity: i.quantity + 1 } : i))
      }

      return [
        ...prev,
        {
          variantId: v.id,
          name: productName,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price,
          quantity: 1,
          max: v.quantity,
          unit,
          factor,
          packLabel: pack?.label,
        },
      ]
    })

    setSelectedProduct(null)
    setUnitPickerFor(null)
    setSearch('')

    setTimeout(() => {
      barcodeRef.current?.focus()
    }, 50)
  }

  function changeQty(index: number, delta: number) {
    setCart(c =>
      c.map((x, k) =>
        k === index
          ? { ...x, quantity: Math.max(1, Math.min(Math.floor(x.max / x.factor), x.quantity + delta)) }
          : x
      )
    )
  }

  function removeItem(index: number) {
    setCart(c => c.filter((_, k) => k !== index))
  }

  function editItemPrice(index: number) {
    const item = cart[index]
    if (!item) return
    openNumericPad({
      value: String(item.price),
      title: `سعر البيع — ${item.name}`,
      min: 0.01,
      decimal: true,
      onCommit: value => {
        const next = Number(value)
        if (!Number.isFinite(next) || next <= 0) return toast.error('السعر غير صحيح')
        setCart(current => current.map((row, k) => k === index ? { ...row, price: Math.round(next * 100) / 100 } : row))
      },
    })
  }

  function scanBarcode(code: string) {
    const normalized = code.trim()
    if (!normalized) return

    const found = products
      .flatMap(p => p.variants.map(v => ({ v, name: p.name })))
      .find(x => x.v.barcode === normalized || x.v.sku === normalized)

    if (found) handlePickVariant(found.v, found.name)
    else toast.error('الباركود غير موجود')
  }

  function roundMoney(value: number) {
    return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100
  }

  function moneyCents(value: number) {
    return Math.round((Number(value) || 0) * 100)
  }

  function buildSalePayload(status: 'completed' | 'draft'): Record<string, unknown> {
    const safePaid = status === 'draft' || paymentMethod === 'credit' ? 0 : roundMoney(paid)

    return {
      customerId: customerId || undefined,
      date: status === 'completed' && historical && user.role !== 'cashier' ? saleDate : undefined,
      discount: roundMoney(discount),
      paid: safePaid,
      paymentMethod: status === 'draft' ? (paymentMethod === 'credit' ? 'credit' : 'cash') : paymentMethod,
      status,
      items: cart.map(i => ({
        variantId: i.variantId,
        quantity: i.quantity * i.factor,
        unitPrice: roundMoney(i.price / i.factor),
      })),
      idempotencyKey: `${user.id}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
  }

  function holdSale() {
    if (!cart.length) return toast.error('أضف صنفًا أولًا')
    const payload = buildSalePayload('draft')
    setPendingSalePayload(null)
    saveSale.mutate(payload)
  }

  async function resumeDraft(s: Sale) {
    try {
      const r = await fetch(`/api/sales/${s.id}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'تعذر تحميل الفاتورة')

      const next: CartItem[] = (j.items || []).map((item: any) => {
        const variantId = item.variant_id || item.variantId
        const v = products.flatMap(p => p.variants).find(x => x.id === variantId)

        return {
          variantId,
          name: item.product_name || item.variant?.product?.name || v?.product?.name || 'صنف',
          sku: item.sku || v?.sku || '',
          size: item.size ?? v?.size ?? null,
          color: item.color ?? v?.color ?? null,
          price: Number(item.unit_price ?? item.unitPrice ?? v?.sellPrice ?? 0),
          quantity: Number(item.quantity || 0),
          max: Number(v?.quantity ?? 0) + Number(item.quantity || 0),
          unit: item.unit || 'piece',
          factor: Number(item.factor) || 1,
        }
      })

      setCart(next)
      setCustomerId(j.customer_id || '')
      setDiscount(Number(j.discount || 0))
      setPaymentMethod('cash')
      setPaid(0)
      setViewing(null)
      setHistoryOpen(false)

      toast.success(`تم استئناف الفاتورة ${s.invoiceNo}`)
    } catch (e: any) {
      toast.error(e?.message || 'تعذر الاستئناف')
    }
  }

  function quickPay(m: PaymentMethod) {
    setPaymentMethod(m)
    setPaid(m === 'credit' ? 0 : total)
  }

  /**
   * Re-submit the EXACT rejected sale payload after manager approval.
   */
  function approveAndRetry() {
    if (!pendingSalePayload) {
      toast.error('لا توجد فاتورة معلقة للموافقة')
      return
    }

    if (!managerUsername.trim() || !/^\d{4}$/.test(managerPin)) {
      toast.error('أدخل اسم المدير وPIN من 4 أرقام')
      return
    }

    const approvedPayload = {
      ...pendingSalePayload,
      managerApproved: true,
      managerUsername: managerUsername.trim(),
      managerPin,
    }

    setManagerDialog(false)
    setManagerUsername('')
    setManagerPin('')

    saveSale.mutate(approvedPayload)
  }

  function submit() {
    if (!cart.length) return toast.error('أضف صنفًا أولًا')
    if (discount > subtotal) return toast.error('الخصم أكبر من الإجمالي')
    if (paymentMethod === 'credit' && !customerId) return toast.error('اختر العميل للبيع الآجل')

    const safeTotal = roundMoney(total)
    const safePaid = paymentMethod === 'credit' ? 0 : roundMoney(paid)

    if (paymentMethod !== 'credit' && moneyCents(safePaid) < moneyCents(safeTotal)) {
      return toast.error(`المبلغ المدفوع (${safePaid.toFixed(2)}) أقل من الإجمالي (${safeTotal.toFixed(2)})`)
    }

    const payload = { ...buildSalePayload('completed'), paid: safePaid }

    /**
     * CRITICAL:
     * Save the payload BEFORE calling the API.
     * If the API returns needsManagerApproval, the exact same
     * payload will be retried after manager authorization.
     */
    setPendingSalePayload(payload)
    saveSale.mutate(payload)
  }

  function receiptText(s: Sale) {
    const lines = [`طيبة`, `فاتورة رقم: ${s.invoiceNo}`, `التاريخ: ${formatDateTime(s.date)}`]

    for (const item of s.items || []) {
      lines.push(`${item.variant?.product?.name || 'صنف'} × ${item.quantity} = ${money(item.total)}`)
    }

    lines.push(`الإجمالي: ${money(s.total)}`, `المدفوع: ${money(s.paid)}`, `الباقي: ${money(s.change)}`)

    if (s.customer?.name) lines.push(`العميل: ${s.customer.name}`)

    lines.push('شكرًا لزيارتكم')
    return lines.join('\n')
  }

  function shareReceipt(s: Sale) {
    const text = receiptText(s)

    if (navigator.share) {
      void navigator.share({ title: `فاتورة ${s.invoiceNo}`, text }).catch(() => {})
    } else {
      void navigator.clipboard?.writeText(text)
      toast.success('تم نسخ ملخص الفاتورة')
    }
  }

  function normalizeWhatsAppPhone(raw: string) {
    let phone = raw.replace(/\D/g, '')
    if (phone.startsWith('00')) phone = phone.slice(2)
    if (phone.startsWith('01') && phone.length === 11) phone = `20${phone.slice(1)}`
    return phone
  }

  function sendReceiptWhatsApp(s: Sale) {
    const phone = normalizeWhatsAppPhone(String(s.customer?.phone || ''))
    if (!phone) return toast.error('أضف رقم واتساب للعميل أولًا')

    const message = encodeURIComponent(receiptText(s))
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  if (user.role === 'cashier' && shiftLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }

  if (user.role === 'cashier' && !openShift) {
    return (
      <Card className="mx-auto mt-8 max-w-xl p-8 text-center">
        <Banknote className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 text-2xl font-black">الوردية غير مفتوحة</h2>
        <p className="mt-2 text-muted-foreground">لا يمكن للكاشير إصدار فواتير قبل فتح الوردية.</p>
        <Button className="mt-5 h-12" onClick={() => setSection('register')}>
          فتح الوردية
        </Button>
      </Card>
    )
  }

  return (
    <div
      className={
        (user.role === 'cashier' ? 'cashier-pos ' : '') +
        'flex h-[100dvh] flex-col overflow-hidden bg-muted/10 lg:h-auto lg:min-h-[calc(100vh-8rem)] lg:rounded-3xl lg:border'
      }
    >
      {/* Top bar */}
      <div className="pos-topbar shrink-0 border-b bg-background px-3 py-2 sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-2xl lg:hidden"
              onClick={() => setSection('register')}
              aria-label="الوردية"
            >
              <Banknote className="size-5" />
            </Button>

            <ReceiptText className="size-5 text-primary" />
            <b className="text-lg">نقطة البيع</b>

            {openShift && <Badge className="hidden xs:inline-flex">وردية مفتوحة</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-2xl"
              onClick={() => setHistoryOpen(true)}
              aria-label="سجل الفواتير"
            >
              <History className="size-5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-2xl"
              disabled={!cart.length || saveSale.isPending}
              onClick={holdSale}
              aria-label="تعليق الفاتورة"
            >
              <Pause className="size-5" />
            </Button>

            {user.role !== 'cashier' && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-2xl"
                onClick={() => setHistorical(v => !v)}
              >
                {historical ? 'بيع عادي' : 'مبيعات سابقة'}
              </Button>
            )}
          </div>
        </div>

        {historical && (
          <div className="mt-2.5 flex flex-wrap items-end gap-3 rounded-2xl border bg-muted/30 p-3">
            <div>
              <Label className="text-xs">تاريخ الفاتورة الورقية</Label>
              <Input
                type="date"
                value={saleDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setSaleDate(e.target.value)}
                className="mt-1 h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">لإدخال فواتير الورق بتاريخها الحقيقي.</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="pos-searchbar shrink-0 border-b bg-background px-3 py-2 sm:px-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const code = e.currentTarget.value.trim()
                  if (!code) return
                  const found = products.flatMap(p => p.variants.map(v => ({ v, name: p.name }))).find(x => x.v.barcode === code || x.v.sku === code)
                  if (found) { scanBarcode(code); setSearch('') }
                }
              }}
              className="h-12 w-full rounded-2xl border bg-muted/30 px-11 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="ابحث بالباركود أو الاسم أو SKU..."
            />
          </div>

          <input
            ref={barcodeRef}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                scanBarcode((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            inputMode="none"
            autoComplete="off"
            className="absolute size-px opacity-0"
            tabIndex={-1}
            aria-hidden
          />

          <Button
            type="button"
            size="icon"
            className="size-12 shrink-0 rounded-2xl"
            onClick={() => {
              const code = prompt('أدخل الباركود')
              if (code) scanBarcode(code)
            }}
            aria-label="مسح باركود"
          >
            <Barcode className="size-5" />
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="pos-categories shrink-0 border-b bg-background px-3 py-1.5 sm:px-3">
        {user.role === 'cashier' ? (
          <select
            aria-label="تصنيف المنتجات"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-9 w-full rounded-xl border bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex min-w-max items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black active:scale-[.98] ${
                  category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'
                }`}
              >
                <span>{c.name}</span>
                <span className={category === c.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                  ({c.count})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="pos-body flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[1fr_400px]">
        {/* Products */}
        <div className="pos-products-pane min-h-0 flex-1 overflow-y-auto p-3 sm:p-3">
          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-[9.5rem] rounded-2xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">لا توجد أصناف مطابقة</div>
          ) : (
            <div className="pos-product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-2.5">
              {visiblePage.map(p => {
                const stock = p.variants.reduce((s, v) => s + v.quantity, 0)
                const minPrice = p.variants.length ? Math.min(...p.variants.map(v => v.sellPrice)) : 0
                const outOfStock = stock === 0

                return (
                  <div
                    key={p.id}
                    className="flex min-h-[9.5rem] flex-col rounded-2xl border bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[.99]"
                  >
                    <div className="min-h-[2.5rem]">
                      <div className="line-clamp-2 text-[13px] font-black leading-5" title={p.name}>
                        {p.name}
                      </div>
                    </div>

                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {p.variants.length} {p.variants.length === 1 ? 'خيار' : 'مقاسات/ألوان'}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-1">
                      <span className="text-[13px] font-black leading-tight text-primary">{money(minPrice)}</span>
                      <span
                        className={`text-[10px] font-bold ${outOfStock ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {outOfStock ? 'نفد' : `المخزون: ${stock}`}
                      </span>
                    </div>

                    <Button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => chooseProduct(p)}
                      className="mt-2 h-8 w-full rounded-xl px-1 text-[11px] font-black active:scale-[.98]"
                    >
                      <Plus className="me-1 size-3.5" />
                      إضافة
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {productPageCount > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3"
                disabled={productPage === 0}
                onClick={() => setProductPage(p => Math.max(0, p - 1))}
              >
                السابق
              </Button>

              <span className="text-[11px] font-bold text-muted-foreground">
                {productPage + 1} / {productPageCount}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3"
                disabled={productPage >= productPageCount - 1}
                onClick={() => setProductPage(p => Math.min(productPageCount - 1, p + 1))}
              >
                التالي
              </Button>
            </div>
          )}
        </div>

        {/* Cart */}
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
                {cart.map((it, i) => (
                  <div key={`${it.variantId}-${it.unit}`} className="flex items-center gap-2 rounded-2xl border bg-card p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive"
                      onClick={() => removeItem(i)}
                    >
                      <X className="size-4" />
                    </Button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => changeQty(i, -1)}>
                        −
                      </Button>
                      <span className="min-w-6 text-center text-sm font-black tabular-nums">{it.quantity}</span>
                      <Button variant="outline" size="icon" className="size-8 rounded-xl" onClick={() => changeQty(i, 1)}>
                        +
                      </Button>
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <button
                        type="button"
                        onClick={() => editItemPrice(i)}
                        className="rounded-lg px-1.5 py-1 text-left text-sm font-black tabular-nums hover:bg-muted"
                        title="تعديل سعر البيع"
                      >
                        {money(it.price * it.quantity)}
                      </button>
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
                ))}
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
              disabled={!cart.length || saveSale.isPending}
              onClick={() => {
                setPaid(total)
                setCheckout(true)
              }}
            >
              {saveSale.isPending ? 'جارٍ الحفظ...' : 'إنهاء الفاتورة'}
            </Button>
          </div>
        </div>
      </div>

      {/* Variant picker */}
      <Dialog open={!!selectedProduct} onOpenChange={(o: boolean) => !o && setSelectedProduct(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-3xl p-4">
          <DialogHeader>
            <DialogTitle>اختيار المقاس واللون</DialogTitle>
            <DialogDescription>{selectedProduct?.name}</DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(selectedProduct.variants || [])
                .filter((v: Variant) => v.quantity > 0)
                .map((v: Variant) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handlePickVariant(v, selectedProduct.name)}
                    className="min-h-28 rounded-3xl border p-4 text-right active:scale-[.98]"
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

      {/* Unit picker */}
      <Dialog open={!!unitPickerFor} onOpenChange={o => !o && setUnitPickerFor(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
          <DialogHeader>
            <DialogTitle>اختيار وحدة البيع</DialogTitle>
            <DialogDescription>
              {unitPickerFor?.productName}
              {unitPickerFor?.v.size ? ` · ${unitPickerFor.v.size}` : ''}
            </DialogDescription>
          </DialogHeader>

          {unitPickerFor && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => addVariant(unitPickerFor.v, unitPickerFor.productName)}
                className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98]"
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
                  onClick={() =>
                    addVariant(unitPickerFor.v, unitPickerFor.productName, {
                      factor: 3,
                      price: unitPickerFor.v.quarterDozenPrice!,
                      unit: 'quarter-dozen',
                      label: 'ربع دستة',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
                >
                  <div>
                    <div className="font-black">ربع دستة (3 قطع)</div>
                    <div className="text-xs text-muted-foreground">
                      {unitPickerFor.v.quantity < 3 ? 'مخزون غير كافٍ' : `يلزم 3 من ${unitPickerFor.v.quantity}`}
                    </div>
                  </div>
                  <span className="text-lg font-black text-primary">{money(unitPickerFor.v.quarterDozenPrice)}</span>
                </button>
              )}

              {!!unitPickerFor.v.halfDozenPrice && (
                <button
                  type="button"
                  disabled={unitPickerFor.v.quantity < 6}
                  onClick={() =>
                    addVariant(unitPickerFor.v, unitPickerFor.productName, {
                      factor: 6,
                      price: unitPickerFor.v.halfDozenPrice!,
                      unit: 'half-dozen',
                      label: 'نص دستة',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
                >
                  <div>
                    <div className="font-black">نص دستة (6 قطع)</div>
                    <div className="text-xs text-muted-foreground">
                      {unitPickerFor.v.quantity < 6 ? 'مخزون غير كافٍ' : `يلزم 6 من ${unitPickerFor.v.quantity}`}
                    </div>
                  </div>
                  <span className="text-lg font-black text-primary">{money(unitPickerFor.v.halfDozenPrice)}</span>
                </button>
              )}

              {!!unitPickerFor.v.dozenPrice && (
                <button
                  type="button"
                  disabled={unitPickerFor.v.quantity < 12}
                  onClick={() =>
                    addVariant(unitPickerFor.v, unitPickerFor.productName, {
                      factor: 12,
                      price: unitPickerFor.v.dozenPrice!,
                      unit: 'dozen',
                      label: 'دستة',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-2xl border p-4 text-right active:scale-[.98] disabled:opacity-40"
                >
                  <div>
                    <div className="font-black">دستة (12 قطعة)</div>
                    <div className="text-xs text-muted-foreground">
                      {unitPickerFor.v.quantity < 12 ? 'مخزون غير كافٍ' : `يلزم 12 من ${unitPickerFor.v.quantity}`}
                    </div>
                  </div>
                  <span className="text-lg font-black text-primary">{money(unitPickerFor.v.dozenPrice)}</span>
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog open={checkout} onOpenChange={v => !saveSale.isPending && setCheckout(v)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-4">
          <DialogHeader>
            <DialogTitle>تأكيد البيع — {money(total)}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['cash', 'نقدي'],
                ['card', 'بطاقة'],
                ['transfer', 'تحويل'],
                ['credit', 'آجل'],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                onClick={() => quickPay(m)}
                className={`min-h-16 rounded-xl border p-1.5 font-black active:scale-[.98] ${
                  paymentMethod === m ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'bg-card'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {paymentMethod !== 'credit' && (
            <div className="mt-2">
              <Label>المبلغ المستلم</Label>
              <button
                type="button"
                className="mt-1 flex h-12 w-full items-center justify-center rounded-xl border bg-background text-xl font-black tabular-nums"
                onClick={() =>
                  openNumericPad({
                    value: String(paid),
                    title: 'المبلغ المستلم',
                    min: 0,
                    decimal: true,
                    onCommit: v => setPaid(Math.max(0, Number(v) || 0)),
                  })
                }
              >
                {paid}
              </button>
            </div>
          )}

          {paymentMethod !== 'credit' && (
            <div className="mt-2 rounded-xl bg-muted p-3 text-sm">
              {change > 0 ? (
                <>
                  الباقي: <b className="text-primary">{money(change)}</b>
                </>
              ) : remaining > 0 ? (
                <>
                  متبقي: <b className="text-destructive">{money(remaining)}</b>
                </>
              ) : (
                'المبلغ مكتمل'
              )}
            </div>
          )}

          {paymentMethod === 'credit' && (
            <div className="mt-2 rounded-xl bg-muted p-3 text-sm">
              المتبقي على العميل ({selectedCustomer?.name || 'اختر عميلًا'}): <b>{money(total)}</b>
            </div>
          )}

          <Button className="mt-2 h-14 w-full rounded-2xl text-base font-black" disabled={saveSale.isPending} onClick={submit}>
            {saveSale.isPending ? 'جارٍ الحفظ...' : 'تأكيد البيع'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Quick customer */}
      <Dialog open={customerDialog} onOpenChange={v => !saveCustomer.isPending && setCustomerDialog(v)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>إضافة عميل سريع</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input
                value={customerForm.name}
                onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label>الهاتف</Label>
              <Input
                value={customerForm.phone}
                onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)} disabled={saveCustomer.isPending}>
              إلغاء
            </Button>
            <Button
              onClick={() => saveCustomer.mutate(customerForm)}
              disabled={saveCustomer.isPending || !customerForm.name.trim()}
            >
              {saveCustomer.isPending ? 'جارٍ الحفظ...' : 'حفظ العميل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager approval */}
      <Dialog
        open={managerDialog}
        onOpenChange={v => {
          if (!saveSale.isPending) {
            setManagerDialog(v)
            if (!v) {
              setManagerUsername('')
              setManagerPin('')
              setPendingSalePayload(null)
            }
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>موافقة المدير مطلوبة</DialogTitle>
            <DialogDescription>
              السعر خارج حدود الكاشير. استخدم اسم المدير وPIN من 4 أرقام للموافقة على الفاتورة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>اسم مستخدم المدير</Label>
              <Input value={managerUsername} onChange={e => setManagerUsername(e.target.value)} dir="ltr" autoFocus />
            </div>

            <div>
              <Label>PIN المدير</Label>
              <button
                type="button"
                onClick={() =>
                  openNumericPad({
                    value: managerPin,
                    title: 'PIN المدير — 4 أرقام',
                    decimal: false,
                    maxLength: 4,
                    password: true,
                    onCommit: setManagerPin,
                  })
                }
                className="flex h-14 w-full items-center justify-center rounded-2xl border bg-background text-xl font-black tracking-[0.55em]"
              >
                {managerPin ? '•'.repeat(managerPin.length) : 'أدخل PIN من 4 أرقام'}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setManagerDialog(false)
                setManagerUsername('')
                setManagerPin('')
                setPendingSalePayload(null)
              }}
              disabled={saveSale.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={approveAndRetry}
              disabled={saveSale.isPending || !managerUsername.trim() || managerPin.length !== 4 || !pendingSalePayload}
            >
              {saveSale.isPending ? 'جارٍ التحقق...' : 'تأكيد الموافقة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!printing} onOpenChange={v => !v && setPrinting(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>الفاتورة تمت بنجاح</DialogTitle>
          </DialogHeader>

          {printing && (
            <div id="printable-invoice" className="rounded-xl border bg-white p-4 text-black">
              <div className="text-center text-xl font-black">طيبة</div>
              <div className="mt-2 text-sm">فاتورة: {printing.invoiceNo}</div>
              <div className="text-sm">التاريخ: {formatDateTime(printing.date)}</div>

              {(printing.items || []).map(i => (
                <div key={i.id} className="flex justify-between border-b py-2 text-sm">
                  <span>
                    {i.variant?.product?.name || 'صنف'} × {i.quantity}
                  </span>
                  <b>{money(i.total)}</b>
                </div>
              ))}

              <div className="mt-3 flex justify-between font-black">
                <span>الإجمالي</span>
                <span>{money(printing.total)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => window.print()}>
              <Printer className="size-4" />
              طباعة
            </Button>
            <Button variant="outline" onClick={() => printing && shareReceipt(printing)}>
              <Share2 className="size-4" />
              مشاركة
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 rounded-2xl" onClick={() => printing && sendReceiptWhatsApp(printing)}>
              <MessageCircle className="size-4" />
              إرسال واتساب
            </Button>
            <Button className="h-12 rounded-2xl" onClick={() => setPrinting(null)}>
              <CheckCircle2 className="size-4" />
              فاتورة جديدة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل الفواتير</DialogTitle>
          </DialogHeader>

          {salesQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-2">
              {sales.map(s => (
                <div key={s.id} className="rounded-xl border p-3">
                  <div className="flex justify-between">
                    <b>{s.invoiceNo}</b>
                    <Badge variant={saleStatusBadgeVariant(s.status)}>{saleStatusLabel(s.status)}</Badge>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(s.date)} · {s.customer?.name || 'عميل نقدي'}
                  </div>

                  <div className="mt-2 flex justify-between gap-2">
                    <b>{money(s.total)}</b>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setViewing(s)}>
                        <Eye className="size-4" />
                        عرض
                      </Button>
                      {s.status === 'draft' && (
                        <Button size="sm" onClick={() => resumeDraft(s)}>
                          <Play className="size-4" />
                          استئناف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!sales.length && <div className="py-10 text-center text-sm text-muted-foreground">لا توجد فواتير</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View invoice */}
      <Dialog open={!!viewing} onOpenChange={v => !v && setViewing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>الفاتورة {viewing?.invoiceNo}</DialogTitle>
          </DialogHeader>

          {viewing && (
            <div className="space-y-2">
              {(viewing.items || []).map(i => (
                <div key={i.id} className="flex justify-between rounded-xl border p-3">
                  <span>
                    {i.variant?.product?.name || 'صنف'} × {i.quantity}
                  </span>
                  <b>{money(i.total)}</b>
                </div>
              ))}

              <div className="flex justify-between rounded-xl bg-muted p-3">
                <span>الإجمالي</span>
                <b>{money(viewing.total)}</b>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}