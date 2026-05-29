/**
 * Profesionální HTML šablona pro transakční emaily.
 * Černá + zlatá brand. Table-based layout, inline CSS, email-safe.
 */

export type BranchForTemplate = {
  name: string
  street: string
  zip: string
  city: string
  email: string | null
  phone1: string | null
  openingHours?: string | null
}

export type BrandColors = {
  primary: string   // zlatá, výchozí #C9A961
  dark: string      // černá, výchozí #0a0a0a
}

const DEFAULT_BRAND: BrandColors = {
  primary: '#C9A961',
  dark: '#0a0a0a',
}

export type EmailTemplateParams = {
  preheader?: string
  heading: string
  bodyHtml: string
  itemsTableHtml?: string
  ctaButton?: { text: string; url: string }
  branch: BranchForTemplate
  brand?: BrandColors | null
  /** src atribut loga — 'cid:logo-markes' pro email, '/logo-markes.jpg' pro browser preview */
  logoSrc?: string
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderOpeningHours(raw: string | null | undefined, gold: string): string {
  if (!raw?.trim()) return ''
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const rows = lines.map(
    (line) =>
      `<tr><td style="padding:2px 0;font-size:12px;color:#a0a0a0;font-family:Arial,Helvetica,sans-serif;">${escHtml(line)}</td></tr>`,
  ).join('')
  return `
    <p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:${gold};letter-spacing:0.8px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Otevírací doba</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tbody>${rows}</tbody></table>`
}

export function renderEmailTemplate(params: EmailTemplateParams): string {
  const brand = { ...DEFAULT_BRAND, ...(params.brand ?? {}) }
  const logoSrc = params.logoSrc ?? 'cid:logo-markes'
  const gold = brand.primary
  const dark = brand.dark

  const preheaderHtml = params.preheader
    ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escHtml(params.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : ''

  const ctaHtml = params.ctaButton
    ? `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="background:${dark};border:2px solid ${gold};">
        <a href="${params.ctaButton.url}" style="display:block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">${escHtml(params.ctaButton.text)}</a>
       </td></tr></table>`
    : ''

  const branchEmail = params.branch.email
    ? `<a href="mailto:${escHtml(params.branch.email)}" style="color:${gold};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escHtml(params.branch.email)}</a>`
    : ''
  const branchPhone = params.branch.phone1
    ? `<span style="color:#a0a0a0;font-family:Arial,Helvetica,sans-serif;">${escHtml(params.branch.phone1)}</span>`
    : ''
  const branchContact = [branchEmail, branchPhone].filter(Boolean).join(
    '<span style="color:#404040;"> &middot; </span>',
  )

  const openingHtml = renderOpeningHours(params.branch.openingHours, gold)

  return `<!DOCTYPE html>
<html lang="cs" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />
  <title>Branické lahůdkářství</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

${preheaderHtml}

<!--[if mso]><table width="100%" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse;">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px 22px;border-bottom:2px solid ${gold};">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoSrc}" alt="Markes" width="90" height="45"
                       style="display:block;border:0;outline:none;max-height:45px;width:auto;" />
                </td>
                <td style="vertical-align:middle;text-align:right;">
                  <span style="font-size:13px;font-weight:700;color:${gold};letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;">
                    Branické lahůdkářství
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ HERO ═══ -->
        <tr>
          <td style="background:${dark};padding:32px 32px 28px;">
            <h1 style="margin:0;font-size:26px;font-weight:700;color:${gold};line-height:1.3;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
              ${params.heading}
            </h1>
          </td>
        </tr>

        <!-- ═══ BODY ═══ -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px 32px;">
            <div style="font-size:15px;line-height:1.7;color:#333333;font-family:Arial,Helvetica,sans-serif;">
              ${params.bodyHtml}
            </div>
            ${params.itemsTableHtml ?? ''}
            ${ctaHtml}
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="background:${dark};padding:28px 32px 32px;">
            <img src="${logoSrc}" alt="Markes" width="50" height="25"
                 style="display:block;border:0;outline:none;opacity:0.6;max-height:25px;width:auto;" />

            <p style="margin:16px 0 3px;font-size:14px;font-weight:700;color:${gold};font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">
              ${escHtml(params.branch.name)}
            </p>
            <p style="margin:0 0 3px;font-size:13px;color:#a0a0a0;font-family:Arial,Helvetica,sans-serif;">
              ${escHtml(params.branch.street)}, ${escHtml(params.branch.zip)} ${escHtml(params.branch.city)}
            </p>
            ${branchContact ? `<p style="margin:0 0 0;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${branchContact}</p>` : ''}

            ${openingHtml}

            <p style="margin:28px 0 0;font-size:11px;color:#505050;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
              Tento email byl odeslán automaticky. Prosíme, neodpovídejte na něj.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`
}
