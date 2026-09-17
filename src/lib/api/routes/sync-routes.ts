// Backup/restore, data export, and health/capabilities. (Google Apps Script sync removed — V1 is local-only, no device sync.)
import { getDb, query, run, exportDatabaseBytes } from '../../db/client'
import { createLocalArchive, restoreDatabaseBytes } from '../../services/archiveService'
import { makeCsv, jsonResponse, body, type RouteCtx } from '../shared'

export async function handleSyncRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { req, u, p, method, user } = ctx
  if(p==='/sync/report-export' && method==='GET'){
    if(user!.role==='cashier') return jsonResponse({error:'غير مصرح'},403)
    const {fullReports}=await import('../../repositories/reports')
    const r=await fullReports(u.searchParams.get('from'),u.searchParams.get('to'))
    const format=u.searchParams.get('format')||'csv'
    const rows=[
      {البند:'صافي المبيعات',القيمة:r.netSales},
      {البند:'تكلفة المبيعات',القيمة:r.cogs},
      {البند:'الربح الإجمالي',القيمة:r.grossProfit},
      {البند:'المصروفات',القيمة:r.totalExpenses},
      {البند:'الربح الصافي',القيمة:r.netProfit},
      {البند:'عدد الفواتير',القيمة:r.salesCount},
      {البند:'الوحدات المباعة',القيمة:r.totalUnits},
    ]
    if(format==='xlsx'){
      const XLSX=await import('xlsx'); const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,'Report'); const out=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}); return new Response(out,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="tayba-report-${r.from}-${r.to}.xlsx"`}})
    }
    return new Response(makeCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="tayba-report-${r.from}-${r.to}.csv"`}})
  }

  if(p==='/sync/archive'&&method==='POST'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'غير مصرح'},403);return jsonResponse(await createLocalArchive())}
  if(p==='/sync/backup'&&method==='GET'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'غير مصرح'},403);const bytes=await exportDatabaseBytes();return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="tayba-backup-${new Date().toISOString().slice(0,10)}.sqlite"`}})}
  if(p==='/sync/restore'&&method==='POST'){if(user!.role!=='admin')return jsonResponse({error:'غير مصرح'},403);const b=await body(req);if(typeof b.base64!=='string'||!b.base64)return jsonResponse({error:'ملف النسخة الاحتياطية مطلوب'},400);try{const bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));const result=await restoreDatabaseBytes(bytes);return jsonResponse(result)}catch(e){return jsonResponse({error:e instanceof Error?e.message:'النسخة الاحتياطية غير صالحة'},400)}}
  if(p==='/sync/retry-failed'&&method==='POST'){if(user!.role!=='admin')return jsonResponse({error:'غير مصرح'},403);const db=await getDb();run(db,"UPDATE sync_queue SET status='pending',next_attempt_at=datetime('now'),last_error=NULL WHERE status='failed'");await (await import('../../db/client')).persist();return jsonResponse({ok:true})}
  if(p==='/sync/export'&&method==='GET'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'غير مصرح'},403);const format=u.searchParams.get('format')||'xlsx';const db=await getDb();const datasets:Record<string,any[]>={Categories:query(db,'SELECT id,name,created_at createdAt FROM categories'),Brands:query(db,'SELECT id,name,created_at createdAt FROM brands'),Products:query(db,'SELECT * FROM products'),Variants:query(db,'SELECT * FROM product_variants'),Customers:query(db,'SELECT * FROM customers'),Suppliers:query(db,'SELECT * FROM suppliers'),Sales:query(db,'SELECT * FROM sales'),SaleItems:query(db,'SELECT * FROM sale_items'),Purchases:query(db,'SELECT * FROM purchases'),PurchaseItems:query(db,'SELECT * FROM purchase_items'),SaleReturns:query(db,'SELECT * FROM sale_returns'),SaleReturnItems:query(db,'SELECT * FROM sale_return_items'),CustomerPayments:query(db,'SELECT * FROM customer_payments'),SupplierPayments:query(db,'SELECT * FROM supplier_payments'),StockMovements:query(db,'SELECT * FROM stock_movements'),RegisterSessions:query(db,'SELECT * FROM register_sessions'),Expenses:query(db,'SELECT * FROM expenses'),AuditLogs:query(db,'SELECT * FROM audit_logs'),Settings:query(db,'SELECT * FROM settings')};if(format==='csv'){const rows=datasets.Variants;const headers=Object.keys(rows[0]||{id:'',sku:'',quantity:0});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\uFEFF'+[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inventory.csv"'}})}const XLSX=await import('xlsx');const wb=XLSX.utils.book_new();for(const [name,rows] of Object.entries(datasets)){const ws=rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.json_to_sheet([{no_data:''}]);XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31))}const out=XLSX.write(wb,{type:'array',bookType:'xlsx'});return new Response(out,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="tayba-offline-full.xlsx"'}})}
  if(p==='/infrastructure/health'&&method==='GET'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'غير مصرح'},403); const db=await getDb();const online=navigator.onLine;const schema=query<any>(db,"SELECT value FROM schema_meta WHERE key='schema_version'")[0]?.value||null;return jsonResponse({ok:true,localDatabase:true,online,schemaVersion:Number(schema||0),timestamp:new Date().toISOString()})}
  if(p==='/capabilities'&&method==='GET'){return jsonResponse({ok:true,runtime:'offline',storage:'sqlite+indexeddb',sync:'disabled',features:{reports:true,exportCsv:true,exportXlsx:true,archive:true,restore:true,barcode:true,printerReady:true,cashMovements:true,managerOverride:true,offlineAuth:true,productExcelImport:true,productExcelExport:true,trialLicensing:true}})}

  return null
}
