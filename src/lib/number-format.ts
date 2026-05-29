/** Pure funkce pro formátování číselných řad — bez server závislostí. */
export function applyFormat(format: string, year: number, num: number): string {
  return format
    .replace(/\{rok\}/g, String(year))
    .replace(/\{rok2\}/g, String(year).slice(-2))
    .replace(/\{poradi:(\d+)\}/g, (_, n) => String(num).padStart(parseInt(n, 10), '0'))
    .replace(/\{poradi\}/g, String(num))
}
