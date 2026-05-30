'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  title?: string | null
  /** Odkaz „Zobrazit více" — vynech nebo nech null pokud není */
  moreHref?: string | null
  children: React.ReactNode
}

function ArrowButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Posunout vlevo' : 'Posunout vpravo'}
      className={`
        absolute top-1/2 z-10 -translate-y-1/2
        ${dir === 'left' ? '-left-4' : '-right-4'}
        flex h-10 w-10 items-center justify-center rounded-full
        bg-white text-stone-900 shadow-xl text-xl font-bold
        opacity-0 group-hover/shelf:opacity-100
        transition-opacity duration-200
        hover:bg-gold hover:text-shop-bg
        focus:outline-none focus:opacity-100
      `}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  )
}

export function HorizontalShelf({ title, moreHref, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkBounds = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Initial check after paint so scrollWidth is settled
    const id = requestAnimationFrame(checkBounds)
    el.addEventListener('scroll', checkBounds, { passive: true })
    window.addEventListener('resize', checkBounds, { passive: true })
    return () => {
      cancelAnimationFrame(id)
      el.removeEventListener('scroll', checkBounds)
      window.removeEventListener('resize', checkBounds)
    }
  }, [checkBounds])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'right' ? el.clientWidth * 0.75 : -el.clientWidth * 0.75, behavior: 'smooth' })
  }

  return (
    <section className="py-8 border-t border-shop-border">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header row */}
        {(title || moreHref) && (
          <div className="mb-4 flex items-center justify-between gap-4">
            {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
            {moreHref && (
              <a href={moreHref}
                className="shrink-0 text-sm text-shop-muted hover:text-gold transition">
                Zobrazit více →
              </a>
            )}
          </div>
        )}

        {/* Scrollable shelf */}
        <div className="group/shelf relative">
          {/* Left arrow */}
          {canLeft && <ArrowButton dir="left" onClick={() => scroll('left')} />}

          {/* Track */}
          <div
            ref={scrollRef}
            className="
              flex gap-3 overflow-x-auto
              scroll-smooth snap-x snap-mandatory
              [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
              pb-1
            "
          >
            {children}
          </div>

          {/* Right arrow */}
          {canRight && <ArrowButton dir="right" onClick={() => scroll('right')} />}
        </div>
      </div>
    </section>
  )
}
