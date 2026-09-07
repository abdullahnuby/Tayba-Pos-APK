export type UserRole = 'admin' | 'manager' | 'cashier'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'

export interface User { id: string; username: string; name: string; role: UserRole; active: boolean }
export interface Variant { id: string; product_id: string; sku: string; barcode: string | null; size: string | null; color: string | null; cost_price: number; sell_price: number; quantity: number; min_quantity: number; reorder_qty: number }
export interface Product { id: string; name: string; category_id: string; category_name?: string; variants: Variant[] }
export interface Customer { id: string; name: string; phone: string | null; address?: string | null; notes?: string | null; balance: number; loyalty_points: number }
export interface Supplier { id: string; name: string; phone: string | null; address?: string | null; notes?: string | null; balance: number }
export interface CartLine { variantId: string; name: string; sku: string; price: number; quantity: number }
export interface RegisterSession { id: string; user_id: string; opening_float: number; closing_float: number | null; expected_cash?: number | null; difference?: number | null; cash_sales?: number; card_sales?: number; transfer_sales?: number; status: 'open' | 'closed'; opened_at: string; closed_at: string | null }
