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
  LockKeyhole,
  Square,
  CheckCircle2,
  History,
  Pause,
  Play,
  Plus,
  ReceiptText,
  LogOut,
  Search,
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
import { SalesDialogs } from './sales/SalesDialogs'
import { ShiftDialogs } from './sales/ShiftDialogs'
import { UnitPickerDialog } from './sales/UnitPickerDialog'
import { CheckoutDialog } from './sales/CheckoutDialog'
import { QuickCustomerDialog } from './sales/QuickCustomerDialog'
import { ManagerApprovalDialog } from './sales/ManagerApprovalDialog'
import type { ApiError, CartItem, Customer, PaymentMethod, Product, Sale, SessionUser, Variant } from './sales/sales-types'

function money(v: number) {
  return `${formatEGP(v)} ج.م`
}

export function SalesSection({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const qc = useQueryClient()
  const setSection = useAppStore(s => s.setSection)

  const barcodeRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])

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


  interface OpenShift {
  id: string
  userId: string
  status: string
  openingFloat: number
  cashSales: number
  cardSales: number
  transferSales: number
  creditSales: number
  invoiceCount: number
  cashRefunds: number
  customerCash: number
  expectedCash: number
  totalSales: number
  openedAt?: string
  closedAt?: string | null
}

const { data: shiftData, isLoading: shiftLoading } = useQuery<{
  items: OpenShift[]
}>({
    queryKey: ['register-sessions'],
    queryFn: async () => {
      const r = await fetch('/api/register-sessions')
      if (!r.ok) throw new Error('register')
      return r.json()
    },
    refetchInterval: 30000,
  })

  const openShift = shiftData?.items?.find(x => x.status === 'open' && x.userId === user.id)

  type ShiftReport = { invoiceCount:number; cashSales:number; cardSales:number; transferSales:number; creditSales:number; customerCash:number; cashRefunds:number; openingFloat:number; expectedCash:number; closingFloat:number; difference:number; totalSales:number; cashIn?:number; cashOut?:number; expenses?:number; openedAt?:string; closedAt:string }
  const [shiftOpenDialog,setShiftOpenDialog]=useState(false)
  const [shiftCloseDialog,setShiftCloseDialog]=useState(false)
  const [shiftReport,setShiftReport]=useState<ShiftReport|null>(null)
  const [shiftPin,setShiftPin]=useState('')
  const [openingFloat,setOpeningFloat]=useState(0)
  const [closingFloat,setClosingFloat]=useState(0)
  const [shiftNotes,setShiftNotes]=useState('')
  const openShiftMutation=useMutation({mutationFn:async()=>{const r=await fetch('/api/register-sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openingFloat,pin:shiftPin,notes:shiftNotes})});const j=await r.json();if(!r.ok)throw new Error(j.error||'فشل فتح الوردية');return j},onSuccess:()=>{qc.invalidateQueries({queryKey:['register-sessions']});setShiftOpenDialog(false);setShiftPin('');setShiftNotes('');toast.success('تم فتح الوردية — يمكنك بدء البيع')},onError:(e:Error)=>toast.error(e.message)})
  const closeShiftMutation=useMutation({mutationFn:async()=>{if(!openShift)throw new Error('لا توجد وردية مفتوحة');const r=await fetch('/api/register-sessions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:openShift.id,closingFloat,pin:shiftPin,notes:shiftNotes})});const j=await r.json();if(!r.ok)throw new Error(j.error||'فشل إغلاق الوردية');return j},onSuccess:(j)=>{qc.invalidateQueries({queryKey:['register-sessions']});setShiftPin('');setShiftNotes('');setShiftCloseDialog(false);setShiftReport(j.report||null);toast.success('تم إغلاق الوردية بنجاح')},onError:(e:Error)=>toast.error(e.message)})

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


  const selectedCustomer = customers.find(c => c.id === customerId)
  const visibleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => c.name.toLowerCase().includes(q) || String(c.phone || '').includes(q))
  }, [customers, customerSearch])

  // Money is calculated in integer cents, exactly like the local API.
  // This prevents a displayed 1,050.00 from being rejected as 1,049.99/1,050.01
  // because of floating-point arithmetic or pack-price division.
  const subtotalCents = cart.reduce((sum, item) => sum + Math.round((Number(item.price) || 0) * 100) * item.quantity, 0)
  const discountCents = Math.max(0, Math.round((Number(discount) || 0) * 100))
  const totalCents = Math.max(0, subtotalCents - discountCents)
  const subtotal = subtotalCents / 100
  const total = totalCents / 100
  const paidCentsUi = Math.max(0, Math.round((Number(paid) || 0) * 100))
  const change = Math.max(0, (paidCentsUi - totalCents) / 100)
  const remaining = Math.max(0, (totalCents - paidCentsUi) / 100)

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

  function openQuantityPad(
    v: Variant,
    productName: string,
    pack?: { factor: number; price: number; unit: string; label: string },
  ) {
    const factor = pack?.factor ?? (Number(v.saleUnitFactor) || 1)
    const unitLabel = pack?.label || (v.saleUnit && v.saleUnit !== 'piece' ? v.saleUnit : 'قطعة')
    const maxQty = Math.floor(v.quantity / factor)

    if (maxQty < 1) return toast.error('لا يوجد مخزون كافٍ لهذه الوحدة')

    setUnitPickerFor(null)
    openNumericPad({
      value: '1',
      title: `كمية ${productName}${pack?.label ? ` — ${pack.label}` : ''}`,
      min: 1,
      max: maxQty,
      decimal: false,
      maxLength: String(maxQty).length,
      onCommit: value => {
        const quantity = Math.floor(Number(value) || 0)
        if (quantity < 1) return
        addVariant(v, productName, pack, quantity)
      },
    })
  }

  function chooseProduct(p: Product) {
    const available = p.variants.filter(v => v.quantity > 0)
    if (!available.length) return toast.error('الصنف غير متوفر')

    // POS flow intentionally hides size/color variants. Use the first available
    // stock line for this product and let the cashier choose the sale unit/quantity.
    const v = available[0]
    if (hasPackPricing(v)) {
      setUnitPickerFor({ v, productName: p.name })
      return
    }
    openQuantityPad(v, p.name)
  }

  function handlePickVariant(v: Variant, productName: string) {
    if (v.quantity <= 0) return toast.error('الصنف غير متوفر')
    if (hasPackPricing(v)) {
      setUnitPickerFor({ v, productName })
      return
    }
    openQuantityPad(v, productName)
  }

  function addVariant(
    v: Variant,
    productName = v.product.name,
    pack?: { factor: number; price: number; unit: string; label: string },
    requestedQuantity = 1,
  ) {
    if (v.quantity <= 0) return toast.error('الصنف غير متوفر')

    const factor = pack?.factor ?? (Number(v.saleUnitFactor) || 1)
    const unit = pack?.unit ?? (v.saleUnit || 'piece')
    const price = pack?.price ?? v.sellPrice
    const quantity = Math.max(1, Math.floor(Number(requestedQuantity) || 1))

    if (v.quantity < quantity * factor) return toast.error('لا يوجد مخزون كافٍ لهذه الكمية')

    setCart(prev => {
      const found = prev.find(i => i.variantId === v.id && i.unit === unit)

      if (found) {
        if ((found.quantity + quantity) * factor > v.quantity) {
          toast.error('لا يوجد مخزون كافٍ')
          return prev
        }
        return prev.map(i => (i === found ? { ...i, quantity: i.quantity + quantity } : i))
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
          quantity,
          max: v.quantity,
          unit,
          factor,
          packLabel: pack?.label,
        },
      ]
    })

    setUnitPickerFor(null)
    setSearch('')

    toast.success(
      `أُضيف للسلة: ${productName}${pack?.label ? ` (${pack.label})` : ''} × ${quantity}`,
      { duration: 1400 },
    )

    setTimeout(() => {
      barcodeRef.current?.focus()
    }, 50)
  }

  // Cart rows are targeted by their own stable identity (variantId+unit),
  // never by array position. A tap's pointerup/click can land a few dozen
  // milliseconds apart on Android WebView; if the list has already
  // reflowed in between (because an earlier tap removed a row above it),
  // an index-based lookup silently hits whatever row slid into that old
  // position — which is exactly what caused deleting one item to also
  // wipe out the ones after it. Keying by identity makes every action
  // hit the row it was actually meant for, no matter what shifted.
  function lineKey(x: { variantId: string; unit: string }) { return `${x.variantId}::${x.unit}` }

  function changeQty(key: string, delta: number) {
    setCart(c =>
      c.map(x =>
        lineKey(x) === key
          ? { ...x, quantity: Math.max(1, Math.min(Math.floor(x.max / x.factor), x.quantity + delta)) }
          : x
      )
    )
  }

  function removeItem(key: string) {
    setCart(c => c.filter(x => lineKey(x) !== key))
  }

  function editItemPrice(key: string) {
    const item = cart.find(x => lineKey(x) === key)
    if (!item) return
    openNumericPad({
      value: String(item.price),
      title: `سعر البيع — ${item.name}`,
      min: 0.01,
      decimal: true,
      onCommit: value => {
        const next = Number(value)
        if (!Number.isFinite(next) || next <= 0) return toast.error('السعر غير صحيح')
        setCart(current => current.map(row => lineKey(row) === key ? { ...row, price: Math.round(next * 100) / 100 } : row))
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
      registerSessionId: openShift?.id || undefined,
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
        unit: i.unit,
        factor: i.factor,
        // Send the exact line amount as integer cents. This is critical when
        // the same variant is sold once as a half-dozen and once as a dozen:
        // both can have the same rounded per-piece price, but their line
        // totals must remain independent.
        lineTotalCents: Math.max(0, Math.round(i.price * i.quantity * 100)),
        lineTotal: roundMoney(i.price * i.quantity),
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
    if (!openShift?.id) return toast.error('لا يمكن إنشاء فاتورة قبل فتح وردية. افتح الوردية ثم أعد المحاولة.')
    if (!cart.length) return toast.error('أضف صنفًا أولًا')
    if (discount > subtotal) return toast.error('الخصم أكبر من الإجمالي')
    if (paymentMethod === 'credit' && !customerId) return toast.error('اختر العميل للبيع الآجل')

    const safeTotal = totalCents / 100
    const safePaid = paymentMethod === 'credit' ? 0 : roundMoney(paid)
    const safePaidCents = moneyCents(safePaid)

    if (paymentMethod !== 'credit' && safePaidCents < totalCents) {
      return toast.error(`المبلغ المدفوع (${safePaid.toFixed(2)}) أقل من الإجمالي (${safeTotal.toFixed(2)})`)
    }

    // Use the exact cent-rounded total that is shown in the POS.
    // If the cashier entered the displayed total, never let a sub-cent
    // floating-point residue turn it into an underpayment.
    const normalizedPaid = safePaidCents >= totalCents ? safePaid : safePaid
    const payload = { ...buildSalePayload('completed'), paid: normalizedPaid }

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
    return <><Card className="mx-auto mt-8 max-w-xl p-8 text-center"><LockKeyhole className="mx-auto size-12 text-primary"/><h2 className="mt-4 text-2xl font-black">ابدأ وردية العمل</h2><p className="mt-2 text-muted-foreground">افتح ورديتك من هنا، وبعدها ستظهر لك نقطة البيع مباشرة.</p><Button type="button" className="mt-5 h-12" onClick={()=>setShiftOpenDialog(true)}><Play className="size-5"/> فتح الوردية</Button></Card><ShiftDialogs openShift={openShift} open={shiftOpenDialog} close={shiftCloseDialog} report={shiftReport} pin={shiftPin} openingFloat={openingFloat} closingFloat={closingFloat} notes={shiftNotes} openMutation={openShiftMutation} closeMutation={closeShiftMutation} setOpen={setShiftOpenDialog} setClose={setShiftCloseDialog} setReport={setShiftReport} setPin={setShiftPin} setOpeningFloat={setOpeningFloat} setClosingFloat={setClosingFloat} setNotes={setShiftNotes} /></>
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
            {user.role === 'cashier' && openShift && (
              <button
                type="button"
                className="inline-flex min-h-12 h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-destructive px-3 text-sm font-medium text-white shadow-sm touch-manipulation select-none active:scale-[.98]"
                onClick={() => {
                  setClosingFloat(0)
                  setShiftPin('')
                  setShiftNotes('')
                  setShiftCloseDialog(true)
                }}
                aria-label="إغلاق الوردية"
              >
                <Square className="size-4"/>
                <span className="hidden sm:inline">إغلاق الوردية</span>
              </button>
            )}
            {!openShift && <Button type="button" variant="outline" size="sm" className="h-10 rounded-2xl" onClick={()=>setShiftOpenDialog(true)}><Play className="size-4"/> فتح الوردية</Button>}

            <ReceiptText className="size-5 text-primary" />
            <b className="text-lg">نقطة البيع</b>
            {(user.role === 'admin' || user.role === 'cashier') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-2xl px-3 gap-1.5"
                onClick={onLogout}
                aria-label="تبديل المستخدم"
              >
                <LogOut className="size-4" />
                <span>تبديل المستخدم</span>
              </Button>
            )}

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
                    className="flex min-h-[9.5rem] w-full flex-col overflow-hidden rounded-2xl border bg-card p-2.5 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
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

                  </button>
                )
              })}
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
                      <button
                        type="button"
                        onClick={() => editItemPrice(key)}
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

      {/* Unit picker: units only, then quantity keypad */}
      <UnitPickerDialog unitPickerFor={unitPickerFor} setUnitPickerFor={setUnitPickerFor} openQuantityPad={openQuantityPad} money={money} />

      {/* Checkout */}
      <CheckoutDialog checkout={checkout} saveSalePending={saveSale.isPending} setCheckout={setCheckout} total={total} paymentMethod={paymentMethod} quickPay={quickPay} paid={paid} setPaid={setPaid} change={change} remaining={remaining} selectedCustomer={selectedCustomer} submit={submit} money={money} />

      {/* Quick customer */}
      <QuickCustomerDialog customerDialog={customerDialog} setCustomerDialog={setCustomerDialog} customerForm={customerForm} setCustomerForm={setCustomerForm} saveCustomerPending={saveCustomer.isPending} onSave={() => saveCustomer.mutate(customerForm)} />

      {/* Manager approval */}
      <ManagerApprovalDialog managerDialog={managerDialog} saveSalePending={saveSale.isPending} setManagerDialog={setManagerDialog} managerUsername={managerUsername} setManagerUsername={setManagerUsername} managerPin={managerPin} setManagerPin={setManagerPin} pendingSalePayload={pendingSalePayload} setPendingSalePayload={setPendingSalePayload} approveAndRetry={approveAndRetry} />

      <SalesDialogs
        printing={printing}
        viewing={viewing}
        historyOpen={historyOpen}
        sales={sales}
        salesLoading={salesQuery.isLoading}
        onPrintingChange={open => !open && setPrinting(null)}
        onViewingChange={setViewing}
        onHistoryChange={setHistoryOpen}
        onResumeDraft={resumeDraft}
        onShareReceipt={shareReceipt}
        onWhatsApp={sendReceiptWhatsApp}
      />
    <ShiftDialogs openShift={openShift} open={shiftOpenDialog} close={shiftCloseDialog} report={shiftReport} pin={shiftPin} openingFloat={openingFloat} closingFloat={closingFloat} notes={shiftNotes} openMutation={openShiftMutation} closeMutation={closeShiftMutation} setOpen={setShiftOpenDialog} setClose={setShiftCloseDialog} setReport={setShiftReport} setPin={setShiftPin} setOpeningFloat={setOpeningFloat} setClosingFloat={setClosingFloat} setNotes={setShiftNotes} />
    </div>
  )
}