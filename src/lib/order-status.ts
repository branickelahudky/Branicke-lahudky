import { OrderStatus, AdminRole } from '@prisma/client'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Čeká na zpracování',
  CONFIRMED: 'Potvrzeno',
  PROCESSING: 'Zpracovává se',
  READY: 'Připraveno',
  SHIPPED: 'Odesláno',
  DELIVERED: 'Doručeno',
  CANCELLED: 'Stornováno',
  REFUNDED: 'Vráceno',
}

// Lineární pořadí stavů; CANCELLED a REFUNDED jsou mimo (terminální větev)
export const STATUS_ORDER: Partial<Record<OrderStatus, number>> = {
  PENDING: 1,
  CONFIRMED: 2,
  PROCESSING: 3,
  READY: 4,
  SHIPPED: 5,
  DELIVERED: 6,
}

// Vrátí stavy, do kterých smí uživatel přejít z daného aktuálního stavu.
// Používá server (page.tsx) i klient (StatusDropdown props).
export function computeAllowedStatuses(
  currentStatus: OrderStatus,
  role: AdminRole,
): OrderStatus[] {
  const ALL: OrderStatus[] = [
    'PENDING', 'CONFIRMED', 'PROCESSING', 'READY',
    'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
  ]

  if (role === 'STAFF') {
    // Jen přesně tyto dva přechody vpřed
    const STAFF_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
      PENDING: 'PROCESSING',
      PROCESSING: 'READY',
    }
    const next = STAFF_NEXT[currentStatus]
    return next ? [next] : []
  }

  // OWNER/ADMIN: vše kromě CANCELLED/REFUNDED z DELIVERED
  if (currentStatus === 'DELIVERED') {
    return ALL.filter((s) => s !== 'CANCELLED' && s !== 'REFUNDED')
  }

  return ALL.filter((s) => s !== currentStatus)
}
