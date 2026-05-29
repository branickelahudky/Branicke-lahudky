/**
 * Idempotentní re-import zákazníků ze Shoptet XML.
 * - UPSERT: update pokud email/shoptetId existuje, create pokud ne
 * - Tolerantní k chybám (jeden zákazník nesmí zastavit import)
 * - Zachovává existující objednávky (žádný DELETE)
 * Použití: npx tsx scripts/reimport-shoptet-customers.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
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

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: '', lastName: parts[0] }
  const firstWord = parts[0]
  const secondWord = parts[1]
  const firstIsAllCaps = firstWord === firstWord.toUpperCase() && firstWord.length > 1
  const secondIsNotAllCaps = secondWord !== secondWord.toUpperCase()
  if (firstIsAllCaps && secondIsNotAllCaps) {
    return { firstName: parts.slice(1).join(' '), lastName: parts[0] }
  }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
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
}

interface XmlAccount {
  EMAIL?: string
  PHONE?: string
  EMAIL_VERIFIED?: string | number
}

interface XmlCustomer {
  '@_id': string | number
  CUSTOMER_GROUP?: string
  REGISTRATION_DATE?: string
  REMARK?: string
  BILLING_ADDRESS?: XmlAddress
  SHIPPING_ADDRESSES?: { SHIPPING_ADDRESS?: XmlAddress | XmlAddress[] }
  ACCOUNTS?: { ACCOUNT?: XmlAccount | XmlAccount[] }
}

// ── XML Parsing ───────────────────────────────────────────────────

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
  return result?.CUSTOMERS?.CUSTOMER ?? []
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const customers = parseXml()
  console.log(`✅ Načteno ${customers.length} zákazníků\n`)

  let created = 0
  let updated = 0
  let errors = 0
  let b2cCount = 0
  let b2bCount = 0
  let addressCount = 0
  const errorDetails: string[] = []

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i]
    const shoptetId = str(c['@_id'])
    const pos = `[${i + 1}/${customers.length}]`

    try {
      const accounts = toArr(c.ACCOUNTS?.ACCOUNT)
      const primaryAccount = accounts[0]
      const email = str(primaryAccount?.EMAIL).toLowerCase()

      if (!email) {
        process.stdout.write(`${pos} ⚠ id=${shoptetId} – bez e-mailu, přeskočen\n`)
        errors++
        errorDetails.push(`id=${shoptetId}: chybí e-mail`)
        continue
      }

      const phone = str(primaryAccount?.PHONE) || null
      const emailVerified = str(primaryAccount?.EMAIL_VERIFIED) === '1' ? new Date() : null

      const billing = c.BILLING_ADDRESS
      const fullName = str(billing?.FULL_NAME)
      const { firstName, lastName } = splitFullName(fullName)

      const group = str(c.CUSTOMER_GROUP)
      const companyId = str(billing?.COMPANY_ID) || null
      const vatId = str(billing?.VAT_ID) || null
      const companyName = str(billing?.COMPANY) || null
      const isBusinessCustomer = group.toLowerCase().includes('velkoobchod') || !!companyId

      let createdAt: Date
      try {
        const parsed = new Date(str(c.REGISTRATION_DATE))
        createdAt = isNaN(parsed.getTime()) ? new Date() : parsed
      } catch {
        createdAt = new Date()
      }

      const internalNote = str(c.REMARK) || null

      // ── UPSERT zákazníka ──
      const existingByShoptetId = shoptetId
        ? await prisma.customer.findFirst({ where: { shoptetId }, select: { id: true, email: true } })
        : null
      const existingByEmail = await prisma.customer.findFirst({ where: { email }, select: { id: true } })
      const existing = existingByShoptetId ?? existingByEmail

      let customerId: string
      let wasCreated: boolean

      const customerData = {
        email,
        firstName,
        lastName,
        phone,
        shoptetId: shoptetId || null,
        internalNote,
        isBusinessCustomer,
        companyName,
        companyId,
        vatId,
        emailVerified,
        acceptsMarketing: false,
      }

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: customerData,
        })
        customerId = existing.id
        wasCreated = false
      } else {
        const newCustomer = await prisma.customer.create({
          data: { ...customerData, passwordHash: null, createdAt },
        })
        customerId = newCustomer.id
        wasCreated = true
      }

      if (isBusinessCustomer) b2bCount++
      else b2cCount++

      // ── Adresy – jen pro nové zákazníky, nebo pokud nemají žádnou ──
      const existingAddrCount = await prisma.address.count({ where: { customerId } })
      if (existingAddrCount === 0) {
        // Billing address
        const billingStreet = str(billing?.STREET)
        const billingCity = str(billing?.CITY)
        if (billingStreet || billingCity) {
          const { firstName: bFn, lastName: bLn } = splitFullName(str(billing?.FULL_NAME))
          await prisma.address.create({
            data: {
              customerId,
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
              customerId,
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
      }

      const icon = wasCreated ? '✓' : '↻'
      const action = wasCreated ? 'vytvořen' : 'aktualizován'
      const label = fullName || email
      process.stdout.write(`${pos} ${icon} ${label} <${email}> - ${action}\n`)

      if (wasCreated) created++
      else updated++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`${pos} ✗ id=${shoptetId} - chyba: ${msg.slice(0, 100)}\n`)
      errors++
      errorDetails.push(`id=${shoptetId}: ${msg.slice(0, 120)}`)
    }
  }

  // ── Souhrn ──
  console.log('\n' + '═'.repeat(60))
  console.log('✅ Re-import zákazníků dokončen!')
  console.log(`   Vytvořeno    : ${created} (${b2cCount} B2C, ${b2bCount} B2B)`)
  console.log(`   Aktualizováno: ${updated}`)
  console.log(`   Adresy       : ${addressCount}`)
  console.log(`   Chyb         : ${errors}`)
  if (errorDetails.length > 0) {
    console.log('\nChyby:')
    errorDetails.forEach((d) => console.log(`  ✗ ${d}`))
  }

  const [custCount, addrCount] = await Promise.all([
    prisma.customer.count(),
    prisma.address.count(),
  ])
  console.log(`\n📊 DB po importu:`)
  console.log(`   Zákazníci : ${custCount}`)
  console.log(`   Adresy    : ${addrCount}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
