'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { acceptInvitationAction } from './actions'

const ROLE_LABELS: Record<string, string> = { OWNER: 'Majitel', ADMIN: 'Administrátor', STAFF: 'Obsluha' }

export default function PozvankaPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [state, setState] = useState<'form' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { setErrorMsg('Heslo musí mít alespoň 8 znaků.'); return }
    if (form.password !== form.confirm) { setErrorMsg('Hesla se neshodují.'); return }
    setSaving(true)
    setErrorMsg('')
    try {
      await acceptInvitationAction(token, form.firstName.trim(), form.lastName.trim(), form.password)
      setState('success')
      setTimeout(() => router.push('/prihlaseni-admin?zprava=aktivovan'), 1500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při aktivaci.')
      setState('error')
    } finally {
      setSaving(false)
    }
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Účet aktivován</h1>
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
          <p className="mt-1 text-sm text-stone-500">Přijetí pozvánky</p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          {state === 'error' ? (
            <div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
                {errorMsg}
              </div>
              <p className="text-sm text-stone-500">
                Pozvánka mohla vypršet nebo být zrušena. Kontaktujte administrátora.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-stone-800 mb-2">Dokončení registrace</h2>

              {errorMsg && (
                <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Jméno</label>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Příjmení</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Heslo</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required autoComplete="new-password" className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                <p className="mt-0.5 text-xs text-stone-400">Minimálně 8 znaků</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Potvrzení hesla</label>
                <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required autoComplete="new-password" className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              <button type="submit" disabled={saving} className="mt-2 w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40">
                {saving ? 'Aktivuji…' : 'Dokončit registraci'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
