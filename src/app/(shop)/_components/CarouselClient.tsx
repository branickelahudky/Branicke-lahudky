'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export type CarouselSlide = {
  id: string
  imageUrl: string
  imageAlt: string | null
  href: string | null
  openNewTab: boolean
}

interface Props {
  slides: CarouselSlide[]
}

export function CarouselClient({ slides }: Props) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const next = useCallback(() => setCurrent((i) => (i + 1) % slides.length), [slides.length])
  const prev = useCallback(() => setCurrent((i) => (i - 1 + slides.length) % slides.length), [slides.length])

  // Auto-play
  useEffect(() => {
    if (slides.length <= 1) return
    timerRef.current = setTimeout(next, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, next, slides.length])

  // Touch swipe
  const touchStartX = useRef<number | null>(null)
  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev() }
    touchStartX.current = null
  }

  if (!slides.length) return null

  const slide = slides[current]

  const content = (
    <div className="relative w-full aspect-[16/6] overflow-hidden bg-shop-card">
      <Image
        key={slide.id}
        src={slide.imageUrl}
        alt={slide.imageAlt ?? ''}
        fill
        className="object-cover transition-opacity duration-500"
        priority={current === 0}
        sizes="100vw"
        unoptimized
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      {/* Prev/Next */}
      {slides.length > 1 && (
        <>
          <button onClick={(e) => { e.preventDefault(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition">
            ‹
          </button>
          <button onClick={(e) => { e.preventDefault(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition">
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={(e) => { e.preventDefault(); setCurrent(i) }}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-gold' : 'w-1.5 bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="w-full select-none">
      {slide.href ? (
        <Link href={slide.href} target={slide.openNewTab ? '_blank' : undefined}>
          {content}
        </Link>
      ) : content}
    </div>
  )
}
