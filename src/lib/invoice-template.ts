import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

// ─── Types ────────────────────────────────────────────────────────

export type InvoiceItemData = {
  description: string
  quantity: number
  unit: string
  unitPriceWithoutVat: number
  unitPriceWithVat: number
  vatRate: number
  discount: number | null
  lineTotalWithoutVat: number
  lineVatAmount: number
  lineTotalWithVat: number
}

export type VatBreakdownEntry = { rate: number; base: number; vat: number }

export type InvoiceTemplateData = {
  number: string
  status: string
  // Supplier
  supplierName: string
  supplierStreet: string
  supplierCity: string
  supplierPostalCode: string
  supplierCountry: string
  supplierCompanyId: string
  supplierVatId: string | null
  supplierBankAccount: string | null
  supplierIban: string | null
  supplierLegalNote: string | null
  // Customer
  customerName: string
  customerStreet: string | null
  customerCity: string | null
  customerPostalCode: string | null
  customerCountry: string | null
  customerCompanyId: string | null
  customerVatId: string | null
  customerEmail: string | null
  customerPhone: string | null
  // Dates
  issueDate: Date
  dueDate: Date
  taxDate: Date
  // Payment
  variableSymbol: string
  constantSymbol: string | null
  paymentMethod: string
  pricesIncludeVat: boolean
  // Totals
  subtotalWithoutVat: number
  totalVat: number
  totalWithVat: number
  vatBreakdown: VatBreakdownEntry[]
  items: InvoiceItemData[]
  note: string | null
  invoiceFooterNote: string | null
}

// ─── Formatters ───────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' Kč'
}

function fmtQty(n: number): string {
  // Remove trailing zeros for display: 1.000 → 1, 0.247 → 0,247
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n)
}

// ─── Main export ──────────────────────────────────────────────────

