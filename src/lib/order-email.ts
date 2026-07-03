import { formatCZK } from '@/lib/pricing'
import { renderEmailTemplate, type BranchForTemplate, type BrandColors } from './email-template'

export type { BranchForTemplate }

type OrderForEmail = {
  orderNumber: string
  contactFirstName: string
  contactLastName: string
  totalWithVat: number
  trackingNumber: string | null
  trackingUrl: string | null
  items: Array<{
    productName: string
    variantName: string | null
    quantity: number
    unit: string
    lineTotalWithVat: number
  }>
}

type StatusConfigForEmail = {
  emailSubject: string | null
  emailHeading: string | null
  emailBody: string | null
}

const BRANCH_FALLBACK: BranchForTemplate = {
  name: 'Branické lahůdkářství',
  street: 'Branická 75',
  zip: '14000',
  city: 'Praha',
  email: 'info@lahudkybranik.cz',
  phone1: null,
}

function replacePlaceholders(text: string, order: OrderForEmail): string {
  const jmeno = `${order.contactFirstName} ${order.contactLastName}`.trim()
  const sledovani = order.trackingNumber
    ? order.trackingUrl
      ? `Sledování zásilky: ${order.trackingUrl}`
      : `Číslo zásilky: ${order.trackingNumber}`
    : ''

  return text
    .replace(/\{jmeno\}/g, jmeno)
    .replace(/\{cislo\}/g, order.orderNumber)
    .replace(/\{castka\}/g, formatCZK(order.totalWithVat))
    .replace(/\{sledovani\}/g, sledovani)
}

function unitLabel(unit: string): string {
  if (unit === 'KG') return 'kg'
  if (unit === 'KS') return 'ks'
  return unit.toLowerCase()
}

function buildBodyHtml(bodyText: string): string {
  return bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 14px;line-height:1.7;color:#333333;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${line}</p>`,
    )
    .join('\n')
}

function buildItemsTable(order: OrderForEmail): string {
  if (order.items.length === 0) return ''

  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;color:#1a1a1a;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
          ${item.productName}${item.variantName ? ` – ${item.variantName}` : ''}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;text-align:center;color:#555555;white-space:nowrap;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
          ${item.quantity} ${unitLabel(item.unit)}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;text-align:right;color:#1a1a1a;white-space:nowrap;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
          ${formatCZK(item.lineTotalWithVat)}
        </td>
      </tr>`,
    )
    .join('')

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border:1px solid #C9A961;">
    <thead>
      <tr style="background:#0a0a0a;">
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Položka</th>
        <th style="padding:10px 16px;text-align:center;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Množství</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Cena</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f9f6f2;border-top:2px solid #C9A961;">
        <td colspan="2" style="padding:12px 16px;font-weight:700;color:#1a1a1a;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Celkem</td>
        <td style="padding:12px 16px;text-align:right;font-weight:700;color:#1a1a1a;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${formatCZK(order.totalWithVat)}</td>
      </tr>
    </tfoot>
  </table>`
}

// ─── Potvrzení objednávky (po vytvoření z pokladny) ──────────────

export type OrderForConfirmationEmail = OrderForEmail & {
  subtotalWithVat: number
  shippingMethodName: string
  shippingPriceWithVat: number
  paymentMethodName: string
  paymentFeeWithVat: number
  preferredDeliveryDate: Date | null
  deliveryTimeSlot: string | null
}

export type BankDetailsForEmail = {
  bankAccount: string | null
  iban: string | null
}

