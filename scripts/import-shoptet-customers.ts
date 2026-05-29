/**
 * Import zákazníků ze Shoptet XML exportu do Prisma DB.
 * Použití: npm run db:import-customers
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const XML_FILE = resolve(__dirname, '../data/shoptet-customers.xml')

// ── Helpers ───────────────────────────────────────────────────────

function toArr<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

/**
 * Rozdělení FULL_NAME na firstName + lastName.
 *
 * Formáty v datech:
 *   "Miroslav Šubrt"       → firstName="Miroslav", lastName="Šubrt"
 *   "Krutina Petr"         → heuristika níže
 *   "Gabriel MOLNAR"       → firstName="Gabriel", lastName="MOLNAR"
 *   "Anna Marie Nováková"  → firstName="Anna Marie", lastName="Nováková"
 *   "Zocher"               → firstName="", lastName="Zocher"
 *
 * Heuristika pro prohozené pořadí (příjmení první):
 *   Pokud první slovo je celé UPPERCASE a druhé ne → prohozené.
 *   Příklad: "MOLNAR Gabriel" → Molnar je příjmení. Ale "Gabriel MOLNAR"
 *   je opačně — druhé je UPPERCASE. V tomto případě necháváme tak jak je.
 *   "Krutina Petr" — obě slova capitalized, heuristika nedokáže rozlišit.
 *   Default: první slovo(a) = firstName, poslední = lastName.
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: '', lastName: parts[0] }

  // Detekce: první slovo UPPERCASE, druhé ne → příjmení první (prohozené)
  const firstWord = parts[0]
  const secondWord = parts[1]
  const firstIsAllCaps = firstWord === firstWord.toUpperCase() && firstWord.length > 1
  const secondIsNotAllCaps = secondWord !== secondWord.toUpperCase()
  if (firstIsAllCaps && secondIsNotAllCaps) {
    // Formát "NOVÁK Jan" → prohozené
    const lastName = parts[0]
    const firstName = parts.slice(1).join(' ')
    return { firstName, lastName }
  }

  // Default: všechna slova kromě posledního = firstName, poslední = lastName
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, parts.length - 1).join(' ')
  return { firstName, lastName }
}

// ── XML typy ─────────────────────────────────────────────────────

interface XmlAddress {
  FULL_NAME?: string
  COMPANY?: string
  STREET?: string
  HOUSE_NUMBER?: string
  CITY?: string
  ZIP?: string | number
  COUNTRY?: string
  COMPANY_ID?: string
  VAT_ID?: string
  GUID?: string
}

interface XmlAccount {
  EMAIL?: string
  PHONE?: string
  EMAIL_VERIFIED?: string | number
  IS_ADMIN?: string | number
  GUID?: string
}

interface XmlCustomer {
  '@_id': string | number
  CUSTOMER_GROUP?: string
  REGISTRATION_DATE?: string
  REMARK?: string
  BILLING_ADDRESS?: XmlAddress
  SHIPPING_ADDRESSES?: {
    SHIPPING_ADDRESS?: XmlAddress | XmlAddress[]
  }
  ACCOUNTS?: {
    ACCOUNT?: XmlAccount | XmlAccount[]
  }
}

// ── Parsování XML ─────────────────────────────────────────────────

function parseXml(): XmlCustomer[] {
  if (!existsSync(XML_FILE)) {
    console.error(`❌ Soubor nenalezen: ${XML_FILE}`)
    process.exit(1)
  }
  console.log(`📖 Čtu XML: ${XML_FILE}`)
  const xml = readFileSync(XML_FILE, 'utf-8')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    isArray: (name) => ['CUSTOMER', 'SHIPPING_ADDRESS', 'ACCOUNT'].includes(name),
  })

  const result = parser.parse(xml)
  const customers: XmlCustomer[] = result?.CUSTOMERS?.CUSTOMER ?? []
  console.log(`✅ Načteno ${customers.length} zákazníků z XML`)
  return customers
}

// ── Hlavní import ─────────────────────────────────────────────────

async function main() {
  const customers = parseXml()

  const ok = await confirm('\n⚠️  Opravdu smazat existující zákazníky a adresy? [y/N] ')
  if (!ok) {
    console.log('Přerušeno.')
    await prisma.$disconnect()
    return
  }

  // Wipe — nejdřív odkaz z objednávek, pak adresy + zákazníci
  console.log('\n🗑️  Mažu existující zákazníky...')
  await prisma.order.updateMany({ data: { customerId: null } })
  console.log('  ✔ Order.customerId → null')
  await prisma.address.deleteMany()
  console.log('  ✔ Address')
  await prisma.customer.deleteMany()
  console.log('  ✔ Customer')

  // Import
  console.log('\n👤 Importuji zákazníky...')

  let imported = 0
  let skipped = 0
  let b2cCount = 0
  let b2bCount = 0
  let addressCount = 0
  const seenEmails = new Set<string>()

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i]
    const shoptetId = str(c['@_id'])

    try {
      // E-mail z primárního accountu
      const accounts = toArr(c.ACCOUNTS?.ACCOUNT)
      const primaryAccount = accounts[0]
      const email = str(primaryAccount?.EMAIL).toLowerCase()

      if (!email) {
        console.warn(`  ⚠️  Zákazník id=${shoptetId} bez e-mailu — přeskočen`)
        skipped++
        continue
      }

      if (seenEmails.has(email)) {
        console.warn(`  ⚠️  Duplicitní e-mail ${email} (id=${shoptetId}) — přeskočen`)
        skipped++
        continue
      }
      seenEmails.add(email)

      const phone = str(primaryAccount?.PHONE) || null
      const emailVerified =
        str(primaryAccount?.EMAIL_VERIFIED) === '1' ? new Date() : null

      // Jméno z billing address
      const billing = c.BILLING_ADDRESS
      const fullName = str(billing?.FULL_NAME)
      const { firstName, lastName } = splitFullName(fullName)

      // B2B detekce
      const group = str(c.CUSTOMER_GROUP)
      const companyId = str(billing?.COMPANY_ID) || null
      const vatId = str(billing?.VAT_ID) || null
      const companyName = str(billing?.COMPANY) || null
      const isBusinessCustomer =
        group.includes('Velkoobchod') || !!companyId || false

      // Datum registrace
      let createdAt: Date
      try {
        const parsed = new Date(str(c.REGISTRATION_DATE))
        createdAt = isNaN(parsed.getTime()) ? new Date() : parsed
      } catch {
        createdAt = new Date()
      }

      const internalNote = str(c.REMARK) || null

      const label = fullName || email
      process.stdout.write(`  [${i + 1}/${customers.length}] ${label}\n`)

      // Vytvoř zákazníka
      const customer = await prisma.customer.create({
        data: {
          email,
          passwordHash: null,
          firstName,
          lastName,
          phone,
          shoptetId,
          internalNote,
          isBusinessCustomer,
          companyName,
          companyId,
          vatId,
          emailVerified,
          acceptsMarketing: false,
          createdAt,
        },
      })

      if (isBusinessCustomer) b2bCount++
      else b2cCount++

      // Billing address
      const billingStreet = str(billing?.STREET)
      const billingCity = str(billing?.CITY)

      if (billingStreet || billingCity) {
        const { firstName: bFn, lastName: bLn } = splitFullName(str(billing?.FULL_NAME))
        await prisma.address.create({
          data: {
            customerId: customer.id,
            type: 'BILLING',
            isDefault: true,
            firstName: bFn,
            lastName: bLn,
            company: companyName,
            street: billingStreet,
            city: billingCity,
            postalCode: str(billing?.ZIP),
            country: str(billing?.COUNTRY) || 'Česká republika',
            phone,
          },
        })
        addressCount++
      }

      // Shipping addresses
      const shippingAddrs = toArr(c.SHIPPING_ADDRESSES?.SHIPPING_ADDRESS)
      for (const sa of shippingAddrs) {
        const saStreet = str(sa.STREET)
        const saCity = str(sa.CITY)
        if (!saStreet && !saCity) continue

        const { firstName: sFn, lastName: sLn } = splitFullName(str(sa.FULL_NAME))
        await prisma.address.create({
          data: {
            customerId: customer.id,
            type: 'SHIPPING',
            isDefault: false,
            firstName: sFn,
            lastName: sLn,
            company: str(sa.COMPANY) || null,
            street: saStreet,
            city: saCity,
            postalCode: str(sa.ZIP),
            country: str(sa.COUNTRY) || 'Česká republika',
            phone: null,
          },
        })
        addressCount++
      }

      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ Zákazník id=${shoptetId} — chyba: ${msg}`)
      skipped++
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log('✅ Import zákazníků dokončen!')
  console.log(`   Importováno : ${imported} zákazníků (${b2cCount} B2C, ${b2bCount} B2B)`)
  console.log(`   Adresy      : ${addressCount}`)
  console.log(`   Přeskočeni  : ${skipped}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
