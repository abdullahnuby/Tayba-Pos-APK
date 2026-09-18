'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  TrendingUp, Wallet, AlertTriangle, Package, Receipt, ArrowLeft, RotateCcw,
  Users, Coins, Banknote, ShoppingCart, BanknoteArrowUp, Clock3,
} from 'lucide-react'
import { formatEGP, paymentMethodLabel, todayISO, daysAgoISO } from '@/lib/format'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { EmptyState } from '@/components/empty-state'
import { KayanPageHeader } from '@/components/kayan-brand'

interface DashboardStats {
  todaySales: number
  todayProfit: number
  todayGrossProfit: number
  todayNetProfit: number
  todayExpenses: number
  periodNetSales: number
  periodGrossProfit: number
  periodNetProfit: number
  periodExpenses: number
  from: string
  to: string
  todaySalesCount: number
  lowStockCount: number
  outOfStockCount: number
  inventoryValue: number
  retailValue: number
  potentialProfit: number
  customerBalance: number
  supplierBalance: number
  salesTrend: { date: string; label: string; sales: number; profit: number }[]
  topProducts: { name: string; sku: string; qty: number; revenue: number; profit: number }[]
  recentSales: {
    id: string; invoiceNo: string; date: string; total: number;
    customerName: string; itemsCount: number; paymentMethod: string; status: string;
  }[]
  lowStockList: { id: string; name: string; sku: string; quantity: number; minQuantity: number; reorderQty: number; category?: string }[]
  reorderList: { id: string; name: string; sku: string; quantity: number; reorderQty: number; suggestedOrder: number }[]
  todayByMethod: { cash: number; card: number; transfer: number }
}

