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

export function SyncSection() {
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
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
      const { exportDatabaseBytes } = await import('@/lib/db/client')
      const bytes = await exportDatabaseBytes()
      const blobBuffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(blobBuffer).set(bytes)
      const blob = new Blob([blobBuffer], { type:'application/x-sqlite3' })
      const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url; a.download=`tayba-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000)
      toast.success('تم تنزيل نسخة SQLite كاملة')
    } catch(e){ toast.error(e instanceof Error?e.message:'فشل إنشاء النسخة الاحتياطية') }
    finally{ setBackupBusy(false) }
  }

  async function restoreFromFile(file: File) {
    setRestoreBusy(true)
    try {
      const bytes=new Uint8Array(await file.arrayBuffer())
      const { restoreDatabaseBytes }=await import('@/lib/services/archiveService')
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

    <Card className="rounded-3xl border-primary/20 bg-primary/[0.02]">
      <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary"/><CardTitle className="text-base">حالة قاعدة البيانات</CardTitle></div><CardDescription>فحص سريع لحالة التخزين المحلي وإصدار مخطط البيانات.</CardDescription></CardHeader>
      <CardContent><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">قاعدة التشغيل</div><div className="mt-1 text-lg font-black">{dbState}</div></div><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">الإصدار</div><div className="mt-1 text-lg font-black">{health.data?.schemaVersion ?? '—'}</div></div><div className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">الاتصال</div><div className="mt-1 text-lg font-black">{health.data?.online ? 'متصل' : 'Offline'}</div></div></div><Button variant="outline" className="mt-4 rounded-xl" onClick={()=>health.refetch()}><RefreshCw className="me-2 size-4"/> فحص الحالة</Button></CardContent>
    </Card>

    <Card className="rounded-3xl">
      <CardHeader><div className="flex items-center gap-2"><Database className="size-5"/><CardTitle className="text-base">نسخة احتياطية كاملة</CardTitle></div><CardDescription>ملف SQLite يحتوي على بيانات المحل كاملة، ويمكن استعادته على نسخة أخرى من البرنامج.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button className="h-12 rounded-xl" onClick={()=>void downloadLocalBackup()} disabled={backupBusy}><Download className="me-2 size-4"/>{backupBusy?'جاري إنشاء النسخة...':'تنزيل نسخة SQLite'}</Button><input ref={restoreInputRef} type="file" accept=".sqlite,.db" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void restoreFromFile(f);e.currentTarget.value='' }}/><Button variant="outline" className="h-12 rounded-xl" disabled={restoreBusy} onClick={()=>restoreInputRef.current?.click()}><Upload className="me-2 size-4"/>{restoreBusy?'جارٍ الاستعادة...':'استعادة نسخة SQLite'}</Button>{desktopBackupEnabled&&<Button variant="outline" className="h-12 rounded-xl" onClick={()=>void openDesktopBackupFolder()}><FolderOpen className="me-2 size-4"/>فتح مجلد النسخ</Button>}</div>
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
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted/40 p-4 text-sm"><b>اتساق المبيعات</b><div className="mt-1 text-muted-foreground">{reconciliation.data?.invariants?.mismatches ? 'يوجد فرق يحتاج للمراجعة' : 'سليم'}</div></div><div className="rounded-2xl bg-muted/40 p-4 text-sm"><b>ملخص</b><div className="mt-1 text-muted-foreground">{reconciliation.data?.summary?.salesCount ?? 0} فاتورة · مبيعات {reconciliation.data?.summary?.salesTotal ?? 0} ج</div></div></div>
        <Button variant="outline" className="rounded-xl" onClick={()=>reconciliation.refetch()} disabled={reconciliation.isFetching}><RefreshCw className={reconciliation.isFetching?'me-2 size-4 animate-spin':'me-2 size-4'}/> إعادة الفحص</Button>
      </CardContent>
    </Card>

    <Card className="rounded-3xl border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10"><CardContent className="flex gap-3 p-4"><Badge variant="outline" className="h-fit">V1</Badge><p className="text-sm leading-6 text-muted-foreground">هذا الجهاز مستقل تمامًا ولا يتصل بأي جهاز أو خدمة خارجية. النسخ الاحتياطي والاستعادة أعلاه هما الطريقة الوحيدة لنقل البيانات بين نسخ البرنامج.</p></CardContent></Card>
  </div>
}
