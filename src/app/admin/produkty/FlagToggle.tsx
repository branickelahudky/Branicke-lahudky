'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { toggleProductFlag } from './actions'

type ProductFlag = 'isNew' | 'isFeatured' | 'isOnSale' | 'isActive'

interface Props {
  productId: string
  flag: ProductFlag
  value: boolean
  label: string
}

export function FlagToggle({ productId, flag, value, label }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      try {
        await toggleProductFlag(productId, flag)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={`${label}: ${value ? 'zapnuto — klik pro vypnutí' : 'vypnuto — klik pro zapnutí'}`}
      className={`text-sm transition-opacity ${isPending ? 'opacity-30' : 'opacity-100'}`}
    >
      {value ? (
        <span className="font-semibold text-green-600">✓</span>
      ) : (
        <span className="text-stone-300">✗</span>
      )}
    </button>
  )
}