function KpiCard({ title, value, hint, icon: Icon, delay, tone = 'sales' }: {
  title: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>; delay: number; tone?: 'sales' | 'profit' | 'warning' | 'inventory' | 'customer' | 'supplier' | 'potential';
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <div className={`kayan-stat kayan-stat--${tone} card-hover`}>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="kayan-stat__label truncate">{title}</p>
              <p className="kayan-stat__value">{value}</p>
              {hint && <p className="kayan-stat__hint truncate">{hint}</p>}
            </div>
            <div className="kayan-stat__icon"><Icon className="size-5" /></div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function KpiSkeleton() {
  return (
    <div className="kayan-stat">
      <div>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-16" />
      </div>
    </div>
  )
}

/** Top products list with progress bars — readable, no clipping. */
function TopProductsList({ products }: { products: DashboardStats['topProducts'] }) {
  if (!products || products.length === 0) {
    return <EmptyState title="لا توجد مبيعات بعد" icon={TrendingUp} />
  }
  const maxQty = Math.max(...products.map((p) => p.qty), 1)
  return (
    <div className="space-y-3">
      {products.map((p, idx) => {
        const pct = (p.qty / maxQty) * 100
        return (
          <div key={p.sku} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{p.sku}</p>
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-bold">{p.qty}</p>
                <p className="text-[10px] text-muted-foreground">{formatEGP(p.revenue)} ج.م</p>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardSection() {
  const setSection = useAppStore((s) => s.setSection)
  const [from,setFrom]=useState(todayISO())
  const [to,setTo]=useState(todayISO())
  const { data, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats',from,to],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('فشل')
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const salesTrend = Array.isArray(data?.salesTrend) ? data.salesTrend : []
  const recentSales = Array.isArray(data?.recentSales) ? data.recentSales : []
  const reorderList = Array.isArray(data?.reorderList) ? data.reorderList : []
  const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : []
  const todayByMethod = data?.todayByMethod ?? { cash: 0, card: 0, transfer: 0 }

  if (isError) {
    return <EmptyState title="تعذّر تحميل لوحة التحكم" description="حدث خطأ أثناء جلب البيانات" icon={AlertTriangle} />
  }

  return (
    <div className="space-y-5 pb-16">
      <KayanPageHeader
        eyebrow="OVERVIEW / OPERATIONS"
        title="لوحة التحكم"
        description="صورة واحدة لحركة المتجر: المبيعات، الربحية، المخزون، والتحصيل — بدون ازدحام بصري."
        actions={
          <div className="flex gap-2">
            <Button className="h-11 rounded-xl font-black" onClick={() => setSection('sales')}><Receipt className="size-4" /> بيع جديد</Button>
            <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setSection('returns')}><RotateCcw className="size-4" /> مرتجع</Button>
          </div>
        }
      />

      <Card className="kayan-search-shell"><CardContent className="flex flex-wrap items-end gap-2 p-3">
        <div><label className="text-xs">من</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 h-10 rounded-xl border bg-background px-3"/></div>
        <div><label className="text-xs">إلى</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 h-10 rounded-xl border bg-background px-3"/></div>
        <Button variant="outline" onClick={()=>{setFrom(todayISO());setTo(todayISO())}}>اليوم</Button>
        <Button variant="outline" onClick={()=>{setFrom(daysAgoISO(6));setTo(todayISO())}}>7 أيام</Button>
        <Button variant="outline" onClick={()=>{setFrom(daysAgoISO(29));setTo(todayISO())}}>30 يوم</Button>
        <Badge variant="outline" className="h-10 rounded-xl px-3">الفترة: <span dir="ltr">{data?.from||from} → {data?.to||to}</span></Badge>
      </CardContent></Card>

      {/* Primary KPIs — 4 big cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard
              title={from===to ? 'مبيعات اليوم' : 'مبيعات الفترة'}
              value={`${formatEGP(data?.todaySales)}`}
              hint={from===to ? `${data?.todaySalesCount || 0} فاتورة · ${formatEGP(todayByMethod.cash)} نقدي` : `${data?.from || from} → ${data?.to || to}`}
              icon={TrendingUp}
              delay={0}
              tone="sales"
            />
            <KpiCard
              title={from===to ? 'صافي ربح اليوم' : 'صافي ربح الفترة'}
              value={`${formatEGP(from===to ? data?.todayNetProfit : data?.periodNetProfit)}`}
              hint={from===to ? `إجمالي ${formatEGP(from===to ? data?.todayGrossProfit : data?.periodGrossProfit)} − مصروفات ${formatEGP(data?.todayExpenses)}` : `مصروفات الفترة ${formatEGP(data?.periodExpenses)}`}
              icon={Wallet}
              delay={0.05}
              tone="profit"
            />
            <KpiCard
              title="مخزون منخفض"
              value={`${data?.lowStockCount}`}
              hint={`${data?.outOfStockCount} نفذت`}
              icon={AlertTriangle}
              delay={0.1}
              tone="warning"
            />
            <KpiCard
              title="قيمة المخزون"
              value={`${formatEGP(data?.inventoryValue)}`}
              hint={`بيع: ${formatEGP(data?.retailValue)}`}
              icon={Package}
              delay={0.15}
              tone="inventory"
            />
          </>
        )}
      </div>

      {/* Secondary KPIs — balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard
              title="رصيد العملاء"
              value={`${formatEGP(data?.customerBalance)}`}
              hint="مبالغ آجلة قائمة"
              icon={Users}
              delay={0.2}
              tone="customer"
            />
            <KpiCard
              title="رصيد الموردين"
              value={`${formatEGP(data?.supplierBalance)}`}
              hint="مبالغ آجلة قائمة"
              icon={Coins}
              delay={0.25}
              tone="supplier"
            />
            <KpiCard
              title="الربح المحتمل"
              value={`${formatEGP(data?.potentialProfit)}`}
              hint="لو بيع كل المخزون"
              icon={Banknote}
              delay={0.3}
              tone="potential"
            />
          </>
        )}
      </div>

      <Card><CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">ملخص الفترة الحالية</p><p className="text-xs text-muted-foreground">نفس تعريفات صفحة التقارير: صافي المبيعات ثم الربح الإجمالي ثم المصروفات ثم الربح الصافي.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><small>صافي المبيعات</small><b className="block">{formatEGP(data?.periodNetSales)}</b></div><div><small>الربح الإجمالي</small><b className="block">{formatEGP(from===to ? data?.todayGrossProfit : data?.periodGrossProfit)}</b></div><div><small>المصروفات</small><b className="block">{formatEGP(data?.periodExpenses)}</b></div><div><small>الربح الصافي</small><b className="block">{formatEGP(data?.periodNetProfit)}</b></div></div></div></CardContent></Card>

      {/* Operational snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/15 bg-primary/[0.025]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">حالة المخزون</p>
                <p className="mt-1 text-lg font-bold">{isLoading ? '...' : `${data?.lowStockCount || 0} منخفض`}</p>
                <p className="text-xs text-muted-foreground">{isLoading ? '' : `${data?.outOfStockCount || 0} صنف نفد بالكامل`}</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Package className="size-5" />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 px-0" onClick={() => setSection('products')}>مراجعة المخزون <ArrowLeft className="size-3.5" /></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">التحصيل اليوم</p>
                <p className="mt-1 text-lg font-bold">{isLoading ? '...' : formatEGP(todayByMethod.cash)}</p>
                <p className="text-xs text-muted-foreground">نقدي · راجع باقي طرق الدفع في التقارير</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Banknote className="size-5" />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 px-0" onClick={() => setSection('register')}>فتح الوردية والخزنة <ArrowLeft className="size-3.5" /></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">إجراءات سريعة</p>
                <p className="mt-1 text-lg font-bold">ابدأ من هنا</p>
                <p className="text-xs text-muted-foreground">البيع والمرتجع والشراء والوردية</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Clock3 className="size-5" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSection('sales')}>بيع</Button>
              <Button size="sm" variant="secondary" onClick={() => setSection('returns')}>مرتجع</Button>
              <Button size="sm" variant="secondary" onClick={() => setSection('purchases')}>شراء</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="kayan-surface overflow-hidden lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black mb-1">مبيعات وأرباح آخر 7 أيام</h3>
                <p className="text-xs text-muted-foreground">الربح محسوب بتكلفة البيع الفعلية</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1"><i className="size-1.5 rounded-full bg-primary" />مبيعات</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1"><i className="size-1.5 rounded-full bg-accent" />أرباح</span>
              </div>
            </div>
            <div className="mb-3" />
            {isLoading ? <Skeleton className="h-[260px] w-full" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesTrend} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, padding: '8px 12px' }}
                    formatter={(value: number, name: string) => [`${formatEGP(value)} ج.م`, name === 'sales' ? 'مبيعات' : 'أرباح']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#colorSales)" name="مبيعات" />
                  <Area type="monotone" dataKey="profit" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#colorProfit)" name="أرباح" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="kayan-surface overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-base font-black mb-1">أعلى 5 منتجات مبيعًا</h3>
            <p className="text-xs text-muted-foreground mb-4">بالكمية المباعة والإيرادات</p>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <TopProductsList products={topProducts} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="kayan-surface overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">آخر المبيعات</h3>
                <p className="text-xs text-muted-foreground">أحدث 5 فواتير</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSection('sales')}>الكل <ArrowLeft className="size-3.5" /></Button>
            </div>
            {isLoading ? <Skeleton className="h-[180px] w-full" /> : recentSales.length === 0 ? (
              <EmptyState title="لا توجد مبيعات بعد" icon={Receipt} />
            ) : (
              <div className="space-y-1">
                {recentSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Receipt className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.customerName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{s.invoiceNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{paymentMethodLabel(s.paymentMethod)}</Badge>
                      <span className="text-sm font-bold">{formatEGP(s.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="kayan-surface overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">تنبيهات إعادة الطلب</h3>
                <p className="text-xs text-muted-foreground">وصلت لحد إعادة الطلب</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSection('products')}>الكل <ArrowLeft className="size-3.5" /></Button>
            </div>
            {isLoading ? <Skeleton className="h-[180px] w-full" /> : reorderList.length === 0 ? (
              <EmptyState title="المخزون بحالة جيدة" description="لا توجد منتجات تحتاج إعادة طلب" icon={Package} />
            ) : (
              <div className="space-y-1">
                {reorderList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{p.sku}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px]">{p.quantity}</Badge>
                      <span className="text-[10px] text-muted-foreground">→ مقترح:</span>
                      <Badge variant="default" className="text-[10px]">{p.suggestedOrder}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
