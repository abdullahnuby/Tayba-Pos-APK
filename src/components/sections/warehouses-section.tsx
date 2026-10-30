'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllPagedItems } from '@/lib/fetch-all'
import { formatEGP } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftRight, Boxes, Building2, Plus, RefreshCw, Search, Wallet } from 'lucide-react'

interface Warehouse {
  id:string
  name:string
  code:string
  location?:string|null
  notes?:string|null
  is_default:boolean
  active:boolean
  total_units:number
  stocked_variants:number
  cost_value:number
  retail_value:number
}
interface Product {
  id:string
  name:string
  variants:Array<{id:string;sku:string;size?:string|null;color?:string|null;quantity:number;costPrice:number;sellPrice:number}>
}
interface StockRow {
  variantId:string
  sku:string
  size?:string|null
  color?:string|null
  quantity:number
  totalQuantity:number
  costPrice:number
  sellPrice:number
  product:{name:string}
}
interface TransferLine {
  variantId:string
  label:string
  quantity:number
}

function money(value:number) { return `${formatEGP(Number(value)||0)} ج.م` }

export function WarehousesSection() {
  const qc=useQueryClient()
  const [newName,setNewName]=useState('')
  const [newCode,setNewCode]=useState('')
  const [selectedWarehouseId,setSelectedWarehouseId]=useState('')
  const [stockSearch,setStockSearch]=useState('')
  const [fromDate,setFromDate]=useState('')
  const [toDate,setToDate]=useState('')
  const [sourceWarehouseId,setSourceWarehouseId]=useState('')
  const [destinationWarehouseId,setDestinationWarehouseId]=useState('')
  const [transferVariantId,setTransferVariantId]=useState('')
  const [transferQuantity,setTransferQuantity]=useState('1')
  const [transferSearch,setTransferSearch]=useState('')
  const [transferLines,setTransferLines]=useState<TransferLine[]>([])
  const [transferNotes,setTransferNotes]=useState('')
  const [receiptWarehouseId,setReceiptWarehouseId]=useState('')
  const [receiptSource,setReceiptSource]=useState('الشريك')
  const [receiptVariantId,setReceiptVariantId]=useState('')
  const [receiptQuantity,setReceiptQuantity]=useState('1')
  const [receiptUnitCost,setReceiptUnitCost]=useState('0')
  const [receiptLines,setReceiptLines]=useState<Array<TransferLine & {unitCost:number}>>([])

  const warehousesQuery=useQuery<{items:Warehouse[];defaultWarehouseId?:string|null}>({
    queryKey:['warehouses'],
    queryFn:async()=>{const r=await fetch('/api/warehouses');const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر تحميل المخازن');return j},
  })
  const warehouses=Array.isArray(warehousesQuery.data?.items)?warehousesQuery.data.items:[]
  const selectedWarehouseIdValue=selectedWarehouseId||warehouses.find(w=>w.is_default)?.id||warehouses[0]?.id||''
  const effectiveReceiptWarehouseId=receiptWarehouseId||warehouses.find(w=>w.is_default)?.id||warehouses[0]?.id||''
  const stockQuery=useQuery<{warehouse:{id:string;name:string};items:StockRow[]}>({
    queryKey:['warehouse-stock',selectedWarehouseIdValue,stockSearch],
    queryFn:async()=>{const r=await fetch(`/api/warehouses/${encodeURIComponent(selectedWarehouseIdValue)}/stock?search=${encodeURIComponent(stockSearch)}`);const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر تحميل رصيد المخزن');return j},
    enabled:!!selectedWarehouseIdValue,
  })
  const statementQuery=useQuery<any>({
    queryKey:['warehouse-statement',selectedWarehouseIdValue,fromDate,toDate],
    queryFn:async()=>{const qs=new URLSearchParams();if(fromDate)qs.set('from',fromDate);if(toDate)qs.set('to',toDate);const r=await fetch(`/api/warehouses/${encodeURIComponent(selectedWarehouseIdValue)}/statement?${qs}`);const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر تحميل كشف الحساب');return j},
    enabled:!!selectedWarehouseIdValue,
  })
  const productsQuery=useQuery<{items:Product[]}>({
    queryKey:['warehouse-transfer-products'],
    queryFn:()=>fetchAllPagedItems<Product>('/api/products'),
  })
  const receiptMutation=useMutation({
    mutationFn:async()=>{
      if(!effectiveReceiptWarehouseId)throw new Error('اختر المخزن الذي يملك البضاعة')
      if(!receiptSource.trim())throw new Error('اكتب اسم مالك البضاعة')
      if(!receiptLines.length)throw new Error('أضف صنفًا واحدًا على الأقل')
      const r=await fetch('/api/warehouse-receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        warehouseId:effectiveReceiptWarehouseId,sourceLabel:receiptSource.trim(),
        items:receiptLines.map(x=>({variantId:x.variantId,quantity:x.quantity,unitCost:x.unitCost})),
      })})
      const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر تسجيل استلام البضاعة');return j
    },
    onSuccess:(result)=>{
      qc.invalidateQueries({queryKey:['warehouses']});qc.invalidateQueries({queryKey:['warehouse-stock']});
      qc.invalidateQueries({queryKey:['warehouse-statement']});qc.invalidateQueries({queryKey:['pos-products']});
      setReceiptLines([]);setReceiptQuantity('1');setReceiptUnitCost('0');
      toast.success(`تم تسجيل البضاعة المملوكة بالمستند ${result.receiptNo} بدون إثبات مديونية مورد أو حركة نقدية`)
    },
    onError:(e:Error)=>toast.error(e.message),
  })
  const variants=useMemo(()=>(
    (productsQuery.data?.items||[]).flatMap(p=>(p.variants||[]).map(v=>({
      id:v.id,label:`${p.name} · ${v.sku}${v.size?` · ${v.size}`:''}${v.color?` · ${v.color}`:''}`,
    })))
  ),[productsQuery.data])
  const filteredVariants=useMemo(()=>{
    const q=transferSearch.trim().toLowerCase()
    return variants.filter(v=>!q||v.label.toLowerCase().includes(q)).slice(0,80)
  },[variants,transferSearch])
  const stockRows=stockQuery.data?.items||[]

  const createMutation=useMutation({
    mutationFn:async()=>{const name=newName.trim();if(!name)throw new Error('اكتب اسم المخزن');const r=await fetch('/api/warehouses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code:newCode.trim()||undefined})});const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر إنشاء المخزن');return j},
    onSuccess:(warehouse)=>{qc.invalidateQueries({queryKey:['warehouses']});setNewName('');setNewCode('');setSelectedWarehouseId(warehouse.id);toast.success('تم إنشاء المخزن بنجاح')},
    onError:(e:Error)=>toast.error(e.message),
  })
  const transferMutation=useMutation({
    mutationFn:async()=>{if(!sourceWarehouseId||!destinationWarehouseId)throw new Error('حدد مخزن المصدر ومخزن الاستلام');if(sourceWarehouseId===destinationWarehouseId)throw new Error('اختر مخزنين مختلفين');if(!transferLines.length)throw new Error('أضف صنفًا واحدًا على الأقل');const r=await fetch('/api/warehouse-transfers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceWarehouseId,destinationWarehouseId,items:transferLines.map(x=>({variantId:x.variantId,quantity:x.quantity})),notes:transferNotes})});const j=await r.json();if(!r.ok)throw new Error(j.error||'تعذر تنفيذ التحويل');return j},
    onSuccess:(result)=>{qc.invalidateQueries({queryKey:['warehouses']});qc.invalidateQueries({queryKey:['warehouse-stock']});qc.invalidateQueries({queryKey:['warehouse-statement']});qc.invalidateQueries({queryKey:['pos-products']});setTransferLines([]);setTransferNotes('');toast.success(`تم تنفيذ التحويل ${result.transferNo}`)},
    onError:(e:Error)=>toast.error(e.message),
  })

  function addReceiptLine(){
    const quantity=Math.floor(Number(receiptQuantity))
    const unitCost=Number(receiptUnitCost)
    if(!receiptVariantId)return toast.error('اختر الصنف')
    if(!Number.isInteger(quantity)||quantity<=0)return toast.error('أدخل كمية صحيحة')
    if(!Number.isFinite(unitCost)||unitCost<0)return toast.error('أدخل تكلفة صحيحة')
    const variant=variants.find(v=>v.id===receiptVariantId)
    if(!variant)return toast.error('الصنف غير موجود في الكتالوج')
    setReceiptLines(current=>[...current,{variantId:variant.id,label:variant.label,quantity,unitCost}])
    setReceiptVariantId('');setReceiptQuantity('1');setReceiptUnitCost('0')
  }

  function addTransferLine(){
    const quantity=Math.floor(Number(transferQuantity))
    if(!transferVariantId)return toast.error('اختر الصنف')
    if(!Number.isInteger(quantity)||quantity<=0)return toast.error('أدخل كمية صحيحة')
    const variant=variants.find(v=>v.id===transferVariantId)
    if(!variant)return toast.error('الصنف غير موجود في الكتالوج')
    setTransferLines(current=>[...current,{variantId:variant.id,label:variant.label,quantity}])
    setTransferVariantId('')
    setTransferQuantity('1')
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black">إدارة المخازن</h2>
        <p className="mt-1 text-sm text-muted-foreground">أرصدة منفصلة وحركة وتحويلات وكشف حساب لكل مخزن — مع نقطة بيع واحدة.</p>
      </div>
      <Badge variant="outline" className="px-3 py-1.5">{warehouses.length} مخزن نشط</Badge>
    </div>

    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2"><Plus className="size-5 text-primary"/><h3 className="font-black">إضافة مخزن جديد</h3></div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="اسم المخزن — مثال: مخزن الدور العلوي" className="h-11"/>
          <Input value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase())} placeholder="كود اختياري" className="h-11"/>
          <Button className="h-11" onClick={()=>createMutation.mutate()} disabled={createMutation.isPending||!newName.trim()}>{createMutation.isPending?'جارٍ الإنشاء...':'إنشاء المخزن'}</Button>
        </div>
      </CardContent>
    </Card>

    {warehousesQuery.isError&&<Card className="border-destructive/40"><CardContent className="flex items-center justify-between gap-3 p-4"><span className="text-sm text-destructive">تعذر تحميل قائمة المخازن.</span><Button variant="outline" size="sm" onClick={()=>void warehousesQuery.refetch()}><RefreshCw className="me-1 size-4"/>إعادة المحاولة</Button></CardContent></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {warehouses.map(w=><button key={w.id} type="button" onClick={()=>setSelectedWarehouseId(w.id)} className={`rounded-2xl border p-4 text-right transition ${selectedWarehouseIdValue===w.id?'border-primary bg-primary/5 ring-2 ring-primary/15':'bg-card hover:bg-muted/30'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary"><Building2 className="size-5"/></span><div><div className="font-black">{w.name}</div><div className="text-xs text-muted-foreground">{w.code}</div></div></div>
          {w.is_default&&<Badge>رئيسي</Badge>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-right">
          <div><div className="text-[11px] text-muted-foreground">عدد الوحدات</div><div className="text-lg font-black tabular-nums">{Number(w.total_units||0).toLocaleString('en-US')}</div></div>
          <div><div className="text-[11px] text-muted-foreground">أصناف بها رصيد</div><div className="text-lg font-black tabular-nums">{Number(w.stocked_variants||0).toLocaleString('en-US')}</div></div>
          <div><div className="text-[11px] text-muted-foreground">قيمة التكلفة</div><div className="font-bold">{money(w.cost_value)}</div></div>
          <div><div className="text-[11px] text-muted-foreground">قيمة البيع</div><div className="font-bold">{money(w.retail_value)}</div></div>
        </div>
      </button>)}
      {!warehousesQuery.isLoading&&!warehouses.length&&<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">لم يتم إنشاء مخازن بعد.</CardContent></Card>}
    </div>

    {selectedWarehouseIdValue&&<Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Boxes className="size-5 text-primary"/><h3 className="text-lg font-black">رصيد {stockQuery.data?.warehouse?.name||'المخزن المحدد'}</h3></div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm"><Search className="absolute right-3 top-3 size-4 text-muted-foreground"/><Input value={stockSearch} onChange={e=>setStockSearch(e.target.value)} placeholder="ابحث عن اسم الصنف أو SKU" className="h-10 pe-9"/></div>
        </div>
        {stockQuery.isError&&<p className="text-sm text-destructive">تعذر تحميل رصيد المخزن: {stockQuery.error instanceof Error?stockQuery.error.message:'خطأ غير معروف'}</p>}
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/40 text-xs"><tr><th className="p-3 text-right">الصنف</th><th className="p-3 text-right">SKU</th><th className="p-3 text-center">رصيد المخزن</th><th className="p-3 text-center">إجمالي كل المخازن</th><th className="p-3 text-left">تكلفة الوحدة</th><th className="p-3 text-left">قيمة الرصيد</th></tr></thead>
            <tbody>{stockRows.map(row=><tr key={row.variantId} className="border-t"><td className="p-3 font-bold">{row.product?.name||'—'}<div className="text-xs font-normal text-muted-foreground">{row.size||'عام'} · {row.color||'عام'}</div></td><td className="p-3 text-muted-foreground">{row.sku}</td><td className="p-3 text-center font-black">{row.quantity}</td><td className="p-3 text-center">{row.totalQuantity}</td><td className="p-3 text-left">{money(row.costPrice)}</td><td className="p-3 text-left font-bold">{money(row.quantity*row.costPrice)}</td></tr>)}</tbody>
          </table>
          {!stockQuery.isLoading&&!stockRows.length&&<div className="p-8 text-center text-sm text-muted-foreground">لا توجد أصناف مطابقة.</div>}
        </div>
        <div className="border-t pt-4">
          <div className="mb-3 flex items-center gap-2"><Wallet className="size-5 text-primary"/><h3 className="font-black">كشف حساب المخزن</h3></div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-[180px_180px_auto]">
            <Input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="h-10"/>
            <Input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="h-10"/>
            <Button type="button" variant="outline" className="h-10" onClick={()=>{setFromDate('');setToDate('')}}>كل الفترات</Button>
          </div>
          {statementQuery.isError&&<p className="text-sm text-destructive">تعذر تحميل كشف الحساب.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {[
              ['المشتريات',statementQuery.data?.purchases],
              ['بضاعة مملوكة مستلمة',statementQuery.data?.ownedStockReceipts],
              ['مرتجعات الشراء',statementQuery.data?.purchaseReturns],
              ['صافي المبيعات',statementQuery.data?.netSales],
              ['تكلفة المباع',statementQuery.data?.costOfGoodsSold],
              ['مجمل الربح',statementQuery.data?.grossProfit],
              ['المصروفات المحملة',statementQuery.data?.expenses],
              ['صافي قبل المشترك',statementQuery.data?.netProfit],
              ['مصروفات مشتركة',statementQuery.data?.sharedExpenses],
              ['قيمة المخزون بالتكلفة',statementQuery.data?.stockCostValue],
            ].map(([label,value])=><div key={String(label)} className="rounded-xl border p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 font-black tabular-nums">{statementQuery.isLoading?'…':money(Number(value||0))}</div></div>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">المصروفات المشتركة غير موزعة تلقائيًا على المخازن؛ تظهر منفصلة في سجل الحساب حتى لا تُحمّل على مخزن دون قاعدة توزيع.</p>
        </div>
      </CardContent>
    </Card>}

    <Card className="border-primary/30">
      <CardContent className="space-y-4 p-4">
        <div>
          <div className="flex items-center gap-2"><Boxes className="size-5 text-primary"/><h3 className="text-lg font-black">استلام بضاعة مملوكة</h3></div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">لتسجيل بضاعة الشريك أو بضاعة تخص مالك المخزن نفسه. تُضاف للمخزون وتُحفظ تكلفتها، من غير إنشاء فاتورة مورد أو مديونية أو حركة من درج النقدية.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold">المخزن المالك للبضاعة<select value={effectiveReceiptWarehouseId} onChange={e=>setReceiptWarehouseId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">اختر المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="space-y-1 text-sm font-bold">مالك البضاعة / المصدر<Input value={receiptSource} onChange={e=>setReceiptSource(e.target.value)} placeholder="مثال: الشريك" className="h-11 font-normal"/></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_100px_140px_auto]">
          <label className="space-y-1 text-xs font-bold text-muted-foreground">الصنف<select value={receiptVariantId} onChange={e=>setReceiptVariantId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="">اختر الصنف</option>{variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          <label className="space-y-1 text-xs font-bold text-muted-foreground">الكمية<Input type="number" min="1" step="1" value={receiptQuantity} onChange={e=>setReceiptQuantity(e.target.value)} className="h-11 text-center"/></label>
          <label className="space-y-1 text-xs font-bold text-muted-foreground">تكلفة الوحدة<Input type="number" min="0" step="0.01" value={receiptUnitCost} onChange={e=>setReceiptUnitCost(e.target.value)} className="h-11 text-center"/></label>
          <Button type="button" variant="outline" className="h-11 self-end" onClick={addReceiptLine}><Plus className="me-1 size-4"/>إضافة</Button>
        </div>
        {receiptLines.length>0&&<div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="p-2 text-right">الصنف</th><th className="p-2 text-center">الكمية</th><th className="p-2 text-left">التكلفة</th><th className="p-2 text-left">الإجمالي</th><th className="p-2"></th></tr></thead><tbody>{receiptLines.map((line,i)=><tr key={`${line.variantId}-${i}`} className="border-t"><td className="p-2 font-medium">{line.label}</td><td className="p-2 text-center">{line.quantity}</td><td className="p-2 text-left">{money(line.unitCost)}</td><td className="p-2 text-left font-bold">{money(line.unitCost*line.quantity)}</td><td className="p-2 text-left"><Button type="button" size="sm" variant="ghost" onClick={()=>setReceiptLines(rows=>rows.filter((_,index)=>index!==i))}>حذف</Button></td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">إجمالي تكلفة البضاعة المستلمة: <b className="text-foreground">{money(receiptLines.reduce((sum,line)=>sum+line.quantity*line.unitCost,0))}</b></div>
          <Button className="h-11" onClick={()=>receiptMutation.mutate()} disabled={receiptMutation.isPending||!receiptLines.length}>{receiptMutation.isPending?'جارٍ تسجيل الاستلام...':'تسجيل استلام البضاعة'}</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2"><ArrowLeftRight className="size-5 text-primary"/><h3 className="text-lg font-black">تحويل مخزون بين مخزنين</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-bold">من مخزن<select value={sourceWarehouseId} onChange={e=>setSourceWarehouseId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">اختر مخزن المصدر</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="space-y-1 text-sm font-bold">إلى مخزن<select value={destinationWarehouseId} onChange={e=>setDestinationWarehouseId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">اختر المخزن المستلم</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
          <div className="space-y-1"><label className="text-xs font-bold text-muted-foreground">ابحث عن الصنف</label><Input value={transferSearch} onChange={e=>setTransferSearch(e.target.value)} placeholder="اسم الصنف أو SKU" className="h-11"/><select value={transferVariantId} onChange={e=>setTransferVariantId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="">اختر صنفًا</option>{filteredVariants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></div>
          <label className="space-y-1 text-xs font-bold text-muted-foreground">الكمية<Input type="number" min="1" step="1" value={transferQuantity} onChange={e=>setTransferQuantity(e.target.value)} className="h-11 text-center"/></label>
          <Button type="button" variant="outline" className="h-11 self-end" onClick={addTransferLine}><Plus className="me-1 size-4"/>إضافة</Button>
        </div>
        {transferLines.length>0&&<div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="p-2 text-right">الصنف</th><th className="p-2 text-center">الكمية</th><th className="p-2"></th></tr></thead><tbody>{transferLines.map((line,i)=><tr key={`${line.variantId}-${i}`} className="border-t"><td className="p-2 font-medium">{line.label}</td><td className="p-2 text-center font-black">{line.quantity}</td><td className="p-2 text-left"><Button type="button" size="sm" variant="ghost" onClick={()=>setTransferLines(rows=>rows.filter((_,index)=>index!==i))}>حذف</Button></td></tr>)}</tbody></table></div>}
        <Input value={transferNotes} onChange={e=>setTransferNotes(e.target.value)} placeholder="ملاحظات التحويل (اختياري)" className="h-11"/>
        <div className="flex justify-end"><Button className="h-11" onClick={()=>transferMutation.mutate()} disabled={transferMutation.isPending||!transferLines.length}>{transferMutation.isPending?'جارٍ تنفيذ التحويل...':'اعتماد التحويل'}</Button></div>
      </CardContent>
    </Card>
  </div>
}
