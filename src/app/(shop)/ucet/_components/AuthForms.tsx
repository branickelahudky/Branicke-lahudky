'use client'

// Formuláře přihlášení / registrace / zapomenuté heslo / obnova hesla.
// useActionState drží vyplněné hodnoty při chybě (formulář se neresetuje,
// action vrací {error} místo redirectu).

import { useActionState } from 'react'
import Link from 'next/link'
import {
  loginAction,
  registerAction,
  forgotPasswordAction,
  resetPasswordAction,
  type ActionState,
} from '../actions'

const INPUT_CLS =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-shop-fg outline-none transition placeholder:text-shop-muted/60 focus:border-gold focus:ring-2 focus:ring-gold/20'

const BUTTON_CLS =
  'w-full rounded-xl bg-gold px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50'

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {error}
    </p>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-shop-fg">
      {children}
    </label>
  )
}

// ─── Přihlášení ────────────────────────────────────────────────────

export function LoginForm({ from }: { from?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, null)

  return (
    <form action={formAction} className="space-y-4">
      {from && <input type="hidden" name="from" value={from} />}
      <ErrorBox error={state?.error} />
      <div>
        <FieldLabel htmlFor="login-email">E-mail</FieldLabel>
        <input id="login-email" name="email" type="email" autoComplete="email" required className={INPUT_CLS} />
      </div>
      <div>
        <FieldLabel htmlFor="login-password">Heslo</FieldLabel>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required className={INPUT_CLS} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/ucet/zapomenute-heslo" className="text-shop-muted hover:text-gold hover:underline">
          Zapomenuté heslo?
        </Link>
        <Link
          href={from ? `/ucet/registrace?from=${encodeURIComponent(from)}` : '/ucet/registrace'}
          className="font-medium text-gold hover:underline"
        >
          Založit účet
        </Link>
      </div>
    </form>
  )
}

// ─── Registrace ────────────────────────────────────────────────────

export function RegisterForm({ from }: { from?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(registerAction, null)

  if (state?.claimSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">📬</p>
        <h2 className="text-lg font-bold text-shop-fg">Váš e-mail už známe!</h2>
        <p className="text-sm leading-relaxed text-shop-muted">
          Tento e-mail máme z prodejny nebo z dřívějších nákupů. Abychom účet bezpečně
          propojili, poslali jsme vám e-mail s odkazem na <strong>nastavení hesla</strong>.
          Po jeho nastavení se přihlásíte a uvidíte i své údaje.
        </p>
        <p className="text-xs text-shop-muted">E-mail nedorazil? Zkontrolujte spam, nebo použijte „Zapomenuté heslo".</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {from && <input type="hidden" name="from" value={from} />}
      <ErrorBox error={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="reg-firstName">Jméno</FieldLabel>
          <input id="reg-firstName" name="firstName" autoComplete="given-name" required className={INPUT_CLS} />
        </div>
        <div>
          <FieldLabel htmlFor="reg-lastName">Příjmení</FieldLabel>
          <input id="reg-lastName" name="lastName" autoComplete="family-name" required className={INPUT_CLS} />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="reg-email">E-mail</FieldLabel>
        <input id="reg-email" name="email" type="email" autoComplete="email" required className={INPUT_CLS} />
      </div>
      <div>
        <FieldLabel htmlFor="reg-password">Heslo (min. 8 znaků)</FieldLabel>
        <input id="reg-password" name="password" type="password" autoComplete="new-password" minLength={8} required className={INPUT_CLS} />
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-shop-fg">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#C9A961]" />
        <span>
          Souhlasím s{' '}
          <Link href="/obchodni-podminky" target="_blank" className="font-medium text-gold hover:underline">
            obchodními podmínkami
          </Link>
        </span>
      </label>
      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Zakládám účet…' : 'Založit účet'}
      </button>
      <p className="text-center text-sm text-shop-muted">
        Už máte účet?{' '}
        <Link
          href={from ? `/ucet/prihlaseni?from=${encodeURIComponent(from)}` : '/ucet/prihlaseni'}
          className="font-medium text-gold hover:underline"
        >
          Přihlaste se
        </Link>
      </p>
    </form>
  )
}

// ─── Zapomenuté heslo ──────────────────────────────────────────────

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, null)

  if (state?.sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">📬</p>
        <h2 className="text-lg font-bold text-shop-fg">Zkontrolujte e-mail</h2>
        <p className="text-sm leading-relaxed text-shop-muted">
          Pokud u nás tento e-mail máme, poslali jsme na něj odkaz pro nastavení nového
          hesla. Odkaz platí 60 minut.
        </p>
        <Link href="/ucet/prihlaseni" className="inline-block text-sm font-medium text-gold hover:underline">
          Zpět na přihlášení
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBox error={state?.error} />
      <p className="text-sm text-shop-muted">
        Zadejte e-mail, na který je účet založený — pošleme vám odkaz pro nastavení nového hesla.
        Funguje i pro zákazníky, které známe z prodejny a heslo si ještě nenastavili.
      </p>
      <div>
        <FieldLabel htmlFor="forgot-email">E-mail</FieldLabel>
        <input id="forgot-email" name="email" type="email" autoComplete="email" required className={INPUT_CLS} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Odesílám…' : 'Poslat odkaz'}
      </button>
      <p className="text-center">
        <Link href="/ucet/prihlaseni" className="text-sm text-shop-muted hover:text-gold hover:underline">
          Zpět na přihlášení
        </Link>
      </p>
    </form>
  )
}

// ─── Obnova hesla (z odkazu) ───────────────────────────────────────

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, null)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <ErrorBox error={state?.error} />
      <div>
        <FieldLabel htmlFor="reset-password">Nové heslo (min. 8 znaků)</FieldLabel>
        <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={8} required className={INPUT_CLS} />
      </div>
      <div>
        <FieldLabel htmlFor="reset-passwordConfirm">Nové heslo znovu</FieldLabel>
        <input id="reset-passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required className={INPUT_CLS} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Ukládám…' : 'Nastavit heslo'}
      </button>
    </form>
  )
}
