'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  changeOwnPasswordAction,
  revokeSessionAction,
  revokeAllOtherSessionsAction,
  type ActiveSession,
  type LoginHistoryEntry,
} from './actions'
import { parseUserAgent } from '@/lib/user-agent'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(d))
}

// ─── Change password section ───────────────────────────────────────────────

function ChangePasswordSection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.next.length < 8) { setError('Nové heslo musí mít alespoň 8 znaků.'); return }
    if (form.next !== form.confirm) { setError('Hesla se neshodují.'); return }
    if (form.next === form.current) { setError('Nové heslo se musí lišit od současného.'); return }
    setSaving(true)
    try {
      await changeOwnPasswordAction(form.current, form.next)
      toast.success('Heslo bylo úspěšně změněno.')
      setForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chyba při změně hesla.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Změna hesla</h2>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Současné heslo</label>
          <input
            type="password"
            value={form.current}
            onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Nové heslo</label>
          <input
            type="password"
            value={form.next}
            onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
            required
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Potvrzení nového hesla</label>
          <input
            type="password"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-stone-400">
          Heslo musí mít minimálně 8 znaků. Doporučujeme kombinaci písmen a číslic.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-40"
        >
          {saving ? 'Měním…' : 'Změnit heslo'}
        </button>
      </form>
    </div>
  )
}

// ─── Active sessions section ───────────────────────────────────────────────

function ActiveSessionsSection({ sessions: initial }: { sessions: ActiveSession[] }) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [revokeAllPending, setRevokeAllPending] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleRevoke(sessionId: string) {
    try {
      await revokeSessionAction(sessionId)
      setSessions(s => s.filter(x => x.id !== sessionId))
      toast.success('Relace ukončena.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba.')
    }
  }

  async function handleRevokeAll() {
    if (!confirm('Odhlásí vás ze všech ostatních zařízení. Pokračovat?')) return
    setRevokeAllPending(true)
    try {
      await revokeAllOtherSessionsAction()
      setSessions(s => s.filter(x => x.isCurrent))
      toast.success('Všechny ostatní relace byly ukončeny.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba.')
    } finally {
      setRevokeAllPending(false)
    }
  }

  const others = sessions.filter(s => !s.isCurrent)

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Aktivní relace</h2>
        <p className="mt-0.5 text-xs text-stone-400">Zařízení, na kterých jste aktuálně přihlášen/a.</p>
      </div>
      <div className="divide-y divide-stone-100">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between px-6 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${s.isCurrent ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
                  {parseUserAgent(s.userAgent)}
                </span>
                {s.isCurrent && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">Tato relace</span>
                )}
              </div>
              <div className="mt-0.5 flex gap-3 text-xs text-stone-400">
                <span>{s.ipAddress ?? '—'}</span>
                <span>Přihlášen {fmtDate(s.createdAt)}</span>
              </div>
            </div>
            {!s.isCurrent && (
              <button
                onClick={() => handleRevoke(s.id)}
                disabled={isPending}
                className="ml-4 shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Ukončit
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="px-6 py-4 text-sm text-stone-400">Žádné aktivní relace.</p>
        )}
      </div>
      {others.length > 0 && (
        <div className="border-t border-stone-100 px-6 py-3.5">
          <button
            onClick={handleRevokeAll}
            disabled={revokeAllPending}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            {revokeAllPending ? 'Ukončuji…' : 'Ukončit všechny ostatní relace'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Login history section ─────────────────────────────────────────────────

function LoginHistorySection({ logs }: { logs: LoginHistoryEntry[] }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Historie přihlášení (posledních 20)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-5 py-2.5 text-left">Datum a čas</th>
              <th className="px-5 py-2.5 text-left">Stav</th>
              <th className="px-5 py-2.5 text-left">IP adresa</th>
              <th className="px-5 py-2.5 text-left">Zařízení</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-t border-stone-100">
                <td className="px-5 py-2.5 text-stone-600">{fmtDate(log.createdAt)}</td>
                <td className="px-5 py-2.5">
                  {log.action === 'LOGIN' ? (
                    <span className="font-medium text-green-700">✓ Úspěch</span>
                  ) : (
                    <span className="font-medium text-red-600">✗ Neúspěch</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-stone-500">{log.ipAddress ?? '—'}</td>
                <td className="px-5 py-2.5 text-stone-500">{parseUserAgent(log.userAgent)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-4 text-center text-stone-400">Žádné záznamy.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
        Veškerá aktivita se zaznamenává v auditním logu.
      </p>
    </div>
  )
}

// ─── 2FA placeholder ────────────────────────────────────────────────────────

function TwoFASection() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Dvoufaktorová autentizace (2FA)
          </h2>
          <p className="mt-1 text-sm text-stone-600">Přidejte druhou vrstvu ochrany k Vašemu účtu.</p>
        </div>
        <span className="ml-4 shrink-0 rounded bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
          Nenastaveno
        </span>
      </div>
      <p className="mt-4 text-sm text-stone-500">
        2FA pomocí aplikace Google Authenticator nebo podobné. Při přihlášení zadáte navíc kód
        generovaný aplikací na vašem telefonu.
      </p>
      <div className="mt-4">
        <button
          disabled
          title="Připravujeme"
          className="cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-400"
        >
          Nastavit 2FA
        </button>
        <span className="ml-3 text-xs text-stone-400">Připravujeme</span>
      </div>
    </div>
  )
}

// ─── Root client component ─────────────────────────────────────────────────

export function ZabezpeceniClient({
  sessions,
  loginHistory,
}: {
  sessions: ActiveSession[]
  loginHistory: LoginHistoryEntry[]
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <h1 className="text-lg font-bold text-stone-900">Zabezpečení</h1>
      <ChangePasswordSection />
      <ActiveSessionsSection sessions={sessions} />
      <LoginHistorySection logs={loginHistory} />
      <TwoFASection />
    </div>
  )
}
