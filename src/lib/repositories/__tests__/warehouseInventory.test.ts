import { describe, expect, it } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { query, run, withTransaction } from '../../db/client'
import { completeSale } from '../../services/salesService'
import { completePurchase } from '../../services/purchaseService'
import { returnSale } from '../../services/returnsService'
import { createOwnedStockReceipt } from '../../services/warehouseReceipts'
import { createWarehouse, getDefaultWarehouseId, getWarehouseStock, getWarehouseStatement, receiveStock, transferStock } from '../inventory'

describe('multi-warehouse inventory', () => {
  it('keeps one POS sale allocated by FIFO and restores every returned unit to its original warehouse', async () => {
    const {db,variantId,userId,sessionId}=await seedBasics()
    const mainId=getDefaultWarehouseId(db)
    const second=await withTransaction(tx=>createWarehouse(tx,{name:'مخزن فرعي',code:'SUB-1'}))
    // Force deterministic FIFO: old stock in main first, later receipt in the second warehouse.
    run(db,"UPDATE inventory_batches SET created_at='2020-01-01 00:00:00' WHERE variant_id=? AND warehouse_id=?",[variantId,mainId])
    receiveStock(db,{variantId,warehouseId:second.id,quantity:5,unitCost:25,sourceType:'test_receipt',sourceId:'second-stock',createdAt:'2021-01-01 00:00:00'})

    const sale=await completeSale({
      userId,registerSessionId:sessionId,cart:[{variantId,quantity:55,price:20,name:'شراب قطن',sku:'SKU-1'} as any],
      discount:0,paid:1100,paymentMethod:'card',role:'admin',
    })
    const saleItem=query<any>(db,'SELECT id,unit_cost FROM sale_items WHERE sale_id=?',[sale.id])[0]
    const allocations=query<any>(db,'SELECT warehouse_id,quantity,unit_cost FROM sale_item_allocations WHERE sale_item_id=? ORDER BY warehouse_id',[saleItem.id])
    expect(allocations.reduce((sum,row)=>sum+Number(row.quantity),0)).toBe(55)
    expect(allocations).toHaveLength(2)
    expect(allocations.find(row=>row.warehouse_id===mainId)?.quantity).toBe(50)
    expect(allocations.find(row=>row.warehouse_id===second.id)?.quantity).toBe(5)
    expect(Number(saleItem.unit_cost)).toBeCloseTo((50*10+5*25)/55,2)
    expect(Number(query<any>(db,'SELECT quantity FROM product_variants WHERE id=?',[variantId])[0].quantity)).toBe(0)

    const saleItemId=saleItem.id as string
    await returnSale({
      userId,role:'manager',saleId:sale.id,refundMethod:'card',
      lines:[{saleItemId,variantId,quantity:55}],
    })
    const stock=getWarehouseStock(db,mainId).items.find(row=>row.variantId===variantId)
    const secondStock=getWarehouseStock(db,second.id).items.find(row=>row.variantId===variantId)
    expect(stock?.quantity).toBe(50)
    expect(secondStock?.quantity).toBe(5)
    expect(Number(query<any>(db,'SELECT quantity FROM product_variants WHERE id=?',[variantId])[0].quantity)).toBe(55)
    expect(Number(query<any>(db,'SELECT COUNT(*) n FROM sale_return_item_allocations WHERE sale_return_item_id IN (SELECT id FROM sale_return_items WHERE sale_return_id IN (SELECT id FROM sale_returns WHERE sale_id=?))',[sale.id])[0].n)).toBe(2)
  })

  it('transfers stock with its FIFO cost lots and never changes the global quantity', async () => {
    const {db,variantId}=await seedBasics()
    const mainId=getDefaultWarehouseId(db)
    const second=await withTransaction(tx=>createWarehouse(tx,{name:'مخزن تحويل',code:'SUB-2'}))
    const result=await withTransaction(tx=>transferStock(tx,{
      sourceWarehouseId:mainId,destinationWarehouseId:second.id,
      lines:[{variantId,quantity:8}],notes:'اختبار نقل مخزون',
    }))
    expect(result.transferNo).toMatch(/^TR-/)
    expect(getWarehouseStock(db,mainId).items.find(row=>row.variantId===variantId)?.quantity).toBe(42)
    expect(getWarehouseStock(db,second.id).items.find(row=>row.variantId===variantId)?.quantity).toBe(8)
    expect(Number(query<any>(db,'SELECT quantity FROM product_variants WHERE id=?',[variantId])[0].quantity)).toBe(50)
    const movedLot=query<any>(db,'SELECT remaining_quantity,unit_cost,source_type FROM inventory_batches WHERE warehouse_id=? AND variant_id=?',[second.id,variantId])[0]
    expect(Number(movedLot.remaining_quantity)).toBe(8)
    expect(Number(movedLot.unit_cost)).toBe(10)
    expect(movedLot.source_type).toBe('warehouse_transfer')
  })


  it('records partner-owned goods without changing supplier debt or the cash drawer', async () => {
    const {db,variantId,userId,sessionId}=await seedBasics()
    const second=await withTransaction(tx=>createWarehouse(tx,{name:'مخزن الشريك',code:'PARTNER-1'}))
    const supplierId=uuid()
    run(db,'INSERT INTO suppliers(id,name,balance) VALUES(?,?,125)',[supplierId,'مورد موجود'])
    const supplierBalanceBefore=Number(query<any>(db,'SELECT balance FROM suppliers WHERE id=?',[supplierId])[0].balance)
    const cashEntriesBefore=Number(query<any>(db,'SELECT COUNT(*) n FROM cash_ledger WHERE register_session_id=?',[sessionId])[0].n)
    const result=await createOwnedStockReceipt({
      userId,warehouseId:second.id,sourceLabel:'الشريك',
      lines:[{variantId,quantity:7,unitCost:18}],
    })
    expect(result.receiptNo).toMatch(/^OWN-/)
    expect(result.totalCost).toBe(126)
    expect(getWarehouseStock(db,second.id).items.find(row=>row.variantId===variantId)?.quantity).toBe(7)
    expect(Number(query<any>(db,'SELECT balance FROM suppliers WHERE id=?',[supplierId])[0].balance)).toBe(supplierBalanceBefore)
    expect(Number(query<any>(db,'SELECT COUNT(*) n FROM cash_ledger WHERE register_session_id=?',[sessionId])[0].n)).toBe(cashEntriesBefore)
    expect(Number(query<any>(db,'SELECT COUNT(*) n FROM warehouse_receipts WHERE id=?',[result.id])[0].n)).toBe(1)
    expect(Number(query<any>(db,'SELECT COUNT(*) n FROM supplier_ledger WHERE supplier_id=?',[supplierId])[0].n)).toBe(0)
  })

  it('receives a purchase into the selected warehouse and reflects the warehouse account', async () => {
    const {db,variantId,userId}=await seedBasics()
    const second=await withTransaction(tx=>createWarehouse(tx,{name:'مخزن المشتريات',code:'SUB-3'}))
    const supplierId=uuid()
    run(db,'INSERT INTO suppliers(id,name,balance) VALUES(?,?,0)',[supplierId,'مورد اختبار'])
    const purchase=await completePurchase({
      userId,supplierId,warehouseId:second.id,lines:[{variantId,quantity:3,unitCost:30}],
      paid:0,paymentMethod:'credit',
    })
    const header=query<any>(db,'SELECT warehouse_id FROM purchases WHERE id=?',[purchase.id])[0]
    const item=query<any>(db,'SELECT warehouse_id,inventory_batch_id FROM purchase_items WHERE purchase_id=?',[purchase.id])[0]
    expect(header.warehouse_id).toBe(second.id)
    expect(item.warehouse_id).toBe(second.id)
    expect(item.inventory_batch_id).toBeTruthy()
    expect(getWarehouseStock(db,second.id).items.find(row=>row.variantId===variantId)?.quantity).toBe(3)
    const statement=getWarehouseStatement(db,second.id)
    expect(statement.purchases).toBe(90)
    expect(statement.stockQuantity).toBe(3)
    expect(statement.stockCostValue).toBe(90)
  })
})
