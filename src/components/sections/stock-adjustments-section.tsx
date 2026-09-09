'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ClipboardCheck, Package, Plus, Minus, RotateCcw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { openNumericPad } from '@/components/numeric-pad'

interface Variant { id:string; sku:string; size:string|null; color:string|null; quantity:number; minQuantity?:number; product?:{name:string} }
interface Category { id:string; name:string }
interface Product { id:string; name:string; categoryId?:string; category?:{id:string;name:string}; variants:Variant[] }

export function StockAdjustmentsSection() {
  const qc=useQueryClient()
  const [mode,setMode]=useState<'stocktake'|'opening'>('stocktake')
  const [search,setSearch]=useState('')
  const [categoryFilter,setCategoryFilter]=useState('all')
  const [diffOnly,setDiffOnly]=useState(false)
  const [lowOnly,setLowOnly]=useState(false)
  const [actual,setActual]=useState<Record<string,string>>({})
  const [reason,setReason]=useState('')
  const {data,isLoading}=useQuery<{items:Product[]}>({queryKey:['products-stocktake'],queryFn:async()=>{const r=await fetch('/api/products?pageSize=1000');if(!r.ok)throw new Error('products');return r.json()}})
  const {data:categories=[]}=useQuery<Category[]>({queryKey:['categories'],queryFn:async()=>(await fetch('/api/categories')).json()})
  const products=(Array.isArray(data?.items)?data.items:[]).map(p=>({...p,variants:Array.isArray(p.variants)?p.variants:[]}))
  const variants=useMemo(()=>products.flatMap(p=>p.variants.map(v=>({...v,productName:p.name,categoryId:p.categoryId||p.category?.id||'',categoryName:p.category?.name||'بدون تصنيف'}))),[products])
  const rows=useMemo(()=>{
    const q=search.trim().toLowerCase()
    return variants.filter(v=>{
      if(categoryFilter!=='all'&&v.categoryId!==categoryFilter)return false
      if(lowOnly&&!(v.minQuantity!==undefined&&v.quantity<=v.minQuantity))return false
      const raw=actual[v.id]
      const changedRow=raw!==undefined&&raw!==''&&Number(raw)!==v.quantity
      if(diffOnly&&!changedRow)return false
      return !q||v.productName.toLowerCase().includes(q)||v.sku.toLowerCase().includes(q)||(v.size||'').toLowerCase().includes(q)||(v.color||'').toLowerCase().includes(q)
    })
  },[variants,search,categoryFilter,diffOnly,lowOnly,actual])
  const changed=variants.filter(v=>actual[v.id]!==undefined&&actual[v.id]!==''&&Number(actual[v.id])!==v.quantity)
  const increase=changed.reduce((s,v)=>s+Math.max(0,Number(actual[v.id])-v.quantity),0)
  const decrease=changed.reduce((s,v)=>s+Math.max(0,v.quantity-Number(actual[v.id])),0)
  const mutation=useMutation({
    mutationFn:async()=>{const items=changed.map(v=>({variantId:v.id,quantityChange:Math.floor(Number(actual[v.id]))-v.quantity,reason:reason.trim()||(mode==='opening'?'رصيد افتتاحي':'جرد مخزون'),type:mode==='opening'?'adjustment':'stocktake'}));const r=await fetch('/api/stock-adjustments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bulk:true,mode,items})});const j=await r.json();if(!r.ok)throw new Error(j.error||'فشل اعتماد الجرد');return j},
    onSuccess:(j)=>{qc.invalidateQueries({queryKey:['products-stocktake']});qc.invalidateQueries({queryKey:['products']});toast.success(`تم اعتماد ${j.applied} صنف`);setActual({})},
    onError:(e:Error)=>toast.error(e.message),
  })
  function fill(){const next:Record<string,string>={};for(const v of variants)next[v.id]=String(v.quantity);setActual(next);toast.success('تم تعبئة الرصيد الدفتري — عدّل الفروقات فقط')}
  function clear(){setActual({})}
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><div><h2 className="text-2xl font-black">الجرد والمخزون</h2><p className="text-sm text-muted-foreground">جرد كل الأصناف في كشف واحد بدل تعديل كل صنف منفردًا.</p></div><div className="ms-auto flex gap-2"><Button variant={mode==='stocktake'?'default':'outline'} onClick={()=>setMode('stocktake')}><ClipboardCheck/> جرد جديد</Button><Button variant={mode==='opening'?'default':'outline'} onClick={()=>setMode('opening')}>رصيد افتتاحي</Button></div></div>
    <Card><CardContent className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute right-3 top-3 size-5 text-muted-foreground"/><Input className="h-12 pr-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم الصنف أو SKU أو المقاس أو اللون"/></div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-12 w-full sm:w-[200px]"><SelectValue placeholder="كل التصنيفات"/></SelectTrigger><SelectContent><SelectItem value="all">كل التصنيفات</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <button type="button" onClick={()=>setLowOnly(v=>!v)} className={`flex h-12 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 font-bold ${lowOnly?'border-destructive bg-destructive/10 text-destructive':'bg-card'}`}><AlertTriangle className="size-4"/> منخفض فقط</button>
        <button type="button" onClick={()=>setDiffOnly(v=>!v)} className={`flex h-12 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 font-bold ${diffOnly?'border-primary bg-primary/10 text-primary':'bg-card'}`}>الفروق فقط</button>
        <Button variant="outline" className="h-12" onClick={fill} disabled={!variants.length||isLoading}>تعبئة الدفتري</Button>
        <Button variant="ghost" className="h-12" onClick={clear} disabled={!Object.keys(actual).length}><RotateCcw/> مسح</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border p-3"><small>الأصناف المعروضة</small><b className="block text-xl">{rows.length}<span className="text-sm font-normal text-muted-foreground">/{variants.length}</span></b></div>
        <div className="rounded-xl border p-3"><small>تم جردها</small><b className="block text-xl">{changed.length}</b></div>
        <div className="rounded-xl border p-3"><small>زيادات</small><b className="block text-xl text-emerald-600">+{increase}</b></div>
        <div className="rounded-xl border p-3"><small>نواقص</small><b className="block text-xl text-destructive">-{decrease}</b></div>
      </div>
    </CardContent></Card>
    <Card className="overflow-hidden"><div className="overflow-auto"><div className="min-w-[980px]"><div className="grid grid-cols-[2.2fr_1.2fr_1.3fr_1fr_1.2fr_1fr] border-b bg-muted/40 p-3 text-xs font-black"><div>الصنف</div><div>التصنيف</div><div>SKU / المقاس / اللون</div><div>الدفتري</div><div>الفعلي</div><div>الفرق</div></div><div className="max-h-[62dvh] overflow-y-auto">{isLoading?<div className="p-8 text-center">جاري تحميل الأصناف...</div>:rows.length===0?<div className="p-10 text-center text-muted-foreground"><Package className="mx-auto mb-2 size-8 opacity-50"/>لا توجد أصناف مطابقة للفلاتر</div>:rows.map(v=>{const raw=actual[v.id]??'';const n=raw===''?null:Math.max(0,Math.floor(Number(raw)));const diff=n===null?null:n-v.quantity;const low=v.minQuantity!==undefined&&v.quantity<=v.minQuantity;return <div key={v.id} className="grid min-h-[72px] grid-cols-[2.2fr_1.2fr_1.3fr_1fr_1.2fr_1fr] items-center border-b p-3"><div><div className="font-bold">{v.productName}</div>{low&&<div className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive"><AlertTriangle className="size-3"/> منخفض</div>}</div><div className="text-xs text-muted-foreground">{v.categoryName}</div><div className="text-xs text-muted-foreground">{v.sku}<br/>{v.size||'عام'} · {v.color||'عام'}</div><div className="font-black">{v.quantity}</div><div><button type="button" onClick={() => openNumericPad({ value: raw, title: `الجرد الفعلي — ${v.productName}`, min: 0, onCommit: val => setActual(x => ({ ...x, [v.id]: val.replace(/\D/g, '') })) })} className="flex h-11 w-full items-center justify-center rounded-xl border bg-background text-center font-black">{raw || String(v.quantity)}</button></div><div>{diff===null?<Badge variant="outline">لم يُجرد</Badge>:diff===0?<Badge variant="secondary">مطابق</Badge>:<Badge variant={diff>0?'default':'destructive'}>{diff>0?`+${diff}`:diff}</Badge>}</div></div>})}</div></div></div></Card>
    <Card><CardContent className="p-3"><div className="grid gap-3 md:grid-cols-[1fr_260px]"><div><Label>سبب العملية</Label><Input className="mt-1 h-11" value={reason} onChange={e=>setReason(e.target.value)} placeholder={mode==='opening'?'رصيد افتتاحي للبضاعة الموجودة فعليًا':'جرد فعلي دوري'}/></div><Button className="h-11 md:self-end" disabled={!changed.length||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'جارٍ الاعتماد...':`اعتماد الجرد (${changed.length})`}</Button></div></CardContent></Card>
  </div>
}
