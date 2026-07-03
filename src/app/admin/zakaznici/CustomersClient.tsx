'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { computeCustomerRating, ratingEmoji, ratingColorClass } from '@/lib/customer-rating'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedCustomer = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  shoptetId: string | null
  isBusinessCustomer: boolean
  companyName: string | null
  companyId: string | null
  internalNote: string | null
  createdAt: string
  orderStatuses: string[]
  orderCount: number
  totalSpent: number
  addressCity: string | null
  hasAccount: boolean
  emailVerified: boolean
  accountDisabled: boolean
  lastSessionAt: string | null
}

interface Props {
  customers: SerializedCustomer[]
  total: number
  totalPages: number
  currentPage: number
  sort: string
  dir: 'asc' | 'desc'
  currentSearch: string
  accountFilter: string
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' }).format(new Date(iso))
}

function fmtCZK(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Komponenta ────────────────────────────────────────────────────

export function CustomersClient({
  customers,
  total,
  totalPages,
  currentPage,
  sort,
  dir,
  currentSearch,
  accountFilter,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [search, setSearch] = useState(currentSearch)

  useEffect(() => {
    setSearch(currentSearch)
  }, [currentSearch])

  // Debounce 300 ms → update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === currentSearch) return
      const params = new URLSearchParams(searchParams.toString())
      if (search) params.set('hledat', search)
      else params.delete('hledat')
      params.delete('strana')
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    return `${pathname}?${params.toString()}`
  }

  function sortHref(column: string) {
    const newDir = sort === column && dir === 'asc' ? 'desc' : 'asc'
    return buildUrl({ sort: column, order: newDir, strana: null })
  }

  function pageHref(n: number) {
    return buildUrl({ strana: String(n) })
  }

  function SortArrow({ column }: { column: string }) {
    if (sort !== column) return <span className="ml-0.5 text-stone-300">↕</span>
    return <span className="ml-0.5 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <main className="flex-1 p-6">
      <div className="rounded-lg border border-stone-200 bg-white">

        {/* Lišta */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <p className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">{total}</span>{' '}
              {total === 1 ? 'zákazník' : total < 5 ? 'zákazníci' : 'zákazníků'}
            </p>
            {/* Filtr podle účtu */}
            <div className="flex rounded-lg border border-stone-200 p-0.5 text-sm">
              {[
                { key: 'vsichni', label: 'Všichni', href: buildUrl({ ucet: null, strana: null }) },
                { key: 's-uctem', label: 'S účtem', href: buildUrl({ ucet: 's-uctem', strana: null }) },
                { key: 'bez-uctu', label: 'Bez účtu', href: buildUrl({ ucet: 'bez-uctu', strana: null }) },
              ].map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className={`rounded-md px-3 py-1 transition ${
                    accountFilter === t.key
                      ? 'bg-stone-800 font-medium text-white'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat jméno, e-mail nebo město…"
            className="w-72 rounded border border-stone-300 px-3 py-1.5 text-sm placeholder-stone-400 focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Tabulka */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="p-3">
                  <Link href={sortHref('lastName')} className="flex items-center hover:text-stone-700">
                    Zákazník <SortArrow column="lastName" />
                  </Link>
                </th>
                <th className="p-3">
                  <Link href={sortHref('email')} className="flex items-center hover:text-stone-700">
                    E-mail <SortArrow column="email" />
                  </Link>
                </th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Účet</th>
                <th className="p-3">Město</th>
                <th className="p-3 text-right">
                  <Link href={sortHref('orderCount')} className="flex items-center justify-end hover:text-stone-700">
                    Objednávky <SortArrow column="orderCount" />
                  </Link>
                </th>
                <th className="p-3 text-right">
                  <Link href={sortHref('totalSpent')} className="flex items-center justify-end hover:text-stone-700">
                    Celkem utratil <SortArrow column="totalSpent" />
                  </Link>
                </th>
                <th className="p-3">Rating</th>
                <th className="p-3">
                  <Link href={sortHref('createdAt')} className="flex items-center hover:text-stone-700">
                    Registrace <SortArrow column="createdAt" />
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-stone-400">
                    Žádní zákazníci nenalezeni.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const rating = computeCustomerRating(c.orderStatuses)
                const fullName = `${c.firstName} ${c.lastName}`.trim()

                return (
                  <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                    {/* Zákazník */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/admin/zakaznici/${c.id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {fullName || '(bez jména)'}
                            </Link>
                            {c.isBusinessCustomer && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
                                B2B
                              </span>
                            )}
                            {c.internalNote && (
                              <span
                                title={c.internalNote}
                                className="inline-flex h-4 w-4 items-center justify-center rounded bg-orange-100 text-[10px] font-bold text-orange-600"
                              >
                                P
                              </span>
                            )}
                          </div>
                          {c.companyName && (
                            <p className="text-xs text-stone-400">{c.companyName}</p>
                          )}
                          {c.shoptetId && (
                            <p className="font-mono text-xs text-stone-300">#{c.shoptetId}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* E-mail */}
                    <td className="p-3 text-stone-600">{c.email}</td>

                    {/* Telefon */}
                    <td className="p-3 text-stone-500">
                      {c.phone ?? <span className="text-stone-300">—</span>}
                    </td>

                    {/* Účet */}
                    <td className="p-3">
                      {c.hasAccount ? (
                        <div>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                              c.accountDisabled
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.accountDisabled ? 'Deaktivován' : 'Má účet'}
                          </span>
                          <p className="mt-0.5 text-xs text-stone-400">
                            <span title={c.emailVerified ? 'E-mail ověřen' : 'E-mail neověřen'}>
                              {c.emailVerified ? '✓ ověřen' : '— neověřen'}
                            </span>
                            {c.lastSessionAt && (
                              <span title="Poslední přihlášení"> · {fmtDate(c.lastSessionAt)}</span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                          Bez účtu
                        </span>
                      )}
                    </td>

                    {/* Město */}
                    <td className="p-3 text-stone-500">
                      {c.addressCity ?? <span className="text-stone-300">—</span>}
                    </td>

                    {/* Objednávky */}
                    <td className="p-3 text-right">
                      {c.orderCount > 0 ? (
                        <span className="font-medium text-stone-800">{c.orderCount}</span>
                      ) : (
                        <span className="text-stone-300">0</span>
                      )}
                    </td>

                    {/* Celkem utratil */}
                    <td className="p-3 text-right font-medium text-stone-800">
                      {c.totalSpent > 0 ? fmtCZK(c.totalSpent) : <span className="font-normal text-stone-300">—</span>}
                    </td>

                    {/* Rating */}
                    <td className="p-3">
                      {rating ? (
                        <span
                          title={
                            rating === 'good' ? 'Dobrý zákazník (5+ vyřízených)' :
                            rating === 'bad' ? 'Rizikový zákazník (50%+ storno)' :
                            'Průměrný zákazník'
                          }
                          className={`text-base ${ratingColorClass(rating)}`}
                        >
                          {ratingEmoji(rating)}
                        </span>
                      ) : (
                        <span className="text-stone-200">—</span>
                      )}
                    </td>

                    {/* Registrace */}
                    <td className="p-3 text-xs text-stone-400">{fmtDate(c.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Stránkování */}
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-500">
          <span>
            Strana {currentPage} z {totalPages},{' '}
            <span className="font-medium text-stone-700">{total}</span> zákazníků celkem
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={pageHref(currentPage - 1)} className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50">
                ← Předchozí
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={pageHref(currentPage + 1)} className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50">
                Další →
              </Link>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
