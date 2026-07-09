import type { Metadata } from 'next'
import { FlagListing } from '../_components/FlagListing'

export const metadata: Metadata = {
  title: 'Novinky',
  description: 'Nově zařazené produkty v naší nabídce.',
  alternates: { canonical: '/novinky' },
}

// Vždy aktuální dle příznaků produktů (admin je mění v detailu produktu)
export const dynamic = 'force-dynamic'

export default function NovinkyPage() {
  return <FlagListing flag="new" />
}
