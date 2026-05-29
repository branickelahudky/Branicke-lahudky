'use client'

import { useTransition } from 'react'
import { cancelOrder } from './actions'

interface Props {
  orderId: string
  orderNumber: string
  canCancel: boolean
}

export function ActionPanel({ orderId, orderNumber, canCancel }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    const ok = window.confirm(
      `Opravdu stornovat objednávku ${orderNumber}?\n\nAkce bude zaznamenána do historie.`,
    )
    if (!ok) return
    startTransition(async () => {
      try {
        await cancelOrder(orderId)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Chyba při stornování.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <h3 className="font-semibold text-stone-800">Akce</h3>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {canCancel ? (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="w-full rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            {isPending ? 'Probíhá...' : 'Stornovat objednávku'}
          </button>
        ) : (
          <p className="rounded bg-stone-50 px-3 py-2 text-center text-xs text-stone-400">
            Stornování není dostupné
          </p>
        )}

        <button
          disabled
          title="Brzy k dispozici"
          className="w-full cursor-not-allowed rounded border border-stone-200 px-4 py-2 text-sm text-stone-400"
        >
          Vystavit fakturu{' '}
          <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">brzy</span>
        </button>

        <button
          onClick={() => window.print()}
          className="w-full rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
        >
          Tisk dodacího listu
        </button>
      </div>
    </div>
  )
}
