'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { AdminRole } from '@prisma/client'
import {
  updateAdminUserAction,
  changeAdminRoleAction,
  suspendAdminAction,
  reactivateAdminAction,
  resetPasswordRequestAction,
} from '../actions'
import { AUDIT_LABELS } from '@/lib/admin-audit'

const ROLE_LABELS: Record<AdminRole, string> = { OWNER: 'Majitel', ADMIN: 'Administrátor', STAFF: 'Obsluha' }
const ROLE_BADGE: Record<AdminRole, string> = {
  OWNER: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  STAFF: 'bg-stone-100 text-stone-600',
}
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  INVITED: 'bg-stone-100 text-stone-500',
}
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktivní', SUSPENDED: 'Zablokován', INVITED: 'Čeká na aktivaci' }

const ROLE_PERMISSIONS: Record<AdminRole, { label: string; allowed: boolean }[]> = {
  OWNER: [
    { label: 'Spravovat objednávky', allowed: true },
    { label: 'Vystavovat faktury', allowed: true },
    { label: 'Spravovat produkty', allowed: true },
    { label: 'Správa zákazníků', allowed: true },
    { label: 'Statistiky a finance', allowed: true },
    { label: 'Systémové nastavení', allowed: true },
    { label: 'Správa správců', allowed: true },
  ],
  ADMIN: [
    { label: 'Spravovat objednávky', allowed: true },
    { label: 'Vystavovat faktury', allowed: true },
    { label: 'Spravovat produkty', allowed: false },
    { label: 'Správa zákazníků', allowed: true },
    { label: 'Statistiky a finance', allowed: true },
    { label: 'Systémové nastavení', allowed: false },
    { label: 'Správa správců', allowed: false },
  ],
  STAFF: [
    { label: 'Spravovat objednávky', allowed: true },
    { label: 'Vystavovat faktury', allowed: false },
    { label: 'Spravovat produkty', allowed: false },
    { label: 'Správa zákazníků', allowed: false },
    { label: 'Statistiky a finance', allowed: false },
    { label: 'Systémové nastavení', allowed: false },
    { label: 'Správa správců', allowed: false },
  ],
}

type AdminUserDetail = {
  id: string; email: string; firstName: string; lastName: string
  role: AdminRole; status: string; isActive: boolean
  lastLoginAt: Date | null; lastLoginIp: string | null
  createdAt: Date; invitedAt: Date | null
}
type AuditLog = { id: string; action: string; createdAt: Date; ipAddress: string | null; metadata: unknown }

interface Props {
  currentUserId: string
  currentUserRole: AdminRole
  adminUser: AdminUserDetail
  auditLogs: AuditLog[]
}

function fmtDate(d: Date | null | string) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))
}

export function SpravceDetailClient({ currentUserId, currentUserRole, adminUser, auditLogs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ firstName: adminUser.firstName, lastName: adminUser.lastName, email: adminUser.email })
  const [saving, setSaving] = useState(false)
  const [roleChanging, setRoleChanging] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AdminRole>(adminUser.role)

  const isOwner = currentUserRole === 'OWNER'
  const isSelf = currentUserId === adminUser.id

  function refresh() { startTransition(() => { router.refresh() }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateAdminUserAction(adminUser.id, form)
      toast.success('Údaje uloženy.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleChange() {
    if (selectedRole === adminUser.role) return
    if (!confirm(`Opravdu změnit roli na ${ROLE_LABELS[selectedRole]}?`)) return
    setRoleChanging(true)
    try {
      await changeAdminRoleAction(adminUser.id, selectedRole)
      toast.success('Role změněna.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setRoleChanging(false)
    }
  }

  async function handleSuspend() {
    if (!confirm(`Opravdu chcete zablokovat tohoto správce?`)) return
    try {
      await suspendAdminAction(adminUser.id)
      toast.success('Správce zablokován.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  async function handleReactivate() {
    try {
      await reactivateAdminAction(adminUser.id)
      toast.success('Správce aktivován.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  async function handleResetPwd() {
    try {
      await resetPasswordRequestAction(adminUser.id)
      toast.success('Email s odkazem pro reset hesla byl odeslán.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/nastaveni/spravci" className="text-stone-500 hover:text-stone-700">Správci</Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-800">{adminUser.firstName} {adminUser.lastName}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">

        {/* Hlavička */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                {adminUser.firstName[0]}{adminUser.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-900">{adminUser.firstName} {adminUser.lastName}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[adminUser.role]}`}>{ROLE_LABELS[adminUser.role]}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[adminUser.status] ?? 'bg-stone-100 text-stone-600'}`}>{STATUS_LABELS[adminUser.status] ?? adminUser.status}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner && !isSelf && (
                <>
                  <button onClick={handleResetPwd} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">Resetovat heslo</button>
                  {adminUser.status === 'ACTIVE'
                    ? <button onClick={handleSuspend} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Zablokovat</button>
                    : <button onClick={handleReactivate} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs text-green-600 hover:bg-green-50">Aktivovat</button>
                  }
                </>
              )}
            </div>
          </div>
        </div>

        {/* Základní údaje */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Základní údaje</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Jméno</label>
                <input
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  disabled={!isOwner && !isSelf}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Příjmení</label>
                <input
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  disabled={!isOwner && !isSelf}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!isOwner && !isSelf}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
              />
            </div>
            {(isOwner || isSelf) && (
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            )}
          </form>
        </div>

        {/* Role */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Role a oprávnění</h2>
          {isOwner && !isSelf ? (
            <div className="flex items-center gap-3 mb-4">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as AdminRole)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {(['OWNER', 'ADMIN', 'STAFF'] as AdminRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {selectedRole !== adminUser.role && (
                <button onClick={handleRoleChange} disabled={roleChanging} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40">
                  {roleChanging ? 'Měním…' : 'Potvrdit změnu'}
                </button>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <span className={`rounded px-2 py-0.5 text-sm font-medium ${ROLE_BADGE[adminUser.role]}`}>{ROLE_LABELS[adminUser.role]}</span>
            </div>
          )}
          <div className="space-y-1.5">
            {ROLE_PERMISSIONS[adminUser.role].map(p => (
              <div key={p.label} className="flex items-center gap-2 text-sm">
                <span className={p.allowed ? 'text-green-600' : 'text-stone-300'}>
                  {p.allowed ? '✓' : '✗'}
                </span>
                <span className={p.allowed ? 'text-stone-700' : 'text-stone-400'}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Přístupové info */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Přístup</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-4">
              <dt className="w-40 text-stone-500">Poslední přihlášení</dt>
              <dd className="text-stone-900">{fmtDate(adminUser.lastLoginAt)} {adminUser.lastLoginIp ? `(${adminUser.lastLoginIp})` : ''}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-40 text-stone-500">Účet vytvořen</dt>
              <dd className="text-stone-900">{fmtDate(adminUser.createdAt)}</dd>
            </div>
            {adminUser.invitedAt && (
              <div className="flex gap-4">
                <dt className="w-40 text-stone-500">Pozván</dt>
                <dd className="text-stone-900">{fmtDate(adminUser.invitedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Audit log */}
        {auditLogs.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-stone-700">Audit log (posledních 50)</h2>
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
    </div>
  )
}
