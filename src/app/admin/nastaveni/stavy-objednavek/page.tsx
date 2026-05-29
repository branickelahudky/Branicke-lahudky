import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { StavyClient, type SerializedStatusConfig } from './StavyClient'

type SeedEntry = {
  status: OrderStatus
  label: string
  color: string
  sortOrder: number
  sendEmail: boolean
  emailSubject?: string
  emailHeading?: string
  emailBody?: string
  generateInvoice?: boolean
  attachInvoice?: boolean
}

const SEED: SeedEntry[] = [
  {
    status: 'PENDING',
    label: 'Čeká na zpracování',
    color: '#f59e0b',
    sortOrder: 1,
    sendEmail: false,
  },
  {
    status: 'CONFIRMED',
    label: 'Potvrzeno',
    color: '#3b82f6',
    sortOrder: 2,
    sendEmail: true,
    emailSubject: 'Vaše objednávka {cislo} byla potvrzena',
    emailHeading: 'Děkujeme za objednávku!',
    emailBody:
      'Dobrý den {jmeno}, vaši objednávku {cislo} jsme přijali a potvrzujeme. Brzy ji začneme připravovat.',
  },
  {
    status: 'PROCESSING',
    label: 'Zpracovává se',
    color: '#8b5cf6',
    sortOrder: 3,
    sendEmail: true,
    emailSubject: 'Připravujeme vaši objednávku {cislo}',
    emailHeading: 'Pracujeme na tom',
    emailBody: 'Dobrý den {jmeno}, vaši objednávku {cislo} právě připravujeme.',
  },
  {
    status: 'READY',
    label: 'Připraveno',
    color: '#10b981',
    sortOrder: 4,
    sendEmail: true,
    generateInvoice: true,
    attachInvoice: true,
    emailSubject: 'Objednávka {cislo} je připravena',
    emailHeading: 'Vaše objednávka je připravena',
    emailBody:
      'Dobrý den {jmeno}, vaše objednávka {cislo} je připravena. V příloze najdete fakturu. Čekáme na převzetí dopravcem / můžete si ji vyzvednout.',
  },
  {
    status: 'SHIPPED',
    label: 'Odesláno',
    color: '#06b6d4',
    sortOrder: 5,
    sendEmail: true,
    emailSubject: 'Objednávka {cislo} byla odeslána',
    emailHeading: 'Zboží je na cestě',
    emailBody:
      'Dobrý den {jmeno}, vaše objednávka {cislo} byla předána dopravci. {sledovani}',
  },
  {
    status: 'DELIVERED',
    label: 'Doručeno',
    color: '#22c55e',
    sortOrder: 6,
    sendEmail: true,
    emailSubject: 'Objednávka {cislo} byla doručena',
    emailHeading: 'Dobrou chuť!',
    emailBody:
      'Dobrý den {jmeno}, vaše objednávka {cislo} byla doručena. Děkujeme za nákup a přejeme dobrou chuť!',
  },
  {
    status: 'CANCELLED',
    label: 'Stornováno',
    color: '#ef4444',
    sortOrder: 7,
    sendEmail: true,
    emailSubject: 'Objednávka {cislo} byla stornována',
    emailHeading: 'Storno objednávky',
    emailBody:
      'Dobrý den {jmeno}, vaše objednávka {cislo} byla stornována. V případě dotazů nás kontaktujte.',
  },
  {
    status: 'REFUNDED',
    label: 'Vráceno',
    color: '#f97316',
    sortOrder: 8,
    sendEmail: true,
    emailSubject: 'Vrácení objednávky {cislo}',
    emailHeading: 'Vrácení zpracováno',
    emailBody:
      'Dobrý den {jmeno}, vrácení objednávky {cislo} bylo zpracováno.',
  },
]

async function seed() {
  await prisma.orderStatusConfig.createMany({
    data: SEED.map((s) => ({
      status: s.status,
      label: s.label,
      color: s.color,
      sortOrder: s.sortOrder,
      sendEmail: s.sendEmail ?? false,
      emailSubject: s.emailSubject ?? null,
      emailHeading: s.emailHeading ?? null,
      emailBody: s.emailBody ?? null,
      generateInvoice: s.generateInvoice ?? false,
      attachInvoice: s.attachInvoice ?? false,
      isActive: true,
    })),
    skipDuplicates: true,
  })
}

export default async function StavyObjednavekPage() {
  const count = await prisma.orderStatusConfig.count()
  if (count === 0) await seed()

  const raw = await prisma.orderStatusConfig.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  const configs: SerializedStatusConfig[] = raw.map((c) => ({
    status: c.status,
    label: c.label,
    color: c.color,
    sortOrder: c.sortOrder,
    sendEmail: c.sendEmail,
    emailSubject: c.emailSubject,
    emailHeading: c.emailHeading,
    emailBody: c.emailBody,
    generateInvoice: c.generateInvoice,
    attachInvoice: c.attachInvoice,
    isActive: c.isActive,
  }))

  return <StavyClient configs={configs} />
}
