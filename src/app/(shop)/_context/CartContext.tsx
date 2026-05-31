'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type CartItem = {
  productId: string
  slug: string
  sku: string
  name: string
  thumbnailUrl: string | null
  unitPriceWithVat: number
  unitPriceWithoutVat: number
  vatRate: number
  qty: number
  isWeightBased: boolean
  unit: string
}

type CartContextType = {
  items: CartItem[]
  isOpen: boolean
  totalQty: number
  subtotalWithVat: number
  addItem: (item: Omit<CartItem, 'qty'>, qty: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage after hydration (SSR safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setHydrated(true)
  }, [])

  // Persist on changes (only after hydration to avoid clearing on SSR)
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('cart', JSON.stringify(items)) } catch {}
  }, [items, hydrated])

  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const subtotalWithVat = items.reduce((s, i) => s + i.qty * i.unitPriceWithVat, 0)

  const addItem = useCallback((item: Omit<CartItem, 'qty'>, qty: number) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === item.productId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [...prev, { ...item, qty }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.productId !== productId))
    } else {
      setItems(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i))
    }
  }, [])

  const clear = useCallback(() => setItems([]), [])
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  return (
    <CartContext.Provider value={{
      items, isOpen, totalQty, subtotalWithVat,
      addItem, removeItem, updateQty, clear, openCart, closeCart,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
