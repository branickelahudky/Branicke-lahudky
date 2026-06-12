// Jednotné formátování ceny v Kč (bez haléřů) — sdíleno košíkovými komponentami.
export function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}