export async function renderInvoiceHtml(data: InvoiceTemplateData): Promise<string> {
  // Logo as base64
  let logoHtml = ''
  const logoPath = path.join(process.cwd(), 'public', 'logo-markes.jpg')
  if (fs.existsSync(logoPath)) {
    const b64 = fs.readFileSync(logoPath).toString('base64')
    logoHtml = `<img src="data:image/jpeg;base64,${b64}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
  } else {
    logoHtml = `<div style="font-size:18px;font-weight:700;color:#333;">${data.supplierName}</div>`
  }

  // QR platba (SPD 1.0)
  let qrHtml = ''
  const ibanClean = data.supplierIban?.replace(/\s/g, '') ?? ''
  if (ibanClean) {
    try {
      const spd = [
        'SPD*1.0',
        `ACC:${ibanClean}`,
        `AM:${data.totalWithVat.toFixed(2)}`,
        'CC:CZK',
        `X-VS:${data.variableSymbol}`,
        `MSG:Faktura ${data.number}`,
      ].join('*')
      const qrDataUrl = await QRCode.toDataURL(spd, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      qrHtml = `
        <div style="text-align:center;">
          <img src="${qrDataUrl}" alt="QR Platba" style="width:120px;height:120px;" />
          <div style="font-size:8px;color:#666;margin-top:3px;">QR Platba</div>
        </div>`
    } catch (_) {
      // QR generation failed, skip
    }
  }

  // Sorted VAT breakdown
  const vatRows = [...data.vatBreakdown].sort((a, b) => a.rate - b.rate)

  // Items table rows
  const colLabel = data.pricesIncludeVat ? 'Cena s DPH/MJ' : 'Cena bez DPH/MJ'
  const colTotal = data.pricesIncludeVat ? 'Celkem s DPH' : 'Celkem bez DPH'

  const itemRows = data.items
    .map((item) => {
      const unitPrice = data.pricesIncludeVat ? item.unitPriceWithVat : item.unitPriceWithoutVat
      const lineTotal = data.pricesIncludeVat ? item.lineTotalWithVat : item.lineTotalWithoutVat
      const discountCell = item.discount ? `${item.discount} %` : ''
      return `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;">${esc(item.description)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:right;">${fmtQty(item.quantity)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:center;">${esc(item.unit)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:center;">${item.vatRate} %</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:center;">${discountCell}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:right;">${fmtMoney(unitPrice)}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:500;">${fmtMoney(lineTotal)}</td>
        </tr>`
    })
    .join('')

  const vatTableRows = vatRows
    .map(
      (row) => `
      <tr>
        <td style="padding:3px 6px;">${row.rate} %</td>
        <td style="padding:3px 6px;text-align:right;">${fmtMoney(row.base)}</td>
        <td style="padding:3px 6px;text-align:right;">${fmtMoney(row.vat)}</td>
      </tr>`,
    )
    .join('')

  const cancelledBanner = data.status === 'CANCELLED'
    ? `<div style="position:fixed;top:40%;left:0;right:0;text-align:center;font-size:72px;font-weight:900;color:rgba(200,0,0,0.15);transform:rotate(-25deg);pointer-events:none;z-index:999;">STORNO</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #1a1a1a;
      background: #fff;
      padding: 15mm 15mm 15mm 15mm;
    }
    table { border-collapse: collapse; width: 100%; }
    .label { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
    .section-title {
      font-size: 9px;
      font-weight: 700;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 5px;
      padding-bottom: 2px;
      border-bottom: 1px solid #ddd;
    }
  </style>
</head>
<body>
  ${cancelledBanner}

  <!-- HEADER -->
  <table style="margin-bottom:12mm;">
    <tr>
      <td style="width:50%;vertical-align:top;">
        ${logoHtml}
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:20px;font-weight:700;color:#1a1a1a;">Faktura ${esc(data.number)}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;letter-spacing:0.08em;">DAŇOVÝ DOKLAD</div>
      </td>
    </tr>
  </table>

  <!-- DODAVATEL / ODBĚRATEL -->
  <table style="margin-bottom:8mm;">
    <tr>
      <td style="width:48%;vertical-align:top;padding-right:10mm;">
        <div class="section-title">Dodavatel</div>
        <div style="font-weight:700;font-size:11px;margin-bottom:3px;">${esc(data.supplierName)}</div>
        <div>${esc(data.supplierStreet)}</div>
        <div>${esc(data.supplierPostalCode)} ${esc(data.supplierCity)}</div>
        ${data.supplierCountry && data.supplierCountry !== 'Česká republika' ? `<div>${esc(data.supplierCountry)}</div>` : ''}
        <div style="margin-top:6px;">
          <table style="font-size:9.5px;">
            <tr><td class="label" style="padding-right:8px;">IČO</td><td>${esc(data.supplierCompanyId)}</td></tr>
            ${data.supplierVatId ? `<tr><td class="label" style="padding-right:8px;">DIČ</td><td>${esc(data.supplierVatId)}</td></tr>` : ''}
            ${data.supplierBankAccount ? `<tr><td class="label" style="padding-right:8px;">Účet</td><td>${esc(data.supplierBankAccount)}</td></tr>` : ''}
            ${ibanClean ? `<tr><td class="label" style="padding-right:8px;">IBAN</td><td style="font-size:9px;">${esc(data.supplierIban ?? '')}</td></tr>` : ''}
          </table>
        </div>
      </td>
      <td style="width:48%;vertical-align:top;padding-left:4mm;border-left:1px solid #e5e5e5;padding-left:10mm;">
        <div class="section-title">Odběratel</div>
        <div style="font-weight:700;font-size:11px;margin-bottom:3px;">${esc(data.customerName)}</div>
        ${data.customerStreet ? `<div>${esc(data.customerStreet)}</div>` : ''}
        ${(data.customerPostalCode || data.customerCity) ? `<div>${[data.customerPostalCode, data.customerCity].filter(Boolean).join(' ')}</div>` : ''}
        ${data.customerCountry && data.customerCountry !== 'Česká republika' ? `<div>${esc(data.customerCountry)}</div>` : ''}
        <div style="margin-top:6px;">
          <table style="font-size:9.5px;">
            ${data.customerCompanyId ? `<tr><td class="label" style="padding-right:8px;">IČO</td><td>${esc(data.customerCompanyId)}</td></tr>` : ''}
            ${data.customerVatId ? `<tr><td class="label" style="padding-right:8px;">DIČ</td><td>${esc(data.customerVatId)}</td></tr>` : ''}
            ${data.customerEmail ? `<tr><td class="label" style="padding-right:8px;">E-mail</td><td>${esc(data.customerEmail)}</td></tr>` : ''}
            ${data.customerPhone ? `<tr><td class="label" style="padding-right:8px;">Telefon</td><td>${esc(data.customerPhone)}</td></tr>` : ''}
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- PLATEBNÍ ÚDAJE -->
  <table style="margin-bottom:8mm;font-size:9.5px;background:#f9f9f9;border-radius:4px;">
    <tr>
      <td style="padding:5px 8px;width:25%;"><span class="label">Datum vystavení</span><br/><strong>${fmtDate(data.issueDate)}</strong></td>
      <td style="padding:5px 8px;width:25%;"><span class="label">Datum splatnosti</span><br/><strong>${fmtDate(data.dueDate)}</strong></td>
      <td style="padding:5px 8px;width:25%;"><span class="label">DUZP</span><br/><strong>${fmtDate(data.taxDate)}</strong></td>
      <td style="padding:5px 8px;width:25%;"><span class="label">Forma úhrady</span><br/><strong>${esc(data.paymentMethod)}</strong></td>
    </tr>
    <tr>
      <td style="padding:5px 8px;"><span class="label">Variabilní symbol</span><br/><strong>${esc(data.variableSymbol)}</strong></td>
      ${data.constantSymbol ? `<td style="padding:5px 8px;"><span class="label">Konstantní symbol</span><br/><strong>${esc(data.constantSymbol)}</strong></td>` : '<td></td>'}
      <td></td><td></td>
    </tr>
  </table>

  <!-- POLOŽKY -->
  <table style="margin-bottom:6mm;font-size:9.5px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:5px 6px;text-align:left;font-weight:600;">Popis</th>
        <th style="padding:5px 6px;text-align:right;font-weight:600;">Množství</th>
        <th style="padding:5px 6px;text-align:center;font-weight:600;">Jedn.</th>
        <th style="padding:5px 6px;text-align:center;font-weight:600;">DPH</th>
        <th style="padding:5px 6px;text-align:center;font-weight:600;">Sleva</th>
        <th style="padding:5px 6px;text-align:right;font-weight:600;">${colLabel}</th>
        <th style="padding:5px 6px;text-align:right;font-weight:600;">${colTotal}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- SOUHRN: QR + DPH + CELKEM -->
  <table>
    <tr>
      <td style="width:40%;vertical-align:top;padding-right:8mm;">
        ${qrHtml}
        ${!ibanClean && data.supplierBankAccount ? `<div style="font-size:8px;color:#999;margin-top:4px;">QR kód není dostupný – vyplňte IBAN v&nbsp;Nastavení.</div>` : ''}
      </td>
      <td style="width:60%;vertical-align:top;">
        <!-- Rozpis DPH -->
        <table style="margin-bottom:4mm;font-size:9.5px;width:100%;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:4px 6px;text-align:left;font-weight:600;">Sazba DPH</th>
              <th style="padding:4px 6px;text-align:right;font-weight:600;">Základ daně</th>
              <th style="padding:4px 6px;text-align:right;font-weight:600;">DPH</th>
            </tr>
          </thead>
          <tbody>${vatTableRows}</tbody>
          <tfoot>
            <tr style="border-top:1px solid #ccc;">
              <td style="padding:4px 6px;font-weight:600;">Celkem</td>
              <td style="padding:4px 6px;text-align:right;font-weight:600;">${fmtMoney(data.subtotalWithoutVat)}</td>
              <td style="padding:4px 6px;text-align:right;font-weight:600;">${fmtMoney(data.totalVat)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Celkem k úhradě -->
        <div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;font-weight:600;letter-spacing:0.04em;">CELKEM K ÚHRADĚ</span>
          <span style="font-size:18px;font-weight:700;">${fmtMoney(data.totalWithVat)}</span>
        </div>
      </td>
    </tr>
  </table>

  ${data.note ? `<div style="margin-top:6mm;padding:5px 8px;background:#fffbf0;border:1px solid #f0e5c0;border-radius:4px;font-size:9px;color:#555;">${esc(data.note)}</div>` : ''}

  <!-- PATIČKA -->
  <div style="margin-top:8mm;padding-top:4mm;border-top:1px solid #e5e5e5;font-size:8.5px;color:#888;">
    ${data.supplierLegalNote ? `<div>${esc(data.supplierLegalNote)}</div>` : ''}
    ${data.invoiceFooterNote ? `<div style="margin-top:2px;">${esc(data.invoiceFooterNote)}</div>` : ''}
  </div>
</body>
</html>`
}

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
