export type CustomerRating = 'good' | 'neutral' | 'bad'

export function computeCustomerRating(statuses: string[]): CustomerRating | null {
  const total = statuses.length
  if (total === 0) return null

  const cancelled = statuses.filter((s) => s === 'CANCELLED' || s === 'REFUNDED').length
  const fulfilled = statuses.filter((s) => s === 'SHIPPED' || s === 'DELIVERED').length

  // 😟 50%+ storno z aspoň 3 objednávek
  if (total >= 3 && cancelled / total >= 0.5) return 'bad'

  // 😊 5+ vyřízených, 0 storno
  if (fulfilled >= 5 && cancelled === 0) return 'good'

  return 'neutral'
}

export function ratingEmoji(rating: CustomerRating): string {
  switch (rating) {
    case 'good': return '😊'
    case 'bad': return '😟'
    default: return '😐'
  }
}

export function ratingColorClass(rating: CustomerRating): string {
  switch (rating) {
    case 'good': return 'text-green-600'
    case 'bad': return 'text-orange-500'
    default: return 'text-stone-400'
  }
}
