import puppeteerCore, { type Browser } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { renderInvoiceHtml, type InvoiceItemData, type VatBreakdownEntry } from '@/lib/invoice-template'

// Na Vercelu/AWS Lambda není Chrome a plný puppeteer se nevejde do limitu
// funkce — používá se slim binář @sparticuz/chromium. Lokálně (dev) běží
// plný puppeteer (devDependency) se svým staženým Chromem.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }) as unknown as Promise<Browser>
}

export async function generateInvoicePdfBuffer(documentId: string): Promise<Buffer> {
  const [doc, supplierSettings] = await Promise.all([
    prisma.document.findUnique({
      where: { id: documentId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.supplierSettings.findFirst({
      select: { iban: true, invoiceFooterNote: true },
    }),
  ])

  if (!doc) throw new Error(`Faktura ${documentId} nenalezena.`)

  const items: InvoiceItemData[] = doc.items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPriceWithoutVat: Number(item.unitPriceWithoutVat),
    unitPriceWithVat: Number(item.unitPriceWithVat),
    vatRate: item.vatRate,
    discount: item.discount != null ? Number(item.discount) : null,
    lineTotalWithoutVat: Number(item.lineTotalWithoutVat),
    lineVatAmount: Number(item.lineVatAmount),
    lineTotalWithVat: Number(item.lineTotalWithVat),
  }))

  const vatBreakdown = (doc.vatBreakdown as VatBreakdownEntry[]) ?? []

  const html = await renderInvoiceHtml({
    number: doc.number,
    status: doc.status,
    supplierName: doc.supplierName,
    supplierStreet: doc.supplierStreet,
    supplierCity: doc.supplierCity,
    supplierPostalCode: doc.supplierPostalCode,
    supplierCountry: doc.supplierCountry,
    supplierCompanyId: doc.supplierCompanyId,
    supplierVatId: doc.supplierVatId,
    supplierBankAccount: doc.supplierBankAccount,
    supplierIban: supplierSettings?.iban ?? null,
    supplierLegalNote: doc.supplierLegalNote,
    customerName: doc.customerName,
    customerStreet: doc.customerStreet,
    customerCity: doc.customerCity,
    customerPostalCode: doc.customerPostalCode,
    customerCountry: doc.customerCountry,
    customerCompanyId: doc.customerCompanyId,
    customerVatId: doc.customerVatId,
    customerEmail: doc.customerEmail,
    customerPhone: doc.customerPhone,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    taxDate: doc.taxDate,
    variableSymbol: doc.variableSymbol,
    constantSymbol: doc.constantSymbol,
    paymentMethod: doc.paymentMethod,
    pricesIncludeVat: doc.pricesIncludeVat,
    subtotalWithoutVat: Number(doc.subtotalWithoutVat),
    totalVat: Number(doc.totalVat),
    totalWithVat: Number(doc.totalWithVat),
    vatBreakdown,
    items,
    note: doc.note,
    invoiceFooterNote: supplierSettings?.invoiceFooterNote ?? null,
  })

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    })
    return Buffer.from(pdfUint8)
  } finally {
    await browser.close()
  }
}
