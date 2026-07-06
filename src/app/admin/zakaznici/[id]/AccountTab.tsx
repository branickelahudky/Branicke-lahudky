'use client'

// Záložka „Účty uživatele" v detailu zákazníka — stav zákaznického účtu
// a záchranné akce (reset hesla, odhlášení všude, deaktivace).
// Admin heslo zákazníka nikdy nevidí ani nenastavuje — jen posílá odkaz.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  sendCustomerResetLink,
  revokeCustomerSessions,
  setCustomerAccountDisabled,
} from './actions'

export type SerializedAccount = {
  emailVerifiedAt: string | null
  isDisabled: boolean
  lastLoginAt: string | null
  activeSessionCount: number
  lastSession: {
    createdAt: string
    ipAddress: string | null
    userAgent: string | null
  } | null
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** Zkrácený popis zařízení z user-agentu — jen orientační. */
function deviceHint(ua: string | null): string | null {
  if (!ua) return null
  if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return null
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{children}</dd>
    </div>
  )
}

interface Props {
  customerId: string
  customerEmail: string
  customerCreatedAt: string
  isImported: boolean
  hasPassword: boolean
  hasGoogle: boolean
  account: SerializedAccount
  userRole: string
}

export function AccountTab({
  customerId,
  customerEmail,
  customerCreatedAt,
  isImported,
  hasPassword,
  hasGoogle,
  account,
  userRole,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const canManage = userRole !== 'STAFF'

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Akce se nepodařila.')
      }
    })
  }

  function handleSendReset() {
    const msg = hasPassword
      ? `Poslat zákazníkovi ${customerEmail} odkaz na obnovu hesla?`
      : `Poslat zákazníkovi ${customerEmail} pozvánku k vytvoření účtu?\n\nE-mailem dostane odkaz na nastavení hesla.`
    if (!window.confirm(msg)) return
    run(async () => {
      const result = await sendCustomerResetLink(customerId)
      toast.success(
        (result.isInvite ? 'Pozvánka k účtu odeslána.' : 'Odkaz na obnovu hesla odeslán.') +
          (result.testMode ? ' (testovací režim — doručeno na testovací schránku)' : ''),
      )
    })
  }

  function handleRevokeSessions() {
    if (!window.confirm(`Odhlásit zákazníka ${customerEmail} ze všech zařízení?\n\nBude se muset všude znovu přihlásit.`)) return
    run(async () => {
      const { revokedCount } = await revokeCustomerSessions(customerId)
      toast.success(
        revokedCount > 0
          ? `Odhlášeno ${revokedCount} ${revokedCount === 1 ? 'přihlášení' : 'přihlášení'}.`
          : 'Zákazník neměl žádná aktivní přihlášení.',
      )
    })
  }

  function handleToggleDisabled() {
    const msg = account.isDisabled
      ? `Znovu aktivovat účet zákazníka ${customerEmail}?\n\nZákazník se bude moci opět přihlásit.`
      : `Deaktivovat účet zákazníka ${customerEmail}?\n\nZákazník se nebude moci přihlásit a všechna jeho přihlášení se ukončí. Objednávky a data zůstávají — deaktivace není smazání.`
    if (!window.confirm(msg)) return
    run(async () => {
      await setCustomerAccountDisabled(customerId, !account.isDisabled)
      toast.success(account.isDisabled ? 'Účet aktivován.' : 'Účet deaktivován a zákazník odhlášen.')
    })
  }

  const actionBtn =
    'rounded border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40'

  // ── Zákazník bez účtu ────────────────────────────────────────────
  // (účet přes Google existuje i bez hesla)

  if (!hasPassword && !hasGoogle) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-center">
          <p className="text-sm font-medium text-stone-700">Zákazník nemá zákaznický účet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-stone-400">
            {isImported
              ? 'Zákazník je importovaný ze Shoptetu / z prodejny a heslo si zatím nenastavil.'
              : 'Zákazník zatím nakupoval jen jako host.'}{' '}
            Pozvánkou mu pošlete e-mail s odkazem na nastavení hesla — po nastavení se z něj stane
            plnohodnotný účet se stejnými údaji a objednávkami.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={handleSendReset}
              disabled={isPending}
              className={`${actionBtn} mt-4 border-amber-400 bg-amber-50 font-medium text-amber-800 hover:bg-amber-100`}
            >
              {isPending ? 'Odesílám…' : 'Poslat pozvánku k vytvoření účtu'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Zákazník s účtem ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {account.isDisabled && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Účet je <strong>deaktivovaný</strong> — zákazník se nemůže přihlásit. Data a objednávky
          zůstávají zachované.
        </div>
      )}

      {/* Stav účtu */}
      <div>
        <h3 className="mb-2 border-b border-stone-100 pb-2 text-sm font-semibold text-stone-700">
          Stav účtu
        </h3>
        <dl className="divide-y divide-stone-100">
          <InfoRow label="Stav">
            {account.isDisabled ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                Deaktivován
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                Aktivní účet
              </span>
            )}
          </InfoRow>
          <InfoRow label="E-mail">
            {account.emailVerifiedAt ? (
              <span className="text-green-700">✓ ověřen {fmtDateTime(account.emailVerifiedAt)}</span>
            ) : (
              <span className="text-stone-400">neověřen</span>
            )}
          </InfoRow>
          <InfoRow label="Způsob přihlášení">
            <span>
              {hasPassword ? 'heslo' : <span className="text-stone-400">bez hesla</span>}
              {hasGoogle && (
                <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                  Propojeno s Google
                </span>
              )}
            </span>
          </InfoRow>
          <InfoRow label="Zákazníkem od">
            {fmtDateTime(customerCreatedAt)}
            {isImported && (
              <span className="block text-xs font-normal text-stone-400">
                (datum importu — účet si aktivoval později)
              </span>
            )}
          </InfoRow>
          <InfoRow label="Poslední přihlášení">
            {account.lastSession ? (
              <>
                {fmtDateTime(account.lastSession.createdAt)}
                {(account.lastSession.ipAddress || deviceHint(account.lastSession.userAgent)) && (
                  <span className="block text-xs font-normal text-stone-400">
                    {[deviceHint(account.lastSession.userAgent), account.lastSession.ipAddress]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </>
            ) : (
              <span className="text-stone-400">zatím nikdy</span>
            )}
          </InfoRow>
          <InfoRow label="Aktivní přihlášení">
            {account.activeSessionCount > 0 ? (
              <span>{account.activeSessionCount} zařízení</span>
            ) : (
              <span className="text-stone-400">žádné</span>
            )}
          </InfoRow>
        </dl>
      </div>

      {/* Akce */}
      {canManage && (
        <div>
          <h3 className="mb-3 border-b border-stone-100 pb-2 text-sm font-semibold text-stone-700">
            Akce
          </h3>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-700">Obnova hesla</p>
                <p className="text-xs text-stone-400">
                  Pošle zákazníkovi e-mail s odkazem — heslo nastavuje jen on sám.
                </p>
              </div>
              <button type="button" onClick={handleSendReset} disabled={isPending}
                className={`${actionBtn} border-stone-300 text-stone-600 hover:bg-stone-50`}>
                Poslat odkaz na obnovu hesla
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-700">Odhlásit ze všech zařízení</p>
                <p className="text-xs text-stone-400">
                  Pro případ ukradeného přístupu — ukončí všechna přihlášení zákazníka.
                </p>
              </div>
              <button type="button" onClick={handleRevokeSessions} disabled={isPending}
                className={`${actionBtn} border-stone-300 text-stone-600 hover:bg-stone-50`}>
                Odhlásit všude
              </button>
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${account.isDisabled ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
              <div>
                <p className="text-sm font-medium text-stone-700">
                  {account.isDisabled ? 'Aktivovat účet' : 'Deaktivovat účet'}
                </p>
                <p className="text-xs text-stone-400">
                  {account.isDisabled
                    ? 'Zákazník se bude moci znovu přihlásit.'
                    : 'Zablokuje přihlášení a ukončí všechna zařízení. Data zůstávají — není to smazání.'}
                </p>
              </div>
              <button type="button" onClick={handleToggleDisabled} disabled={isPending}
                className={`${actionBtn} ${
                  account.isDisabled
                    ? 'border-green-500 text-green-700 hover:bg-green-50'
                    : 'border-red-300 text-red-600 hover:bg-red-50'
                }`}>
                {account.isDisabled ? 'Aktivovat účet' : 'Deaktivovat účet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
