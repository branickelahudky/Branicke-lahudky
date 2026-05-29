interface Props {
  title: string
  user: { firstName: string; lastName: string }
}

export function AdminHeader({ title, user }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-stone-800">{title}</h1>
      <div className="flex items-center gap-4 text-sm text-stone-600">
        <span>
          Přihlášen:{' '}
          <span className="font-medium text-stone-900">
            {user.firstName} {user.lastName}
          </span>
        </span>
        <form action="/odhlasit-admin" method="post">
          <button
            type="submit"
            className="rounded border border-stone-300 px-3 py-1 text-sm text-stone-600 transition hover:bg-stone-100"
          >
            Odhlásit
          </button>
        </form>
      </div>
    </header>
  )
}
