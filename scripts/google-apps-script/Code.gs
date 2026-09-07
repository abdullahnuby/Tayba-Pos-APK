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
  cashLedger: 'CashLedger',
};
function json(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function sheet(name){return SpreadsheetApp.getActive().getSheetByName(name);}
function headers(sh){if(!sh)return [];const last=Math.max(1,sh.getLastColumn());return sh.getRange(1,1,1,last).getValues()[0];}
function appendObject(name,obj){let sh=sheet(name);if(!sh)sh=SpreadsheetApp.getActive().insertSheet(name);const h=headers(sh);if(!h.length){const keys=Object.keys(obj||{});if(keys.length)sh.getRange(1,1,1,keys.length).setValues([keys]);}const hh=headers(sh);sh.appendRow(hh.map(k=>obj[k]===undefined||obj[k]===null?'':obj[k]));}
function upsertObject(name,obj,keyField){let sh=sheet(name);if(!sh)sh=SpreadsheetApp.getActive().insertSheet(name);let h=headers(sh);if(!h.length){const keys=Object.keys(obj||{});if(keys.length)sh.getRange(1,1,1,keys.length).setValues([keys]);h=headers(sh);}const keyCol=h.indexOf(keyField);if(keyCol===-1)throw new Error('Missing key column '+keyField+' in sheet '+name);const lastRow=sh.getLastRow();if(lastRow>1){const keyValues=sh.getRange(2,keyCol+1,lastRow-1,1).getValues();for(let i=0;i<keyValues.length;i++){if(String(keyValues[i][0])===String(obj[keyField]??'')){sh.getRange(i+2,1,1,h.length).setValues([h.map(k=>obj[k]===undefined||obj[k]===null?'':obj[k])]);return;}}}sh.appendRow(h.map(k=>obj[k]===undefined||obj[k]===null?'':obj[k]));}
function upsertItems(name,items){(items||[]).forEach(x=>upsertObject(name,x,'id'));}
function alreadyProcessed(id){const sh=sheet(SHEETS.syncLog);if(!sh)return false;const values=sh.getDataRange().getValues();return values.slice(1).some(r=>String(r[0])===String(id));}
function logSync(op,ok,error){const sh=sheet(SHEETS.syncLog);if(!sh)return;sh.appendRow([op.id,new Date(),ok?'synced':'failed',error||'']);}
function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function processOperation(op){
  if(alreadyProcessed(op.id)) return {id:op.id,ok:true,duplicate:true};
  const p=op.payload||{};
  switch(op.entityType){
    case 'sale': upsertObject(SHEETS.sales,p.row,'id'); upsertItems(SHEETS.saleItems,p.items); break;
    case 'purchase': upsertObject(SHEETS.purchases,p.row,'id'); upsertItems(SHEETS.purchaseItems,p.items); break;
    case 'sale_return': upsertObject(SHEETS.saleReturns,p.row,'id'); upsertItems(SHEETS.saleReturnItems,p.items); break;
    case 'purchase_return': upsertObject(SHEETS.purchaseReturns,p.row,'id'); upsertItems(SHEETS.purchaseReturnItems,p.items); break;
    case 'customer_payment': upsertObject(SHEETS.customerPayments,p.row,'id'); break;
    case 'supplier_payment': upsertObject(SHEETS.supplierPayments,p.row,'id'); break;
    case 'stock_adjustment': upsertObject(SHEETS.stockMovements,p.row,'id'); break;
    case 'register_session': upsertObject(SHEETS.registerSessions,p.row,'id'); break;
    case 'expense': upsertObject(SHEETS.expenses,p.row,'id'); break;
    case 'cash_movement': upsertObject(SHEETS.cashLedger,p.row,'id'); break;
    default: throw new Error('Unsupported entityType: '+op.entityType);
  }
  logSync(op,true,'');
  return {id:op.id,ok:true};
}
function doPost(e){
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const body=JSON.parse(e.postData.contents||'{}');
    const expected=PropertiesService.getScriptProperties().getProperty('TAYBA_SYNC_TOKEN');
    if(!expected)return json({ok:false,error:'الخادم غير مُهيأ: TAYBA_SYNC_TOKEN غير مضبوط'});
    if(!safeEqual(String(body.token||''),String(expected)))return json({ok:false,error:'Unauthorized'});
    if(body.action==='ping')return json({ok:true,timestamp:new Date().toISOString()});
    if(body.action!=='sync')return json({ok:false,error:'Unknown action'});
    const ops=Array.isArray(body.operations)?body.operations:[];const results=[];
    for(const op of ops){try{results.push(processOperation(op));}catch(err){const message=String(err&&err.message||err);logSync(op,false,message);results.push({id:op.id,ok:false,error:message});}}
    return json({ok:true,results});
  }catch(err){return json({ok:false,error:String(err&&err.message||err)});}
  finally{try{lock.releaseLock();}catch(_){} }
}
function doGet(){return json({ok:true,service:'tayba-pos-sync',timestamp:new Date().toISOString()});}
