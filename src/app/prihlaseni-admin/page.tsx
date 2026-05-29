import Link from 'next/link'
import { loginAction } from './actions'

interface Props {
  searchParams: Promise<{ chyba?: string }>
}

export default async function PrihlaseniAdmin({ searchParams }: Props) {
  const params = await searchParams
  const hasError = params.chyba === '1'

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-red">Branické lahůdkářství</h1>
          <p className="mt-1 text-sm text-stone-500">Administrace</p>
        </div>

        {/* Karta */}
        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-stone-800">Přihlásit se</h2>

          {hasError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Nesprávný e-mail nebo heslo.
            </div>
          )}

          <form action={loginAction} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-stone-700"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-stone-700"
              >
                Heslo
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Přihlásit
            </button>

            <div className="text-center">
              <Link href="/zapomenute-heslo" className="text-xs text-stone-400 hover:text-stone-600 hover:underline">
                Zapomněli jste heslo?
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Branické lahůdkářství &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
