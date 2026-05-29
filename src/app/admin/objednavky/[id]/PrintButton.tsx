'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
    >
      Tisk
    </button>
  )
}
