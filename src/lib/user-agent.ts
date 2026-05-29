export function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Neznámé zařízení'

  // OS detection
  let os: string
  if (/iPhone/.test(ua)) {
    os = 'iPhone'
  } else if (/iPad/.test(ua)) {
    os = 'iPad'
  } else if (/Android/.test(ua)) {
    os = 'Android'
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'Mac'
  } else if (/Windows/.test(ua)) {
    os = 'Windows'
  } else if (/Linux/.test(ua)) {
    os = 'Linux'
  } else {
    os = 'Neznámý systém'
  }

  // Browser detection (order matters — Edge includes Chrome, Chrome includes Safari)
  let browser: string
  if (/Edg\//.test(ua)) {
    browser = 'Edge'
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = 'Opera'
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox'
  } else if (/Chrome\//.test(ua)) {
    browser = 'Chrome'
  } else if (/Safari\//.test(ua)) {
    browser = 'Safari'
  } else {
    browser = 'Prohlížeč'
  }

  return `${browser} na ${os}`
}
