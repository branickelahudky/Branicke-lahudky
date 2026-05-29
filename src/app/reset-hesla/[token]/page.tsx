'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { usePasswordResetTokenAction } from './actions'

export default function ResetHeslaPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { setError('Heslo musí mít alespoň 8 znaků.'); return }
    if (form.password !== form.confirm) { setError('Hesla se neshodují.'); return }
    setSaving(true)
    setError('')
    try {
      await usePasswordResetTokenAction(token, form.password)
      setDone(true)
      setTimeout(() => router.push('/prihlaseni-admin'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při resetu hesla.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Heslo nastaveno</h1>
          <p className="text-stone-500">Přesměrovávám na přihlášení…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-red">Branické lahůdkářství</h1>
          <p className="mt-1 text-sm text-stone-500">Nastavení nového hesla</p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-stone-800">Nastavit nové heslo</h2>

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Nové heslo</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required autoComplete="new-password" className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              <p className="mt-0.5 text-xs text-stone-400">Minimálně 8 znaků</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Potvrzení hesla</label>
              <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required autoComplete="new-password" className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={saving} className="mt-2 w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
              {saving ? 'Nastavuji…' : 'Nastavit heslo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
