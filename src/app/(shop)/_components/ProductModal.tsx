'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function ProductModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const close = useCallback(() => router.back(), [router])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [close])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70"
      onClick={close}
    >
      <div
        className="
          relative w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh]
          overflow-y-auto bg-shop-bg
          rounded-t-2xl sm:rounded-2xl
          shadow-2xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zavřít */}
        <button
          onClick={close}
          aria-label="Zavřít"
          className="sticky top-4 float-right mr-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-shop-card border border-shop-border text-shop-muted hover:text-shop-fg transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="clear-both">{children}</div>
      </div>
    </div>
  )
}