function buildConfirmationSummaryTable(order: OrderForConfirmationEmail): string {
  const cell = (content: string, extra = '') =>
    `<td style="padding:10px 16px;border-bottom:1px solid #f0ede8;font-size:14px;font-family:Arial,Helvetica,sans-serif;${extra}">${content}</td>`

  const rows = order.items
    .map(
      (item) => `
      <tr>
        ${cell(`${item.productName}${item.variantName ? ` – ${item.variantName}` : ''}`, 'color:#1a1a1a;')}
        ${cell(`${item.quantity} ${unitLabel(item.unit)}`, 'text-align:center;color:#555555;white-space:nowrap;')}
        ${cell(formatCZK(item.lineTotalWithVat), 'text-align:right;color:#1a1a1a;white-space:nowrap;')}
      </tr>`,
    )
    .join('')

  const extraRow = (label: string, value: string) => `
      <tr>
        ${cell(label, 'color:#555555;')}
        ${cell('', '')}
        ${cell(value, 'text-align:right;color:#1a1a1a;white-space:nowrap;')}
      </tr>`

  const shippingRow = extraRow(
    `Doprava – ${order.shippingMethodName}`,
    order.shippingPriceWithVat > 0 ? formatCZK(order.shippingPriceWithVat) : 'Zdarma',
  )
  const paymentRow =
    order.paymentFeeWithVat > 0
      ? extraRow(`Platba – ${order.paymentMethodName}`, formatCZK(order.paymentFeeWithVat))
      : extraRow(`Platba – ${order.paymentMethodName}`, '—')

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border:1px solid #C9A961;">
    <thead>
      <tr style="background:#0a0a0a;">
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Položka</th>
        <th style="padding:10px 16px;text-align:center;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Množství</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:#C9A961;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Cena</th>
      </tr>
    </thead>
    <tbody>${rows}${shippingRow}${paymentRow}</tbody>
    <tfoot>
      <tr style="background:#f9f6f2;border-top:2px solid #C9A961;">
        <td colspan="2" style="padding:12px 16px;font-weight:700;color:#1a1a1a;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Celkem k úhradě</td>
        <td style="padding:12px 16px;text-align:right;font-weight:700;color:#1a1a1a;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${formatCZK(order.totalWithVat)}</td>
      </tr>
    </tfoot>
  </table>`
}

function buildBankDetailsBox(order: OrderForConfirmationEmail, bank: BankDetailsForEmail): string {
  if (!bank.bankAccount && !bank.iban) return ''
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:4px 0;color:#555555;font-size:14px;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">${label}</td>
      <td style="padding:4px 0 4px 16px;color:#1a1a1a;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${value}</td>
    </tr>`

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;background:#f9f6f2;border:1px solid #C9A961;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#8a7340;font-family:Arial,Helvetica,sans-serif;">Platební údaje pro převod</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${bank.bankAccount ? row('Číslo účtu:', bank.bankAccount) : ''}
        ${bank.iban ? row('IBAN:', bank.iban) : ''}
        ${row('Variabilní symbol:', order.orderNumber)}
        ${row('Částka:', formatCZK(order.totalWithVat))}
      </table>
      <p style="margin:12px 0 0;font-size:13px;color:#555555;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">Objednávku začneme připravovat po připsání platby na účet.</p>
    </td></tr>
  </table>`
}

const CONFIRMATION_DEFAULT_BODY = `Dobrý den {jmeno},
děkujeme za vaši objednávku {cislo} v celkové hodnotě {castka}.
Objednávku nyní zpracujeme a budeme vás informovat o dalším postupu. Souhrn objednávky najdete níže.`

export function renderOrderConfirmationEmail(
  order: OrderForConfirmationEmail,
  options: {
    config?: StatusConfigForEmail | null
    bank?: BankDetailsForEmail | null
    showBankDetails?: boolean
    branch?: BranchForTemplate | null
    brand?: BrandColors | null
    logoSrc?: string
  },
): { subject: string; html: string } {
  const b = options.branch ?? BRANCH_FALLBACK

  const subject = options.config?.emailSubject
    ? replacePlaceholders(options.config.emailSubject, order)
    : `Potvrzení objednávky ${order.orderNumber}`

  const heading = options.config?.emailHeading
    ? replacePlaceholders(options.config.emailHeading, order)
    : 'Děkujeme za vaši objednávku!'

  const bodyRaw = replacePlaceholders(
    options.config?.emailBody || CONFIRMATION_DEFAULT_BODY,
    order,
  )

  const deliveryLine = order.preferredDeliveryDate
    ? `<p style="margin:0 0 14px;line-height:1.7;color:#333333;font-family:Arial,Helvetica,sans-serif;font-size:15px;">Přání k termínu doručení: <strong>${order.preferredDeliveryDate.toLocaleDateString('cs-CZ')}${order.deliveryTimeSlot ? ` (${order.deliveryTimeSlot})` : ''}</strong></p>`
    : ''

  const bankBox =
    options.showBankDetails && options.bank ? buildBankDetailsBox(order, options.bank) : ''

  const html = renderEmailTemplate({
    preheader: subject,
    heading,
    bodyHtml: buildBodyHtml(bodyRaw) + deliveryLine + bankBox,
    itemsTableHtml: buildConfirmationSummaryTable(order),
    branch: b,
    brand: options.brand,
    logoSrc: options.logoSrc,
  })

  return { subject, html }
}

export function renderOrderStatusEmail(
  config: StatusConfigForEmail,
  order: OrderForEmail,
  branch: BranchForTemplate | null,
  brand?: BrandColors | null,
  logoSrc?: string,
): { subject: string; html: string } {
  const b = branch ?? BRANCH_FALLBACK

  const subject = config.emailSubject
    ? replacePlaceholders(config.emailSubject, order)
    : `Objednávka ${order.orderNumber}`

  const heading = config.emailHeading
    ? replacePlaceholders(config.emailHeading, order)
    : subject

  const bodyRaw = config.emailBody
    ? replacePlaceholders(config.emailBody, order)
    : ''

  const html = renderEmailTemplate({
    preheader: subject,
    heading,
    bodyHtml: buildBodyHtml(bodyRaw),
    itemsTableHtml: buildItemsTable(order),
    branch: b,
    brand,
    logoSrc,
  })

  return { subject, html }
}
