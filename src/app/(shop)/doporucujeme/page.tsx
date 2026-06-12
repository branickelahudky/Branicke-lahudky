import type { Metadata } from 'next'
import { FlagListing } from '../_components/FlagListing'

export const metadata: Metadata = {
  title: 'Doporučujeme',
  description: 'Produkty, které doporučujeme z naší nabídky.',
}

// Vždy aktuální dle příznaků produktů (admin je mění v detailu produktu)
export const dynamic = 'force-dynamic'

export default function DoporucujemePage() {
  return <FlagListing flag="featured" />
}
