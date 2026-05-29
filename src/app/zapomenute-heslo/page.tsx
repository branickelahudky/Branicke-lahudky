'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loadForgotPasswordData } from '@/app/admin/nastaveni/spravci/actions'

export default function ZapomentueHesloPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await loadForgotPasswordData(email.trim().toLowerCase())
    } catch {
      // Záměrně ignorujeme chybu — neprozrazovat zda email existuje
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-red">Branické lahůdkářství</h1>
          <p className="mt-1 text-sm text-stone-500">Obnova přístupu</p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          {submitted ? (
            <div className="text-center">
              <div className="mb-3 text-3xl">✉️</div>
              <h2 className="mb-2 text-base font-semibold text-stone-800">Email odeslán</h2>
              <p className="text-sm text-stone-500">
                Pokud existuje účet s tímto emailem, zaslali jsme pokyny pro reset hesla.
              </p>
              <Link href="/prihlaseni-admin" className="mt-4 block text-sm text-blue-600 hover:underline">
                Zpět na přihlášení
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-4 text-base font-semibold text-stone-800">Zapomněli jste heslo?</h2>
              <p className="mb-5 text-sm text-stone-500">
                Zadejte svůj přihlašovací email. Pošleme vám odkaz pro nastavení nového hesla.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="vas@email.cz"
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                  {loading ? 'Odesílám…' : 'Odeslat instrukce'}
                </button>
                <Link href="/prihlaseni-admin" className="text-center text-sm text-stone-500 hover:text-stone-700">
                  Zpět na přihlášení
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
