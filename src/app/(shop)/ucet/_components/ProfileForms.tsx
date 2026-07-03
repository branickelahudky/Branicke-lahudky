'use client'

// Formuláře profilu: údaje + adresa, změna hesla, odhlášení.

import { useActionState, useState } from 'react'
import {
  updateProfileAction,
  changePasswordAction,
  logoutAction,
  type ActionState,
} from '../actions'

const INPUT_CLS =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-shop-fg outline-none transition placeholder:text-shop-muted/60 focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-stone-50 disabled:text-shop-muted'

const BUTTON_CLS =
  'rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50'

function StateBox({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
        {state.error}
      </p>
    )
  }
  if (state?.saved) {
    return (
      <p className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
        Uloženo.
      </p>
    )
  }
  return null
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-shop-fg">
      {children}
    </label>
  )
}

// ─── Profil ────────────────────────────────────────────────────────

export type ProfileData = {
  email: string
  firstName: string
  lastName: string
  phone: string
  isBusiness: boolean
  companyName: string
  companyId: string
  vatId: string
  street: string
  city: string
  postalCode: string
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProfileAction, null)
  const [isBusiness, setIsBusiness] = useState(profile.isBusiness)

  return (
    <form action={formAction} className="space-y-4">
      <StateBox state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-firstName">Jméno</Label>
          <input id="p-firstName" name="firstName" defaultValue={profile.firstName} required className={INPUT_CLS} />
        </div>
        <div>
          <Label htmlFor="p-lastName">Příjmení</Label>
          <input id="p-lastName" name="lastName" defaultValue={profile.lastName} required className={INPUT_CLS} />
        </div>
        <div>
          <Label htmlFor="p-email">E-mail (nelze změnit)</Label>
          <input id="p-email" value={profile.email} disabled className={INPUT_CLS} />
        </div>
        <div>
          <Label htmlFor="p-phone">Telefon</Label>
          <input id="p-phone" name="phone" type="tel" defaultValue={profile.phone} placeholder="777 123 456" className={INPUT_CLS} />
        </div>
      </div>

      <div className="border-t border-stone-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-shop-fg">Dodací / fakturační adresa</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="p-street">Ulice a číslo popisné</Label>
            <input id="p-street" name="street" defaultValue={profile.street} placeholder="Branická 75/123" className={INPUT_CLS} />
          </div>
          <div>
            <Label htmlFor="p-city">Město</Label>
            <input id="p-city" name="city" defaultValue={profile.city} placeholder="Praha" className={INPUT_CLS} />
          </div>
          <div>
            <Label htmlFor="p-postalCode">PSČ</Label>
            <input id="p-postalCode" name="postalCode" defaultValue={profile.postalCode} placeholder="140 00" className={INPUT_CLS} />
          </div>
        </div>
      </div>

      <div className="border-t border-stone-100 pt-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-shop-fg">
          <input
            type="checkbox" name="isBusiness" checked={isBusiness}
            onChange={(e) => setIsBusiness(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 accent-[#C9A961]"
          />
          Nakupuji na firmu
        </label>
        {isBusiness && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-companyName">Název firmy</Label>
              <input id="p-companyName" name="companyName" defaultValue={profile.companyName} className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="p-companyId">IČO</Label>
              <input id="p-companyId" name="companyId" defaultValue={profile.companyId} placeholder="12345678" className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="p-vatId">DIČ (nepovinné)</Label>
              <input id="p-vatId" name="vatId" defaultValue={profile.vatId} placeholder="CZ12345678" className={INPUT_CLS} />
            </div>
          </div>
        )}
      </div>

      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Ukládám…' : 'Uložit změny'}
      </button>
    </form>
  )
}

// ─── Změna hesla ───────────────────────────────────────────────────

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, null)

  return (
    <form action={formAction} className="space-y-4">
      <StateBox state={state} />
      <div>
        <Label htmlFor="pw-old">Současné heslo</Label>
        <input id="pw-old" name="oldPassword" type="password" autoComplete="current-password" required className={INPUT_CLS} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pw-new">Nové heslo (min. 8 znaků)</Label>
          <input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={8} required className={INPUT_CLS} />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Nové heslo znovu</Label>
          <input id="pw-confirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required className={INPUT_CLS} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={BUTTON_CLS}>
        {pending ? 'Měním…' : 'Změnit heslo'}
      </button>
    </form>
  )
}

// ─── Odhlášení ─────────────────────────────────────────────────────

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-shop-muted transition hover:border-red-300 hover:text-red-600"
      >
        Odhlásit se
      </button>
    </form>
  )
}
