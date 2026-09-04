/**
 * Tayba POS sync gateway.
 * Deploy as a Web App (execute as owner, access according to your store setup).
 * The script is intentionally idempotent: sync_queue operation IDs are stored in SyncLog.
 */
const SHEETS = {
  syncLog: 'SyncLog',
  sales: 'Sales',
  saleItems: 'SaleItems',
  purchases: 'Purchases',
  purchaseItems: 'PurchaseItems',
  saleReturns: 'SaleReturns',
  saleReturnItems: 'SaleReturnItems',
  purchaseReturns: 'PurchaseReturns',
  purchaseReturnItems: 'PurchaseReturnItems',
  customerPayments: 'CustomerPayments',
  supplierPayments: 'SupplierPayments',
  stockMovements: 'StockMovements',
  registerSessions: 'RegisterSessions',
  expenses: 'Expenses',
};
function json(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function sheet(name){return SpreadsheetApp.getActive().getSheetByName(name);}
function headers(sh){if(!sh)return [];const last=Math.max(1,sh.getLastColumn());return sh.getRange(1,1,1,last).getValues()[0];}
function appendObject(name,obj){const sh=sheet(name);if(!sh)throw new Error('Missing sheet: '+name);const h=headers(sh);sh.appendRow(h.map(k=>obj[k]===undefined||obj[k]===null?'':obj[k]));}
function alreadyProcessed(id){const sh=sheet(SHEETS.syncLog);if(!sh)return false;const values=sh.getDataRange().getValues();return values.slice(1).some(r=>String(r[0])===String(id));}
function logSync(op,ok,error){const sh=sheet(SHEETS.syncLog);if(!sh)return;sh.appendRow([op.id,new Date(),ok?'synced':'failed',error||'']);}
function processOperation(op){
  if(alreadyProcessed(op.id)) return {id:op.id,ok:true,duplicate:true};
  const p=op.payload||{};
  switch(op.entityType){
    case 'sale': appendObject(SHEETS.sales,p.row); (p.items||[]).forEach(x=>appendObject(SHEETS.saleItems,x)); break;
    case 'purchase': appendObject(SHEETS.purchases,p.row); (p.items||[]).forEach(x=>appendObject(SHEETS.purchaseItems,x)); break;
    case 'sale_return': appendObject(SHEETS.saleReturns,p.row); (p.items||[]).forEach(x=>appendObject(SHEETS.saleReturnItems,x)); break;
    case 'purchase_return': appendObject(SHEETS.purchaseReturns,p.row); (p.items||[]).forEach(x=>appendObject(SHEETS.purchaseReturnItems,x)); break;
    case 'customer_payment': appendObject(SHEETS.customerPayments,p.row); break;
    case 'supplier_payment': appendObject(SHEETS.supplierPayments,p.row); break;
    case 'stock_adjustment': appendObject(SHEETS.stockMovements,p.row); break;
    case 'register_session': appendObject(SHEETS.registerSessions,p.row); break;
    case 'expense': appendObject(SHEETS.expenses,p.row); break;
    default: throw new Error('Unsupported entityType: '+op.entityType);
  }
  logSync(op,true,'');
  return {id:op.id,ok:true};
}
function doPost(e){
  try{
    const body=JSON.parse(e.postData.contents||'{}');
    const expected=PropertiesService.getScriptProperties().getProperty('TAYBA_SYNC_TOKEN');
    if(expected && body.token!==expected)return json({ok:false,error:'Unauthorized'});
    if(body.action==='ping')return json({ok:true,timestamp:new Date().toISOString()});
    if(body.action!=='sync')return json({ok:false,error:'Unknown action'});
    const ops=Array.isArray(body.operations)?body.operations:[];const results=[];
    for(const op of ops){try{results.push(processOperation(op));}catch(err){const message=String(err&&err.message||err);logSync(op,false,message);results.push({id:op.id,ok:false,error:message});}}
    return json({ok:true,results});
  }catch(err){return json({ok:false,error:String(err&&err.message||err)});}
}
function doGet(){return json({ok:true,service:'tayba-pos-sync',timestamp:new Date().toISOString()});}
