'use client'

import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Database, Download, FileSpreadsheet, FolderOpen, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductExcelTools } from './ProductExcelTools'
import { deleteDesktopBackup, isDesktopBackupAvailable, listDesktopBackups, openDesktopBackupFolder, type BackupEntry } from '@/lib/services/desktopBackupService'
import { saveBackupFile, type BackupSaveResult } from '@/lib/services/backupFileService'

export function SyncSection() {
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState<BackupSaveResult | null>(null)
  const desktopBackupEnabled = isDesktopBackupAvailable()

  const backups = useQuery<BackupEntry[]>({
    queryKey: ['desktop-backups'],
    queryFn: listDesktopBackups,
    enabled: desktopBackupEnabled,
  })

  const reconciliation = useQuery<any>({
    queryKey: ['reconciliation'],
    queryFn: async () => { const r=await fetch('/api/reconciliation'); if(!r.ok) throw new Error('reconciliation'); return r.json() },
    refetchInterval: 30000,
  })

  const health = useQuery<any>({
    queryKey: ['infrastructure-health'],
    queryFn: async () => { const r=await fetch('/api/infrastructure/health'); if(!r.ok) throw new Error('health'); return r.json() },
    refetchInterval: 30000,
  })

  async function downloadLocalBackup() {
    setBackupBusy(true)
    try {
      const result = await saveBackupFile()
      if (result.status === 'cancelled') {
        toast.info('تم إلغاء الحفظ', { description: result.note })
        return
      }
      setLastBackup(result)
      toast.success(result.status === 'saved' ? 'تم حفظ النسخة الاحتياطية' : 'تم تجهيز النسخة الاحتياطية', {
        description: `${result.location}${result.note ? ` — ${result.note}` : ''}`,
        duration: 12000,
      })
    } catch(e){ toast.error(e instanceof Error?e.message:'فشل إنشاء النسخة الاحتياطية') }
    finally{ setBackupBusy(false) }
  }

  async function restoreFromFile(file: File) {
    setRestoreBusy(true)
    try {
      const bytes=new Uint8Array(await file.arrayBuffer())
      const { restoreDatabaseBytes, createLocalArchive }=await import('@/lib/services/archiveService')
      // Safety net: keep a copy of the CURRENT data before it is replaced, so a wrong
      // file never means lost data. If this copy cannot be made, stop — do not restore blind.
      try { await createLocalArchive('pre-restore') } catch { throw new Error('تعذر أخذ نسخة أمان من البيانات الحالية قبل الاستعادة، لذلك تم إيقاف الاستعادة.') }
      await restoreDatabaseBytes(bytes)
      toast.success('تمت الاستعادة بنجاح. سيتم إعادة تحميل البرنامج.')
      setTimeout(()=>window.location.reload(),500)
    } catch(e){ toast.error(e instanceof Error?e.message:'النسخة الاحتياطية غير صالحة') }
    finally{ setRestoreBusy(false) }
  }

  const dbState=health.data?.localDatabase ? 'جاهزة' : 'غير متاحة'

  return <div className="space-y-6 pb-24">
    <div>
      <h2 className="text-2xl font-black tracking-tight">البيانات والنسخ الاحتياطي</h2>
      <p className="text-sm text-muted-foreground">قاعدة SQLite المحلية هي مصدر البيانات الوحيد للتشغيل. الإنترنت غير مطلوب للبيع.</p>
    </div>

    {(health.isError || reconciliation.isError || backups.isError) && <Card className="border-destructive/40 bg-destructive/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-3"><div><p className="text-sm font-bold text-destructive">تعذر تحديث بعض معلومات سلامة البيانات</p><p className="mt-1 text-xs text-muted-foreground">{health.isError ? 'حالة قاعدة البيانات: تعذر الفحص. ' : ''}{reconciliation.isError ? 'فحص ترابط البيانات: تعذر تحميل النتيجة. ' : ''}{backups.isError ? 'قائمة النسخ التلقائية: تعذر قراءتها.' : ''}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>void health.refetch()}>فحص الحالة</Button><Button size="sm" variant="outline" onClick={()=>void reconciliation.refetch()}>إعادة فحص البيانات</Button>{desktopBackupEnabled&&<Button size="sm" variant="outline" onClick={()=>void backups.refetch()}>النسخ</Button>}</div></CardContent></Card>}
    <Card className="rounded-3xl border-primary/20 bg-primary/[0.02]">
      <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary"/><CardTitle className="text-base">حالة قاعدة البيانات</CardTitle></div><CardDescription>فحص سريع لحالة التخزين المحلي وإصدار مخطط البيانات.</CardDescription></CardHeader>
      <CardContent><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">قاعدة التشغيل</div><div className="mt-1 text-lg font-black">{dbState}</div></div><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">الإصدار</div><div className="mt-1 text-lg font-black">{health.data?.schemaVersion ?? '—'}</div></div><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">الاتصال</div><div className="mt-1 text-lg font-black">{health.data?.online ? 'متصل' : 'Offline'}</div></div></div><Button variant="outline" className="mt-4 rounded-xl" onClick={()=>health.refetch()}><RefreshCw className="me-2 size-4"/> فحص الحالة</Button></CardContent>
    </Card>

    <Card className="rounded-3xl">
      <CardHeader><div className="flex items-center gap-2"><Database className="size-5"/><CardTitle className="text-base">نسخة احتياطية كاملة</CardTitle></div><CardDescription>ملف SQLite يحتوي على بيانات المحل كاملة، ويمكن استعادته على نسخة أخرى من البرنامج.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button className="h-12 rounded-xl" onClick={()=>void downloadLocalBackup()} disabled={backupBusy}><Download className="me-2 size-4"/>{backupBusy?'جاري إنشاء النسخة...':'حفظ نسخة احتياطية'}</Button><input ref={restoreInputRef} type="file" accept=".sqlite,.db" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void restoreFromFile(f);e.currentTarget.value='' }}/><Button variant="outline" className="h-12 rounded-xl" disabled={restoreBusy} onClick={()=>restoreInputRef.current?.click()}><Upload className="me-2 size-4"/>{restoreBusy?'جارٍ الاستعادة...':'استعادة نسخة SQLite'}</Button>{desktopBackupEnabled&&<Button variant="outline" className="h-12 rounded-xl" onClick={()=>void openDesktopBackupFolder()}><FolderOpen className="me-2 size-4"/>فتح مجلد النسخ</Button>}</div>
        {lastBackup&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/10"><div className="font-bold">آخر نسخة تم إنشاؤها</div><div className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">{lastBackup.filename}</div><div className="mt-2 text-xs"><span className="text-muted-foreground">المكان: </span><b className="break-all">{lastBackup.location}</b></div><div className="mt-1 text-[11px] text-muted-foreground">{(lastBackup.size/1024/1024).toFixed(2)} MB{lastBackup.note?` · ${lastBackup.note}`:''}</div></div>}
        {desktopBackupEnabled&&<div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-bold">النسخ التلقائي</div><div className="text-xs text-muted-foreground">يتم إنشاء نسخة محلية يوميًا والاحتفاظ بآخر 7 نسخ.</div></div><Badge variant="outline">Windows</Badge></div><div className="mt-4 space-y-2">{backups.isLoading?<div className="text-sm text-muted-foreground">جارٍ تحميل النسخ...</div>:!backups.data?.length?<div className="text-sm text-muted-foreground">لا توجد نسخ تلقائية بعد.</div>:backups.data.slice(0,7).map(entry=><div key={entry.filename} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{entry.filename}</div><div className="text-[11px] text-muted-foreground">{new Date(entry.updatedAt).toLocaleString('ar-EG')} · {(entry.size/1024/1024).toFixed(2)} MB</div></div><Button variant="ghost" size="icon" aria-label="حذف النسخة" onClick={()=>void deleteDesktopBackup(entry.filename).then(()=>backups.refetch()).catch(e=>toast.error(e instanceof Error?e.message:'تعذر حذف النسخة'))}><Trash2 className="size-4"/></Button></div>)}</div></div>}
        <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">الاستعادة تستبدل قاعدة البيانات الحالية. البرنامج يتحقق من ترويسة SQLite وسلامة القاعدة والجداول الأساسية قبل اعتمادها.</div>
      </CardContent>
    </Card>

    <Card className="rounded-3xl">
      <CardHeader><div className="flex items-center gap-2"><FileSpreadsheet className="size-5"/><CardTitle className="text-base">Excel</CardTitle></div><CardDescription>استيراد وتصدير المنتجات في ملف مفهوم للمستخدم، منفصل عن النسخة الاحتياطية.</CardDescription></CardHeader>
      <CardContent><ProductExcelTools /></CardContent>
    </Card>

    <Card className="rounded-3xl">
      <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">صحة البيانات وسلامة القيود</CardTitle><CardDescription>فحص تشخيصي للإرصدة، النقدية، المخزون، ترابط السجلات، واتساق إجماليات البيع.</CardDescription></div><Badge variant="outline">تشخيص</Badge></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[['العملاء',reconciliation.data?.customers?.mismatches],['الموردون',reconciliation.data?.suppliers?.mismatches],['المخزون',reconciliation.data?.stock?.mismatches],['النقدية',reconciliation.data?.cash?.mismatches],['ترابط السجلات',reconciliation.data?.references?.mismatches]].map(([label,value])=><div key={String(label)} className="rounded-2xl border p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-xl font-black ${Number(value||0)?'text-destructive':'text-emerald-600'}`}>{value ?? '—'}</div><div className="text-[11px] text-muted-foreground">مشكلات مكتشفة</div></div>)}
        </div>
        {Number(reconciliation.data?.references?.items?.saleReturnItemsWithoutSaleItem || 0) > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><b>تنبيه: بنود مرتجعات غير مرتبطة ببنود البيع الأصلية</b><p className="mt-2 leading-6">تم اكتشاف {Number(reconciliation.data?.references?.items?.saleReturnItemsWithoutSaleItem || 0)} بندًا لا يجد بند البيع الأصلي المرتبط به. الفحص تشخيصي ولم يغيّر البيانات. لا تُعد إدخال هذه البنود أو حذف المرتجعات يدويًا قبل مراجعة التقارير والنسخ السابقة.</p></div>}
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted/40 p-4 text-sm"><b>اتساق المبيعات</b><div className="mt-1 text-muted-foreground">{reconciliation.data?.invariants?.mismatches ? 'يوجد فرق يحتاج للمراجعة' : 'سليم'}</div></div><div className="rounded-2xl bg-muted/40 p-4 text-sm"><b>ملخص</b><div className="mt-1 text-muted-foreground">{reconciliation.data?.summary?.salesCount ?? 0} فاتورة · مبيعات {reconciliation.data?.summary?.salesTotal ?? 0} ج</div></div></div>
        <Button variant="outline" className="rounded-xl" onClick={()=>reconciliation.refetch()} disabled={reconciliation.isFetching}><RefreshCw className={reconciliation.isFetching?'me-2 size-4 animate-spin':'me-2 size-4'}/> إعادة الفحص</Button>
      </CardContent>
    </Card>

    <Card className="rounded-3xl border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10"><CardContent className="flex gap-3 p-4"><Badge variant="outline" className="h-fit">V1</Badge><p className="text-sm leading-6 text-muted-foreground">هذا الجهاز مستقل تمامًا ولا يتصل بأي جهاز أو خدمة خارجية. النسخ الاحتياطي والاستعادة أعلاه هما الطريقة الوحيدة لنقل البيانات بين نسخ البرنامج.</p></CardContent></Card>
  </div>
}
