export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm rounded-xl border-2 border-dashed border-stone-200 bg-white px-8 py-10 text-center">
        <p className="mb-1 text-base font-semibold text-stone-700">{title}</p>
        <p className="mb-5 text-sm text-stone-400">{description}</p>
        <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
          Připravujeme
        </span>
      </div>
    </div>
  )
}
