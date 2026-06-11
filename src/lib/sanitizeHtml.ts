/**
 * Lehký server-side sanitizer pro popisy produktů ze Shoptetu.
 *
 * Obsah popisů je first-party (vlastní CMS export majitele e-shopu), takže
 * hlavním cílem je odstranit nebezpečné / rozbíjející značky (script, style,
 * meta, iframe…) a všechny atributy mimo bezpečný allowlist. Není to náhrada
 * za DOMPurify pro nedůvěryhodný vstup — pro tento účel (renderování popisů
 * z importu) je to ale dostatečné a bez další závislosti.
 */

// Bloky, které odstraníme i s obsahem
const DANGEROUS_BLOCKS = ['script', 'style', 'head', 'title', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math']

// Povolené značky (vše ostatní se zahodí, text uvnitř zůstává)
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup',
  'ul', 'ol', 'li', 'blockquote',
  'h2', 'h3', 'h4', 'h5',
  'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'img',
])

// Atributy povolené pro konkrétní značky
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title']),
}

function safeUrl(url: string): string | null {
  const trimmed = url.trim()
  // povol relativní, http(s), mailto, tel
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed
  // zakaž javascript:, data:, vbscript: apod.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null
  return trimmed
}

export function sanitizeHtml(input: string): string {
  let html = input

  // 1) Odstraň komentáře
  html = html.replace(/<!--[\s\S]*?-->/g, '')

  // 2) Odstraň nebezpečné bloky i s obsahem
  for (const tag of DANGEROUS_BLOCKS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
    // a případné osamocené otevírací/ukončovací značky
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '')
  }

  // 3) Projdi všechny značky a profiltruj allowlistem
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g, (_m, slash, rawName, attrs, selfClose) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return '' // zahoď značku, text uvnitř zůstává

    if (slash === '/') return `</${name}>`

    // sestav povolené atributy
    const allowed = ALLOWED_ATTRS[name]
    let kept = ''
    if (allowed) {
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g
      let am: RegExpExecArray | null
      while ((am = attrRe.exec(attrs)) !== null) {
        const attrName = am[1].toLowerCase()
        if (attrName.startsWith('on')) continue // žádné event handlery
        if (!allowed.has(attrName)) continue
        let value = am[3] ?? am[4] ?? ''
        if (attrName === 'href' || attrName === 'src') {
          const safe = safeUrl(value)
          if (safe === null) continue
          value = safe
        }
        kept += ` ${attrName}="${value.replace(/"/g, '&quot;')}"`
      }
      if (name === 'a' && /href=/.test(kept)) kept += ' rel="noopener noreferrer"'
    }

    const selfCloseTags = name === 'br' || name === 'hr' || name === 'img'
    return `<${name}${kept}${selfCloseTags ? ' /' : ''}>`
  })

  return html.trim()
}

/** Je popis nepoužitelný? (prázdný nebo poškozený import "[object Object]") */
export function isGarbageDescription(s: string | null | undefined): boolean {
  if (!s) return true
  const t = s.trim()
  if (!t) return true
  if (/^(\[object Object\]\s*)+$/i.test(t)) return true
  return false
}

/**
 * Připraví popis k zobrazení:
 *  - poškozené / prázdné → { value: null }
 *  - plain text → vrátí beze změny (renderuje se jako text)
 *  - HTML → sanitizuje a označí isHtml = true
 */
export function prepareDescription(raw: string | null | undefined): { value: string | null; isHtml: boolean } {
  if (isGarbageDescription(raw)) return { value: null, isHtml: false }
  const s = raw!.trim()
  const hasHtml = /<[a-z][\s\S]*?>/i.test(s)
  if (!hasHtml) return { value: s, isHtml: false }
  return { value: sanitizeHtml(s), isHtml: true }
}
