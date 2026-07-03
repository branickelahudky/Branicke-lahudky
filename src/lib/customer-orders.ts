import { Prisma } from '@prisma/client'

/**
 * Podmínka „vlastní objednávky zákazníka": podle customerId + (u ověřeného
 * e-mailu) i starší host objednávky na stejný e-mail. E-mail se ověřuje
 * odkazem při nastavení/obnově hesla — bez ověření cizí host objednávky
 * nezpřístupňujeme (e-mail v registraci může zadat kdokoli).
 */
export function ownOrdersWhere(customer: {
  id: string
  email: string
  emailVerified: Date | null
}): Prisma.OrderWhereInput {
  const conditions: Prisma.OrderWhereInput[] = [{ customerId: customer.id }]
  if (customer.emailVerified) {
    conditions.push({
      customerId: null,
      contactEmail: { equals: customer.email, mode: 'insensitive' },
    })
  }
  return { OR: conditions }
}
