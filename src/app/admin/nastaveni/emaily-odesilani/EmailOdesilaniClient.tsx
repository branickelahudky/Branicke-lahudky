'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { testEmailConnection, sendTestEmail } from './actions'

type ConnectionState = 'idle' | 'ok' | 'error'

interface Props {
  host: string | null
  port: string | null
  user: string | null
  configured: boolean
}

// ─── Section wrapper ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-mono text-stone-700">{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

export function EmailOdesilaniClient({ host, port, user, configured }: Props) {
  const [connState, setConnState] = useState<ConnectionState>('idle')
  const [connError, setConnError] = useState<string>('')
  const [testTo, setTestTo] = useState(user ?? 'info@lahudkybranik.cz')
  const [isPending, startTransition] = useTransition()

  function handleVerify() {
    startTransition(async () => {
      try {
        const result = await testEmailConnection()
        if (result.ok) {
          setConnState('ok')
          setConnError('')
        } else {
          setConnState('error')
          setConnError(result.error ?? 'Neznámá chyba')
        }
      } catch (err) {
        setConnState('error')
        setConnError(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  function handleSendTest() {
    startTransition(async () => {
      try {
        const result = await sendTestEmail(testTo)
        if (result.success) {
          toast.success(`Testovací email odeslán na ${testTo}`)
        } else {
          toast.error(`Chyba: ${result.error ?? 'Neznámá chyba'}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-semibold text-stone-800">Nastavení odesílání emailů</h2>

      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="mt-0.5 flex-shrink-0">⚠️</span>
          <span>
            SMTP není nakonfigurováno. Vyplňte údaje v souboru <code className="font-mono text-red-700">.env</code> na serveru.
          </span>
        </div>
      )}

      {/* Stav připojení */}
      <Section title="Stav připojení">
        <div className="flex items-center gap-3">
          <button
            onClick={handleVerify}
            disabled={isPending || !configured}
            className="rounded-lg bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {isPending ? 'Testuji…' : 'Otestovat připojení'}
          </button>
          {connState === 'ok' && (
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <span>✅</span> Připojeno
            </span>
          )}
          {connState === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-red-700">
              <span>❌</span> Chyba: {connError}
            </span>
          )}
        </div>
      </Section>

      {/* Konfigurace */}
      <Section title="Konfigurace">
        <div className="space-y-2 divide-y divide-stone-100">
          <Row label="SMTP server" value={host ?? 'nenastaveno'} />
          <div className="pt-2">
            <Row label="Port" value={port ?? 'nenastaveno'} />
          </div>
          <div className="pt-2">
            <Row label="Odesílatel" value={user ?? 'nenastaveno'} />
          </div>
          <div className="pt-2">
            <Row label="Heslo" value={configured ? '●●●●●●●●' : 'nenastaveno'} />
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Tyto údaje se nastavují v souboru <code className="font-mono">.env</code> na serveru.
        </p>
      </Section>

      {/* Testovací email */}
      <Section title="Testovací email">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-stone-500">Odeslat na</label>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={isPending || !configured}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap"
          >
            {isPending ? 'Odesílám…' : 'Odeslat testovací email'}
          </button>
        </div>
      </Section>
    </div>
  )
}
