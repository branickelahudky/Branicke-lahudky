import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { createPage, togglePublished } from './actions'

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

export default async function StrankyPage() {
  const { user } = await requireAuth()

  const pages = await prisma.page.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, title: true, slug: true, isPublished: true,
      isSystem: true, updatedAt: true,
    },
  })

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/stranky" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Stránky" user={user} />

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              Statické stránky webu — obchodní podmínky, GDPR, kontakt, o nás…
            </p>
            <form action={createPage}>
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Nová stránka
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Název</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Slug</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Stav</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Upraveno</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/vzhled/stranky/${page.id}`}
                        className="font-medium text-stone-800 hover:text-blue-600 hover:underline">
                        {page.title}
                      </Link>
                      {page.isSystem && (
                        <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">systémová</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">/{page.slug}</td>
                    <td className="px-4 py-3">
                      <form action={togglePublished.bind(null, page.id)}>
                        <button type="submit"
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            page.isPublished
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}>
                          {page.isPublished ? '● Publikováno' : '○ Skryto'}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">{fmtDate(page.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/vzhled/stranky/${page.id}`}
                        className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:bg-stone-50">
                        Editovat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pages.length === 0 && (
              <div className="py-16 text-center text-sm text-stone-400">
                Zatím žádné stránky
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
