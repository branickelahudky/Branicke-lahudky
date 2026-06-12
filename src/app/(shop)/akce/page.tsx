import type { Metadata } from 'next'
import { FlagListing } from '../_components/FlagListing'

export const metadata: Metadata = {
  title: 'Akce',
  description: 'Aktuální akční nabídka — produkty ve slevě.',
}

// Vždy aktuální dle příznaků produktů (admin je mění v detailu produktu)
export const dynamic = 'force-dynamic'

export default function AkcePage() {
  return <FlagListing flag="sale" />
}
