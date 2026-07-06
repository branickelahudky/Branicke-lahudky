'use client'

// Tenký proužek důvěry (USP) úplně nahoře — jako Rohlík. Tmavý pruh
// přes celou šířku, zlaté ikonky, položky z adminu (Vzhled → Benefity).
// Není sticky (odscrolluje), sticky zůstává hlavička pod ním.
// Mobil: jedna položka s automatickým prostřídáním (fade po 4 s).

import { useEffect, useState } from 'react'
import { UspIcon } from '@/lib/usp-icons'

export type UspTopBarItem = {
  id: string
  icon: string
  title: string
  subtitle: string | null
}

const ROTATE_MS = 4000

export function UspTopBar({ items }: { items: UspTopBarItem[] }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (items.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [items.length])

  if (!items.length) return null

  return (
    <div className="bg-[#0a0a0a] text-white">
      {/* Desktop/tablet: položky vedle sebe na střed */}
      <div className="mx-auto hidden h-9 max-w-7xl items-center justify-center gap-x-8 px-4 sm:flex">
        {items.map((item) => (
          <span key={item.id} className="flex min-w-0 items-center gap-1.5 text-xs">
            <UspIcon name={item.icon} className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="truncate font-medium">{item.title}</span>
            {item.subtitle && (
              <span className="hidden truncate text-white/60 lg:inline"> — {item.subtitle}</span>
            )}
          </span>
        ))}
      </div>

      {/* Mobil: jedna položka, fade prostřídání */}
      <div className="relative flex h-9 items-center justify-center overflow-hidden px-4 sm:hidden">
        {items.map((item, i) => (
          <span
            key={item.id}
            aria-hidden={i !== idx}
            className={`absolute inset-x-4 flex items-center justify-center gap-1.5 text-xs transition-opacity duration-500 ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <UspIcon name={item.icon} className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="truncate font-medium">{item.title}</span>
            {item.subtitle && <span className="truncate text-white/60"> — {item.subtitle}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
