'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('shop-theme') as Theme | null
    if (stored === 'light' || stored === 'dark') {
      applyTheme(stored)
      setTheme(stored)
    }
  }, [])

  function applyTheme(t: Theme) {
    document.getElementById('shop-root')?.setAttribute('data-theme', t)
  }

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('shop-theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Přepnout na tmavé téma' : 'Přepnout na světlé téma'}
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-shop-muted border border-shop-border hover:border-gold/50 hover:text-gold transition"
    >
      {theme === 'light' ? (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          Tmavé
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          Světlé
        </>
      )}
    </button>
  )
}
