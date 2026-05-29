'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AdminRole } from '@prisma/client'
import {
  inviteAdminAction,
  cancelInvitationAction,
  resendInvitationAction,
  suspendAdminAction,
  reactivateAdminAction,
  resetPasswordRequestAction,
} from './actions'

const ROLE_LABELS: Record<AdminRole, string> = { OWNER: 'Majitel', ADMIN: 'Administrátor', STAFF: 'Obsluha' }
const ROLE_BADGE: Record<AdminRole, string> = {
  OWNER: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  STAFF: 'bg-stone-100 text-stone-600',
}
const ROLE_DESC: Record<AdminRole, string> = {
  OWNER: 'Plný přístup včetně financí, nastavení a správy správců.',
  ADMIN: 'Přístup ke všemu kromě produktů a systémového nastavení.',
  STAFF: 'Pouze aktivní objednávky a sklad.',
}

type ActiveUser = { id: string; email: string; firstName: string; lastName: string; role: AdminRole; lastLoginAt: Date | null; createdAt: Date }
type SuspendedUser = { id: string; email: string; firstName: string; lastName: string; role: AdminRole; lastLoginAt: Date | null; createdAt: Date }
type PendingInvitation = { id: string; email: string; role: AdminRole; invitedAt: Date; expiresAt: Date; invitedBy: { firstName: string; lastName: string; email: string } }

interface Props {
  currentUserId: string
  currentUserRole: AdminRole
  activeUsers: ActiveUser[]
  suspendedUsers: SuspendedUser[]
  pendingInvitations: PendingInvitation[]
}

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))
}

export function SpravciClient({ currentUserId, currentUserRole, activeUsers, suspendedUsers, pendingInvitations }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'active' | 'invited' | 'suspended'>('active')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  function refresh() { startTransition(() => { router.refresh() }) }

  async function handleSuspend(userId: string, name: string) {
    if (!confirm(`Opravdu chcete zablokovat správce ${name}?`)) return
    try {
      await suspendAdminAction(userId)
      toast.success(`${name} byl zablokován.`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  async function handleReactivate(userId: string, name: string) {
    try {
      await reactivateAdminAction(userId)
      toast.success(`${name} byl aktivován.`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  async function handleResetPassword(userId: string) {
    try {
      await resetPasswordRequestAction(userId)
      toast.success('Email s odkazem pro reset hesla byl odeslán.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  async function handleCancelInvitation(id: string, email: string) {
    if (!confirm(`Zrušit pozvánku pro ${email}?`)) return
    try {
      await cancelInvitationAction(id)
      toast.success('Pozvánka zrušena.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  async function handleResend(id: string) {
    try {
      await resendInvitationAction(id)
      toast.success('Pozvánka znovu odeslána.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  const canManage = currentUserRole === 'OWNER'

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-700">Správci</h2>
          {(currentUserRole === 'OWNER' || currentUserRole === 'ADMIN') && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Pozvat správce
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-6 py-6">

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-stone-200">
          {([
            ['active', `Aktivní (${activeUsers.length})`],
            ['invited', `Pozvánky čekají (${pendingInvitations.length})`],
            ['suspended', `Zablokovaní (${suspendedUsers.length})`],
          ] as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Aktivní */}
        {tab === 'active' && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Jméno</th>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  <th className="px-4 py-2.5 text-left">Role</th>
                  <th className="px-4 py-2.5 text-left">Poslední přihlášení</th>
                  <th className="px-4 py-2.5 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map(u => (
                  <tr key={u.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/nastaveni/spravci/${u.id}`} className="font-medium text-stone-900 hover:text-blue-600 hover:underline">
                        {u.firstName} {u.lastName}
                        {u.id === currentUserId && <span className="ml-1.5 text-xs text-stone-400">(vy)</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-stone-500">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/nastaveni/spravci/${u.id}`} className="text-xs text-blue-600 hover:underline">Upravit</Link>
                        {canManage && u.id !== currentUserId && (
                          <>
                            <button onClick={() => handleResetPassword(u.id)} className="text-xs text-stone-500 hover:text-stone-700">Reset hesla</button>
                            <button onClick={() => handleSuspend(u.id, `${u.firstName} ${u.lastName}`)} className="text-xs text-red-500 hover:text-red-700">Zablokovat</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pozvánky */}
        {tab === 'invited' && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-x-auto">
            {pendingInvitations.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-stone-400">Žádné čekající pozvánky.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Email</th>
                    <th className="px-4 py-2.5 text-left">Role</th>
                    <th className="px-4 py-2.5 text-left">Pozval</th>
                    <th className="px-4 py-2.5 text-left">Odesláno</th>
                    <th className="px-4 py-2.5 text-left">Platí do</th>
                    <th className="px-4 py-2.5 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvitations.map(inv => (
                    <tr key={inv.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 font-medium text-stone-900">{inv.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[inv.role]}`}>{ROLE_LABELS[inv.role]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">{inv.invitedBy.firstName} {inv.invitedBy.lastName}</td>
                      <td className="px-4 py-2.5 text-stone-500">{fmtDate(inv.invitedAt)}</td>
                      <td className="px-4 py-2.5 text-stone-500">{fmtDate(inv.expiresAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleResend(inv.id)} className="text-xs text-blue-600 hover:underline">Znovu odeslat</button>
                          <button onClick={() => handleCancelInvitation(inv.id, inv.email)} className="text-xs text-red-500 hover:text-red-700">Zrušit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Zablokovaní */}
        {tab === 'suspended' && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-x-auto">
            {suspendedUsers.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-stone-400">Žádní zablokovaní správci.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Jméno</th>
                    <th className="px-4 py-2.5 text-left">Email</th>
                    <th className="px-4 py-2.5 text-left">Role</th>
                    <th className="px-4 py-2.5 text-left">Poslední přihlášení</th>
                    {canManage && <th className="px-4 py-2.5 text-right">Akce</th>}
                  </tr>
                </thead>
                <tbody>
                  {suspendedUsers.map(u => (
                    <tr key={u.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 text-stone-400">{u.firstName} {u.lastName}</td>
                      <td className="px-4 py-2.5 text-stone-400">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium opacity-60 ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-400">{fmtDate(u.lastLoginAt)}</td>
                      {canManage && (
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => handleReactivate(u.id, `${u.firstName} ${u.lastName}`)} className="text-xs text-green-600 hover:underline">Aktivovat</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteModal
          currentUserRole={currentUserRole}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => { setShowInviteModal(false); refresh() }}
        />
      )}
    </div>
  )
}

function InviteModal({ currentUserRole, onClose, onSuccess }: { currentUserRole: AdminRole; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('STAFF')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const availableRoles: AdminRole[] = currentUserRole === 'OWNER' ? ['OWNER', 'ADMIN', 'STAFF'] : ['ADMIN', 'STAFF']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Zadejte email.'); return }
    setSaving(true)
    setError('')
    try {
      await inviteAdminAction(email.trim(), role)
      toast.success(`Pozvánka odeslána na ${email}.`)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-semibold text-stone-900">Pozvat správce</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="novy@lahudkybranik.cz"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Role</label>
            <div className="space-y-2">
              {availableRoles.map(r => (
                <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${role === r ? 'border-blue-500 bg-blue-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-stone-900">{ROLE_LABELS[r]}</p>
                    <p className="text-xs text-stone-500">{ROLE_DESC[r]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Zrušit</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
              {saving ? 'Odesílám…' : 'Pozvat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
