'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { AdminRole } from '@prisma/client'
import { updateAdminUserAction } from '@/app/admin/nastaveni/spravci/actions'
import { AUDIT_LABELS } from '@/lib/admin-audit'

const ROLE_LABELS: Record<AdminRole, string> = { OWNER: 'Majitel', ADMIN: 'Administrátor', STAFF: 'Obsluha' }
const ROLE_BADGE: Record<AdminRole, string> = {
  OWNER: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  STAFF: 'bg-stone-100 text-stone-600',
}

type UserData = {
  id: string; email: string; firstName: string; lastName: string; role: AdminRole
  lastLoginAt: Date | null; lastLoginIp: string | null; createdAt: Date
}
type AuditLog = { id: string; action: string; createdAt: Date; ipAddress: string | null }

function fmtDate(d: Date | null | string) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))
}

export function ProfilClient({ user, auditLogs }: { user: UserData; auditLogs: AuditLog[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, email: user.email })
  const [saving, setSaving] = useState(false)

  function refresh() { startTransition(() => { router.refresh() }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateAdminUserAction(user.id, form)
      toast.success('Profil uložen.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">

      {/* Hlavička */}
      <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900">{user.firstName} {user.lastName}</h1>
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.role]}`}>{ROLE_LABELS[user.role]}</span>
        </div>
      </div>

      {/* Základní údaje */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Základní údaje</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Jméno</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Příjmení</label>
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </form>
      </div>

      {/* Bezpečnostní info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        Pro změnu hesla, správu relací a další bezpečnostní nastavení přejděte do{' '}
        <Link href="/admin/nastaveni/zabezpeceni" className="font-semibold underline hover:text-blue-900">
          Nastavení → Zabezpečení
        </Link>
        .
      </div>

      {/* Přístup */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Přístup</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-4"><dt className="w-44 text-stone-500">Poslední přihlášení</dt><dd className="text-stone-900">{fmtDate(user.lastLoginAt)} {user.lastLoginIp ? `(${user.lastLoginIp})` : ''}</dd></div>
          <div className="flex gap-4"><dt className="w-44 text-stone-500">Účet vytvořen</dt><dd className="text-stone-900">{fmtDate(user.createdAt)}</dd></div>
        </dl>
      </div>

      {/* Audit log */}
      {auditLogs.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-stone-700">Posledních 30 aktivit</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Akce</th>
                  <th className="px-4 py-2.5 text-left">Datum</th>
                  <th className="px-4 py-2.5 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-stone-700">{AUDIT_LABELS[log.action] ?? log.action}</td>
                    <td className="px-4 py-2.5 text-stone-500">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-2.5 text-stone-400">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
