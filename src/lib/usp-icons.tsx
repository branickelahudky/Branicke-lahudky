// Pevná sada ikon pro benefity (USP) — z lucide-react, která už
// v projektu je. Admin ukládá jen název (klíč), web/admin renderují
// přes UspIcon; neznámý název spadne na hvězdičku.

import {
  Truck,
  Snowflake,
  Medal,
  Clock,
  ShieldCheck,
  Heart,
  Star,
  Phone,
  Leaf,
  Package,
  type LucideIcon,
} from 'lucide-react'

export const USP_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  truck:     { icon: Truck,       label: 'Doprava' },
  snowflake: { icon: Snowflake,   label: 'Chlazení' },
  medal:     { icon: Medal,       label: 'Kvalita' },
  clock:     { icon: Clock,       label: 'Rychlost' },
  shield:    { icon: ShieldCheck, label: 'Záruka' },
  heart:     { icon: Heart,       label: 'Srdce' },
  star:      { icon: Star,        label: 'Hvězda' },
  phone:     { icon: Phone,       label: 'Telefon' },
  leaf:      { icon: Leaf,        label: 'Příroda' },
  package:   { icon: Package,     label: 'Balíček' },
}

export type UspIconName = keyof typeof USP_ICONS

export function UspIcon({ name, className }: { name: string; className?: string }) {
  const Icon = USP_ICONS[name]?.icon ?? Star
  return <Icon className={className} aria-hidden="true" />
}
