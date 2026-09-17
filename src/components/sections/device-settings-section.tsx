'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Barcode, CheckCircle2, CircleHelp, Printer, RefreshCw, Save, Usb, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type PrinterInfo = { name: string; isDefault: boolean; workOffline: boolean; status: number; portName: string; driverName: string }
type DeviceConfig = { receiptPrinter: string; a4Printer: string; drawerPrinter: string; scannerName: string; scannerMode: string }

const DEFAULTS: DeviceConfig = { receiptPrinter: '', a4Printer: '', drawerPrinter: '', scannerName: '', scannerMode: 'usb-hid-keyboard' }

function getDeviceApi() { return typeof window !== 'undefined' ? window.taybaDevices : undefined }

export function DeviceSettingsSection() {
  const qc = useQueryClient()
  const [config, setConfig] = useState<DeviceConfig>(DEFAULTS)
  const [scanValue, setScanValue] = useState('')
  const [scanLast, setScanLast] = useState('')
  const [testing, setTesting] = useState('')

  const settings = useQuery<Record<string, string>>({
    queryKey: ['device-settings'],
    queryFn: async () => (await fetch('/api/store-settings')).json(),
  })
  const printers = useQuery<PrinterInfo[]>({
    queryKey: ['windows-printers'],
    queryFn: async () => getDeviceApi()?.listPrinters() || [],
  })

  useEffect(() => {
    if (!settings.data) return
    const raw = settings.data.deviceConfig
    if (!raw) return
    try { setConfig({ ...DEFAULTS, ...JSON.parse(raw) }) } catch { /* keep defaults */ }
  }, [settings.data])

  const printerNames = useMemo(() => (printers.data || []).map(p => p.name), [printers.data])
  const save = async () => {
    const res = await fetch('/api/store-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { deviceConfig: JSON.stringify(config) } }) })
    if (!res.ok) { toast.error('فشل حفظ إعدادات الأجهزة'); return }
    qc.invalidateQueries({ queryKey: ['device-settings'] })
    toast.success('تم حفظ تعريف الأجهزة')
  }
  const testPrint = async (mode: 'receipt'|'a4') => {
    const api = getDeviceApi(); if (!api) { toast.error('واجهة الأجهزة متاحة في نسخة Windows Desktop فقط'); return }
    const name = mode === 'receipt' ? config.receiptPrinter : config.a4Printer
    if (!name) { toast.error('اختر الطابعة أولاً'); return }
    setTesting(mode)
    try { await api.printTest(name, mode); toast.success('تم إرسال اختبار الطباعة') } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل الاختبار') } finally { setTesting('') }
  }
  const testDrawer = async () => {
    const api = getDeviceApi(); if (!api) { toast.error('فتح الدرج متاح في نسخة Windows Desktop فقط'); return }
    if (!config.drawerPrinter) { toast.error('اختر طابعة الدرج أولاً'); return }
    setTesting('drawer')
    try { await api.openDrawer(config.drawerPrinter); toast.success('تم إرسال نبضة فتح الدرج') } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل فتح الدرج') } finally { setTesting('') }
  }
  const handleScanKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); const value = scanValue.trim(); if (value) { setScanLast(value); setScanValue(''); toast.success(`تم استقبال باركود: ${value}`) } }
  }

  return <div className="space-y-6 pb-24">
    <div><h2 className="text-2xl font-black">تعريف الأجهزة والاتصال</h2><p className="text-sm text-muted-foreground">اربط طابعات الإيصالات وA4 والدرج وقارئ الباركود بنقطة البيع على Windows.</p></div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="size-5" /> الطابعات</CardTitle><CardDescription>يتم اكتشاف طابعات Windows المثبتة على الجهاز الحالي.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {!getDeviceApi() && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">لا يوجد اتصال Electron بهذه النسخة؛ هذه الصفحة تحفظ التعريفات فقط، بينما اكتشاف الطابعات والاختبارات يعمل على Windows Desktop.</div>}
        <div className="flex items-center gap-2"><Badge variant="outline">{printers.isLoading ? 'جارٍ الاكتشاف' : `${printerNames.length} طابعة`}</Badge><Button variant="outline" size="sm" onClick={()=>void printers.refetch()}><RefreshCw className="me-2 size-4"/>تحديث</Button></div>
        {printers.data?.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="p-3 text-start">الطابعة</th><th className="p-3 text-start">المنفذ</th><th className="p-3 text-start">التعريف</th><th className="p-3 text-start">الحالة</th></tr></thead><tbody>{printers.data.map(p=><tr key={p.name} className="border-b last:border-0"><td className="p-3 font-semibold">{p.name}{p.isDefault&&<Badge className="ms-2">افتراضية</Badge>}</td><td className="p-3 font-mono text-xs">{p.portName||'—'}</td><td className="p-3 text-xs text-muted-foreground">{p.driverName||'—'}</td><td className="p-3">{p.workOffline?<Badge variant="destructive">Offline</Badge>:<Badge variant="secondary">متاحة</Badge>}</td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">لم يتم العثور على طابعات Windows.</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {[['receiptPrinter','طابعة الإيصال الحراري'],['a4Printer','طابعة A4'],['drawerPrinter','الطابعة المتصلة بالدرج']].map(([key,label])=><div className="space-y-1.5" key={key}><Label>{label}</Label><select className="h-11 w-full rounded-xl border bg-background px-3" value={config[key as keyof DeviceConfig]} onChange={e=>setConfig(c=>({...c,[key]:e.target.value}))}><option value="">غير محدد</option>{printerNames.map(name=><option key={name} value={name}>{name}</option>)}</select></div>)}
        </div>
        <div className="flex flex-wrap gap-2"><Button onClick={()=>void testPrint('receipt')} disabled={testing==='receipt'}><Printer className="me-2 size-4"/>{testing==='receipt'?'جارٍ الاختبار...':'اختبار طابعة الإيصال'}</Button><Button variant="outline" onClick={()=>void testPrint('a4')} disabled={testing==='a4'}><Printer className="me-2 size-4"/>{testing==='a4'?'جارٍ الاختبار...':'اختبار A4'}</Button><Button variant="outline" onClick={()=>void testDrawer()} disabled={testing==='drawer'}><WalletCards className="me-2 size-4"/>{testing==='drawer'?'جارٍ الاختبار...':'اختبار فتح الدرج'}</Button></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Barcode className="size-5" /> قارئ الباركود</CardTitle><CardDescription>الأكثر موثوقية في Windows هو قارئ USB HID Keyboard Wedge؛ لا يحتاج Driver خاص داخل التطبيق.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>اسم/مكان الجهاز</Label><Input value={config.scannerName} onChange={e=>setConfig(c=>({...c,scannerName:e.target.value}))} placeholder="مثال: قارئ الكاشير 1"/></div><div className="space-y-1.5"><Label>وضع الاتصال</Label><select className="h-11 w-full rounded-xl border bg-background px-3" value={config.scannerMode} onChange={e=>setConfig(c=>({...c,scannerMode:e.target.value}))}><option value="usb-hid-keyboard">USB HID Keyboard</option><option value="bluetooth-hid-keyboard">Bluetooth HID Keyboard</option></select></div></div>
        <div className="rounded-xl border bg-muted/30 p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><Usb className="size-4"/> اختبار القراءة</div><Input autoFocus value={scanValue} onChange={e=>setScanValue(e.target.value)} onKeyDown={handleScanKey} placeholder="امسح باركود هنا ثم Enter" dir="ltr"/><div className="mt-2 text-xs text-muted-foreground">آخر قراءة: <span className="font-mono font-bold text-foreground">{scanLast||'لا توجد'}</span></div></div>
        <div className="flex items-start gap-2 rounded-xl border p-3 text-sm text-muted-foreground"><CircleHelp className="mt-0.5 size-4 shrink-0"/>لا نحاول قراءة USB Raw مباشرة من المتصفح؛ قارئ HID يتصرف كلوحة مفاتيح، لذلك تعمل نفس آلية البحث بالباركود الموجودة في نقطة البيع.</div>
      </CardContent>
    </Card>

    <div className="flex justify-end"><Button onClick={()=>void save()}><Save className="me-2 size-4"/>حفظ تعريف الأجهزة</Button></div>

    {settings.data?.deviceConfig && <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600"/> تم تحميل تعريفات الأجهزة المحفوظة.</div>}
  </div>
}
