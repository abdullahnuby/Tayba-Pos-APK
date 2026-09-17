import { useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const HEADERS = [
  'اسم المنتج','التصنيف','الماركة','SKU','الباركود','المقاس','اللون','الخامة','سعر التكلفة','سعر البيع','الكمية','حد التنبيه','إعادة الطلب','الوحدة الأساسية','وحدة الشراء','معامل الشراء','وحدة البيع','معامل البيع','سعر ربع الدستة','سعر نصف الدستة','سعر الدستة'
]
const KEYS = ['productName','categoryName','brandName','sku','barcode','size','color','material','costPrice','sellPrice','quantity','minQuantity','reorderQty','baseUnit','purchaseUnit','purchaseUnitFactor','saleUnit','saleUnitFactor','quarterDozenPrice','halfDozenPrice','dozenPrice'] as const

type Row = Record<typeof KEYS[number], any>

const emptyRow = (): Row => ({ productName:'',categoryName:'',brandName:'',sku:'',barcode:'',size:'',color:'',material:'',costPrice:0,sellPrice:0,quantity:0,minQuantity:5,reorderQty:10,baseUnit:'piece',purchaseUnit:'piece',purchaseUnitFactor:1,saleUnit:'piece',saleUnitFactor:1,quarterDozenPrice:null,halfDozenPrice:null,dozenPrice:null })

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export function ProductExcelTools() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'update'|'skip'>('update')
  const [errors, setErrors] = useState<string[]>([])

  const validRows = useMemo(() => rows.filter(r => String(r.productName||'').trim() && String(r.categoryName||'').trim()), [rows])

  const downloadTemplate = () => {
    const sample = [emptyRow(), {...emptyRow(), productName:'مثال شرابات', categoryName:'شرابات', brandName:'Solo', sku:'SOCK-001', barcode:'', costPrice:8, sellPrice:15, quantity:12}]
    const data = sample.map(r => Object.fromEntries(HEADERS.map((h,i)=>[h,r[KEYS[i]]])))
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb,ws,'المنتجات');
    const out=XLSX.write(wb,{bookType:'xlsx',type:'array'}); downloadBlob(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'tayba-products-template.xlsx')
  }

  const exportProducts = async () => {
    try {
      const r=await fetch('/api/products/export'); if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||'فشل جلب المنتجات')
      const data=await r.json()
      const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(data.items||[]); XLSX.utils.book_append_sheet(wb,ws,'المنتجات');
      const out=XLSX.write(wb,{bookType:'xlsx',type:'array'}); downloadBlob(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`tayba-products-${new Date().toISOString().slice(0,10)}.xlsx`)
      toast.success(`تم تصدير ${data.items?.length||0} صف من المنتجات`)
    } catch(e){ toast.error(e instanceof Error?e.message:'فشل التصدير') }
  }

  const parseFile = async (file: File) => {
    setBusy(true); setErrors([]); setFileName(file.name)
    try {
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; if(!ws) throw new Error('ملف Excel فارغ')
      const raw=XLSX.utils.sheet_to_json<Record<string,any>>(ws,{defval:''});
      if(!raw.length) throw new Error('لا توجد بيانات في أول ورقة')
      const aliases: Record<string,string> = Object.fromEntries(HEADERS.map((h,i)=>[h,KEYS[i]]))
      const parsed: Row[] = raw.map((r:any)=>{ const out:any=emptyRow(); for(const [header,key] of Object.entries(aliases)) if(header in r) out[key]=r[header]; for(const key of KEYS) if(key in r) out[key]=r[key]; return out })
      const errs:string[]=[]; parsed.forEach((r,i)=>{ if(!String(r.productName||'').trim()) errs.push(`صف ${i+2}: اسم المنتج مطلوب`); if(!String(r.categoryName||'').trim()) errs.push(`صف ${i+2}: التصنيف مطلوب`); if(Number(r.costPrice)<0||Number(r.sellPrice)<0) errs.push(`صف ${i+2}: السعر لا يمكن أن يكون سالبًا`); if(Number(r.quantity)<0) errs.push(`صف ${i+2}: الكمية لا يمكن أن تكون سالبة`) })
      setRows(parsed); setErrors(errs); setOpen(true)
    } catch(e){ toast.error(e instanceof Error?e.message:'تعذر قراءة ملف Excel') }
    finally{ setBusy(false); if(inputRef.current) inputRef.current.value='' }
  }

  const importRows = async () => {
    if(!validRows.length || errors.length) return
    setBusy(true)
    try {
      const r=await fetch('/api/products/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,rows:validRows})})
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'فشل الاستيراد')
      toast.success(`تم الاستيراد: ${data.created} جديد، ${data.updated} تحديث، ${data.skipped} متروك`)
      setOpen(false); setRows([]); setErrors([]); window.dispatchEvent(new CustomEvent('tayba-products-imported'))
    } catch(e){ toast.error(e instanceof Error?e.message:'فشل الاستيراد') }
    finally{ setBusy(false) }
  }

  return <>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="h-14 rounded-2xl" onClick={()=>inputRef.current?.click()} disabled={busy}><Upload className="me-2 size-4"/> استيراد Excel</Button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) void parseFile(f)}} />
      <Button variant="outline" className="h-14 rounded-2xl" onClick={downloadTemplate}><FileSpreadsheet className="me-2 size-4"/> قالب Excel</Button>
      <Button variant="outline" className="h-14 rounded-2xl" onClick={()=>void exportProducts()}><Download className="me-2 size-4"/> تصدير المنتجات</Button>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl rounded-3xl p-4 sm:p-6">
        <DialogHeader><DialogTitle className="font-black">استيراد المنتجات من Excel</DialogTitle><DialogDescription>{fileName} — تمت قراءة {rows.length} صف. راجع المعاينة قبل الحفظ.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/20 p-3 text-sm"><span className="font-black">عند وجود SKU/باركود موجود:</span><button onClick={()=>setMode('update')} className={`rounded-xl px-3 py-2 font-bold ${mode==='update'?'bg-primary text-primary-foreground':'border bg-card'}`}>تحديث البيانات</button><button onClick={()=>setMode('skip')} className={`rounded-xl px-3 py-2 font-bold ${mode==='skip'?'bg-primary text-primary-foreground':'border bg-card'}`}>تجاهل الصف</button></div>
          {errors.length>0 && <div className="max-h-32 overflow-auto rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold text-destructive">{errors.slice(0,30).map((e,i)=><div key={i}>• {e}</div>)}{errors.length>30&&<div>… و{errors.length-30} أخطاء أخرى</div>}</div>}
          <div className="max-h-[45vh] overflow-auto rounded-2xl border"><table className="w-full min-w-[1200px] text-xs"><thead className="sticky top-0 bg-muted"><tr>{HEADERS.slice(0,13).map(h=><th key={h} className="p-2 text-right">{h}</th>)}</tr></thead><tbody>{rows.slice(0,100).map((r,i)=><tr key={i} className="border-t">{KEYS.slice(0,13).map(k=><td key={k} className="max-w-40 truncate p-2">{String(r[k]??'')}</td>)}</tr>)}</tbody></table></div>
          {rows.length>100&&<p className="text-xs text-muted-foreground">المعاينة تعرض أول 100 صف، وسيتم معالجة كل الصفوف عند الاستيراد.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)} className="h-12 rounded-2xl">إلغاء</Button><Button onClick={()=>void importRows()} disabled={busy||!validRows.length||errors.length>0} className="h-12 rounded-2xl font-black">{busy?'جاري الاستيراد...':`استيراد ${validRows.length} صف`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
