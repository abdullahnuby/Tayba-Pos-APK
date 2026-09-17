'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Store, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { openNumericPad } from '@/components/numeric-pad'
import { clearLocalDatabase } from '@/lib/db/client'

interface StoreSettings {
  storeName: string
  storeAddress: string
  storePhone: string
  storeTaxNumber: string
  storeLogo: string
  receiptFooter: string
  vatEnabled: string
  vatRate: string
  vatInclusive: string
  saleInvoicePrefix: string
  purchaseInvoicePrefix: string
  returnPrefix: string
  currency: string
  loyaltyEnabled: string
  loyaltyRate: string
  [key: string]: string
}

export function StoreSettingsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<StoreSettings>({
    queryKey: ['store-settings'],
    queryFn: async () => (await fetch('/api/store-settings')).json(),
  })

  const [form, setForm] = useState<Partial<StoreSettings>>({})

  // Sync form once after settings are loaded; avoid state updates during render.
  useEffect(() => {
    if (data && Object.keys(form).length === 0) setForm(data)
  }, [data, form])

  const saveMutation = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const res = await fetch('/api/store-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error('فشل الحفظ')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-settings'] })
      toast.success('تم حفظ الإعدادات')
    },
    onError: () => toast.error('فشل الحفظ'),
  })

  function save() {
    if (!form) return
    // Convert booleans to strings
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      out[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v)
    }
    saveMutation.mutate(out)
  }

  function update(key: keyof StoreSettings, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: String(value) }))
  }

  if (isLoading || !form) {
    return <div className="text-muted-foreground">جارٍ التحميل...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">إعدادات المحل</h2>
        <p className="text-sm text-muted-foreground">معلومات المحل، الضريبة، الفواتير، نقاط الولاء</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="size-4" /> معلومات المحل
          </CardTitle>
          <CardDescription>تظهر في رأس الفاتورة والإيصالات</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sn">اسم المحل</Label>
            <Input id="sn" value={form.storeName || ''} onChange={(e) => update('storeName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp">الهاتف</Label>
            <Input id="sp" value={form.storePhone || ''} onChange={(e) => update('storePhone', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sa">العنوان</Label>
            <Input id="sa" value={form.storeAddress || ''} onChange={(e) => update('storeAddress', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st">السجل الضريبي</Label>
            <Input id="st" value={form.storeTaxNumber || ''} onChange={(e) => update('storeTaxNumber', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf">تذييل الإيصال</Label>
            <Input id="sf" value={form.receiptFooter || ''} onChange={(e) => update('receiptFooter', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات الضريبة (VAT)</CardTitle>
          <CardDescription>ضريبة القيمة المضافة — تركية 14% في مصر</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>تفعيل الضريبة</Label>
              <p className="text-xs text-muted-foreground">إظهار VAT على الفواتير</p>
            </div>
            <Switch checked={form.vatEnabled === 'true'} onCheckedChange={(c) => update('vatEnabled', c)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vr">نسبة الضريبة (%)</Label>
            <button type="button" className="flex h-12 w-full items-center justify-center rounded-xl border bg-background font-black" onClick={() => openNumericPad({ value: form.vatRate || '14', title: 'نسبة الضريبة (%)', min: 0, max: 100, decimal: true, onCommit: v => update('vatRate', v) })}>{form.vatRate || '14'}</button>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>شاملة في السعر</Label>
              <p className="text-xs text-muted-foreground">إن كانت الأسعار شاملة VAT</p>
            </div>
            <Switch checked={form.vatInclusive === 'true'} onCheckedChange={(c) => update('vatInclusive', c)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات الفواتير</CardTitle>
          <CardDescription>بادئات أرقام الفواتير</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sip">بادئة بيع</Label>
            <Input id="sip" value={form.saleInvoicePrefix || 'INV'} onChange={(e) => update('saleInvoicePrefix', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pip">بادئة شراء</Label>
            <Input id="pip" value={form.purchaseInvoicePrefix || 'PUR'} onChange={(e) => update('purchaseInvoicePrefix', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp">بادئة مرتجع</Label>
            <Input id="rp" value={form.returnPrefix || 'RET'} onChange={(e) => update('returnPrefix', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>GS1 Company Prefix (اختياري)</Label>
            <button type="button" onClick={() => openNumericPad({ title: 'GS1 Company Prefix', value: form.gs1CompanyPrefix || '', min: 0, decimal: false, maxLength: 11, onCommit: (v) => update('gs1CompanyPrefix', v) })} className="mt-1.5 flex h-12 w-full items-center justify-between rounded-xl border bg-background px-4 text-right font-mono font-bold">
              <span dir="ltr">{form.gs1CompanyPrefix || 'غير مضبوط'}</span><span className="text-xs font-sans text-muted-foreground">تُمنح رسميًا من GS1</span>
            </button>
            <p className="text-xs text-muted-foreground">عند ضبط Prefix رسمي خاص بالمحل، النظام يولّد GTIN-13 تلقائيًا. بدون Prefix سيستخدم باركودًا داخليًا EAN-13 الشكل.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نقاط الولاء</CardTitle>
          <CardDescription>برنامج نقاط للعملاء الدائمين</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>تفعيل النقاط</Label>
              <p className="text-xs text-muted-foreground">منح نقاط عند البيع</p>
            </div>
            <Switch checked={form.loyaltyEnabled === 'true'} onCheckedChange={(c) => update('loyaltyEnabled', c)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr">معدل النقاط (لكل ج.م)</Label>
            <button type="button" className="flex h-12 w-full items-center justify-center rounded-xl border bg-background font-black" onClick={() => openNumericPad({ value: form.loyaltyRate || '0.01', title: 'معدل النقاط (لكل ج.م)', min: 0, decimal: true, onCommit: v => update('loyaltyRate', v) })}>{form.loyaltyRate || '0.01'}</button>
            <p className="text-xs text-muted-foreground">0.01 = نقطة لكل 100 ج.م</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> مسح البيانات المحلية
          </CardTitle>
          <CardDescription>سيحذف جميع بيانات التطبيق المخزنة محليًا داخل الجهاز، بما في ذلك المخزون والفواتير واللياقة ونقاط البيع.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">هذه العملية لا تُسترجع. يفضّل أخذ نسخة احتياطية قبل المسح.</p>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                const confirmed = window.confirm('هل أنت متأكد؟ سيتم مسح جميع البيانات المحلية في هذا الجهاز، ولن يمكن استرجاعها إلا من نسخة احتياطية SQLite.')
                if (!confirmed) return

                try {
                  await clearLocalDatabase()
                  toast.success('تم مسح البيانات المحلية بنجاح')
                  window.location.reload()
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'تعذر مسح البيانات المحلية'
                  toast.error(message)
                }
              }}
            >
              <Trash2 className="size-4" /> مسح البيانات
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saveMutation.isPending} size="lg">
          <Save className="size-4" /> {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>
    </div>
  )
}
