// PayPal Orders v2 REST API — server-to-server přes fetch, bez SDK.
// Secret nikdy neopouští server (soubor importují jen API routes).
//
// Tok: createPayPalOrder (intent CAPTURE) → zákazník schválí na PayPalu
// → návrat na /api/paypal/return → capturePayPalOrder (idempotentní).
// PAYPAL_MODE=sandbox|live přepíná prostředí jen přes env.

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com'
const LIVE_BASE = 'https://api-m.paypal.com'

export function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

export function paypalMode(): 'sandbox' | 'live' {
  return process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox'
}

export function paypalCurrency(): string {
  return process.env.PAYPAL_CURRENCY || 'CZK'
}

function baseUrl(): string {
  return paypalMode() === 'live' ? LIVE_BASE : SANDBOX_BASE
}

class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issue?: string,
  ) {
    super(message)
  }
}

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64')

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new PayPalError(`PayPal auth selhala (HTTP ${res.status})`, res.status)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export type CreatedPayPalOrder = {
  paypalOrderId: string
  approvalUrl: string
}

/**
 * Vytvoří PayPal order (intent CAPTURE). Vrací id + URL, kam zákazníka
 * přesměrovat ke schválení platby.
 */
export async function createPayPalOrder(params: {
  /** Částka s DPH v měně PAYPAL_CURRENCY, 2 desetinná místa */
  amount: number
  /** Naše číslo objednávky — objeví se v PayPal přehledu */
  referenceId: string
  returnUrl: string
  cancelUrl: string
}): Promise<CreatedPayPalOrder> {
  const token = await getAccessToken()

  const res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // idempotence create — opakovaný pokus pro stejnou objednávku nevytvoří duplikát
      'PayPal-Request-Id': `order-${params.referenceId}`,
    },
    cache: 'no-store',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          invoice_id: params.referenceId,
          amount: {
            currency_code: paypalCurrency(),
            value: params.amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
          },
        },
      },
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.id) {
    throw new PayPalError(
      `PayPal order se nepodařilo vytvořit (HTTP ${res.status})`,
      res.status,
      data?.details?.[0]?.issue,
    )
  }

  const approvalUrl = (data.links as Array<{ rel: string; href: string }> | undefined)?.find(
    (l) => l.rel === 'payer-action' || l.rel === 'approve',
  )?.href
  if (!approvalUrl) {
    throw new PayPalError('PayPal nevrátil approval URL.', res.status)
  }

  return { paypalOrderId: data.id, approvalUrl }
}

export type CaptureResult = {
  /** COMPLETED = zaplaceno */
  status: string
  /** id capture transakce (pro párování/refundace) */
  captureId: string | null
  /** skutečně stržená částka + měna — ověřit proti DB! */
  amount: number | null
  currency: string | null
}

function parseCapture(data: unknown): CaptureResult {
  const d = data as {
    status?: string
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; status: string; amount?: { value: string; currency_code: string } }> }
    }>
  }
  const capture = d.purchase_units?.[0]?.payments?.captures?.[0]
  return {
    status: d.status ?? 'UNKNOWN',
    captureId: capture?.id ?? null,
    amount: capture?.amount ? parseFloat(capture.amount.value) : null,
    currency: capture?.amount?.currency_code ?? null,
  }
}

/**
 * Strhne schválenou platbu. Idempotentní: pokud už byla stržena
 * (ORDER_ALREADY_CAPTURED), dotáhne stav GETem a vrátí ho jako úspěch.
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<CaptureResult> {
  const token = await getAccessToken()

  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${paypalOrderId}`,
    },
    cache: 'no-store',
  })

  const data = await res.json().catch(() => null)

  if (res.ok) return parseCapture(data)

  // Dvojitý capture (např. refresh návratové stránky) → ověřit GETem
  const issue = (data as { details?: Array<{ issue: string }> })?.details?.[0]?.issue
  if (issue === 'ORDER_ALREADY_CAPTURED') {
    return getPayPalOrder(paypalOrderId)
  }

  throw new PayPalError(
    `PayPal capture selhal (HTTP ${res.status})`,
    res.status,
    issue,
  )
}

/** Stav PayPal orderu (pro ověření po ORDER_ALREADY_CAPTURED). */
export async function getPayPalOrder(paypalOrderId: string): Promise<CaptureResult> {
  const token = await getAccessToken()
  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${paypalOrderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new PayPalError(`PayPal order se nepodařilo načíst (HTTP ${res.status})`, res.status)
  }
  return parseCapture(data)
}
