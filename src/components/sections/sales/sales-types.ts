export type Role = 'admin' | 'manager' | 'cashier'

export interface SessionUser {
  id: string
  username: string
  name: string
  role: Role
}

export interface Variant {
  id: string
  sku: string
  barcode: string | null
  size: string | null
  color: string | null
  sellPrice: number
  quantity: number
  product: {
    id: string
    name: string
  }
  saleUnit?: string | null
  saleUnitFactor?: number | null
  quarterDozenPrice?: number | null
  halfDozenPrice?: number | null
  dozenPrice?: number | null
}

export interface Product {
  id: string
  name: string
  category?: { id: string; name: string } | null
  variants: Variant[]
}

export interface Customer {
  id: string
  name: string
  phone?: string | null
}

export interface CartItem {
  variantId: string
  name: string
  sku: string
  size: string | null
  color: string | null
  price: number
  quantity: number
  max: number
  unit: string
  factor: number
  packLabel?: string
}

export interface SaleItem {
  id: string
  quantity: number
  total: number
  variant: {
    product: { name: string }
    sku: string
    size: string | null
    color: string | null
  }
}

export interface Sale {
  id: string
  invoiceNo: string
  date: string
  total: number
  paid: number
  change: number
  paymentMethod: string
  status: string
  customer?: { name: string; phone?: string | null } | null
  items: SaleItem[]
}

export interface ApiError extends Error {
  needsManagerApproval?: boolean
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit'
