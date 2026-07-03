'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

export type CartItem = {
  productId: string
  /** Zvolená varianta produktu (200 g / 500 g…) — null = produkt bez variant */
  variantId: string | null
  variantName: string | null
  /** Hmotnost jedné jednotky v gramech (varianta → produkt), pro odhad dopravy */
  weightGrams: number | null
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

/** Identita položky v košíku — stejný produkt v různých variantách = různé řádky. */
export function cartItemKey(item: { productId: string; variantId: string | null }): string {
  return item.variantId ? `${item.productId}:${item.variantId}` : item.productId
}

/** Režim otevření flyoutu:
 *  - 'manual' = klik na košík v hlavičce → zůstává otevřený (žádné auto-zavření)
 *  - 'auto'   = po přidání položky → po 2,5 s se sám zasune (pokud na něm není kurzor/focus) */
export type CartOpenMode = 'manual' | 'auto'

type CartContextType = {
  items: CartItem[]
  /** true až po načtení košíku z localStorage — do té doby jsou items prázdné i u plného košíku */
  hydrated: boolean
  isOpen: boolean
  openMode: CartOpenMode
  totalQty: number
  subtotalWithVat: number
  /** Poslední přidaná položka — pro vizuální odezvu (flash) ve flyoutu.
   *  nonce roste i při opakovaném přidání téhož produktu, aby se efekt spustil znovu. */
  lastAdded: { itemKey: string; nonce: number } | null
  addItem: (item: Omit<CartItem, 'qty'>, qty: number) => void
  removeItem: (itemKey: string) => void
  updateQty: (itemKey: string, qty: number) => void
  clear: () => void
  openCart: (mode?: CartOpenMode) => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [openMode, setOpenMode] = useState<CartOpenMode>('manual')
  const [hydrated, setHydrated] = useState(false)
  const [lastAdded, setLastAdded] = useState<{ itemKey: string; nonce: number } | null>(null)
  const nonceRef = useRef(0)

  // Load from localStorage after hydration (SSR safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) {
        // starší košíky (před variantami) nemají nová pole — doplnit
        const parsed = (JSON.parse(saved) as Partial<CartItem>[]).map((i) => ({
          variantId: null,
          variantName: null,
          weightGrams: null,
          ...i,
        })) as CartItem[]
        setItems(parsed)
      }
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
    const key = cartItemKey(item)
    setItems(prev => {
      const idx = prev.findIndex(i => cartItemKey(i) === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [...prev, { ...item, qty }]
    })
    nonceRef.current += 1
    setLastAdded({ itemKey: key, nonce: nonceRef.current })
  }, [])

  const removeItem = useCallback((itemKey: string) => {
    setItems(prev => prev.filter(i => cartItemKey(i) !== itemKey))
  }, [])

  const updateQty = useCallback((itemKey: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => cartItemKey(i) !== itemKey))
    } else {
      setItems(prev => prev.map(i => cartItemKey(i) === itemKey ? { ...i, qty } : i))
    }
  }, [])

  const clear = useCallback(() => setItems([]), [])
  // Otevření flyoutu. Přidání položky volá openCart('auto') až po doletu animace
  // (viz flyToCart), ruční klik v hlavičce volá openCart() = 'manual'.
  const openCart = useCallback((mode: CartOpenMode = 'manual') => {
    setOpenMode(mode)
    setIsOpen(true)
  }, [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  return (
    <CartContext.Provider value={{
      items, hydrated, isOpen, openMode, totalQty, subtotalWithVat, lastAdded,
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
