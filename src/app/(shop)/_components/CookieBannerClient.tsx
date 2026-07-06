'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CONSENT_COOKIE, CONSENT_MAX_AGE, type ConsentValue } from '@/lib/cookie-consent'

export function CookieBannerClient({
  title,
  text,
  acceptLabel,
  rejectLabel,
  policyHref,
}: {
  title: string
  text: string
  acceptLabel: string
  rejectLabel: string
  policyHref: string | null
}) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  function choose(value: ConsentValue) {
    document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${CONSENT_MAX_AGE}; path=/; SameSite=Lax`
    try {
      localStorage.setItem(CONSENT_COOKIE, value)
    } catch {
      // cookie stačí
    }
    setVisible(false)
  }

  return (
    <section
      aria-label="Nastavení cookies"
      className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-shop-border bg-shop-surface p-4 shadow-lg sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-shop-fg">{title}</p>
          <p className="mt-0.5 text-sm text-shop-muted">
            {text}
            {policyHref && (
              <>
                {' '}
                <Link href={policyHref} className="text-gold underline hover:no-underline">
                  Zásady cookies
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('rejected')}
            className="flex-1 rounded-xl border border-shop-border px-4 py-2.5 text-sm font-semibold text-shop-fg transition hover:bg-shop-card sm:flex-none"
          >
            {rejectLabel}
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-shop-bg transition hover:bg-gold/90 sm:flex-none"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
