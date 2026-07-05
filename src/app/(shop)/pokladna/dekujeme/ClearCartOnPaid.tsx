'use client'

// Po úspěšné online platbě (návrat z PayPalu) vyprázdní košík.
// U ručních plateb košík vyprazdňuje pokladna hned po odeslání —
// u online plateb až tady, aby zrušená platba košík nesmazala.
// Guard v localStorage: opětovná návštěva stejné děkovné stránky
// (záložka, historie) už košík nemaže.

import { useEffect } from 'react'
import { useCart } from '../../_context/CartContext'

export function ClearCartOnPaid({ orderToken }: { orderToken: string }) {
  const { clear } = useCart()

  useEffect(() => {
    const key = `cart-cleared-${orderToken}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {}
    clear()
  }, [orderToken, clear])

  return null
}
