// Animace „letící produkt": klon thumbnailu letí obloukem z tlačítka „+"
// do ikony košíku v hlavičce (#cart-icon), pak ikona + badge pulsne.
// Bez knihovny (Web Animations API). Respektuje prefers-reduced-motion.

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Pulse ikony košíku + bliknutí badge počtu
function pulseCart() {
  const icon = document.getElementById('cart-icon')
  icon?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'ease-out' },
  )
  const badge = document.getElementById('cart-badge')
  badge?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'ease-out' },
  )
}

/**
 * @param origin   element, ze kterého fotka „odlétá" (tlačítko +)
 * @param imgSrc   URL thumbnailu k naklonování
 * @param onArrive zavolá se po doletu (i při reduced-motion / chybějícím cíli) —
 *                 typicky otevření flyoutu košíku, aby šel dojem klik → let → vysunutí
 */
export function flyToCart(origin: HTMLElement | null, imgSrc: string | null, onArrive?: () => void) {
  const finish = () => { pulseCart(); onArrive?.() }

  const target = typeof document !== 'undefined' ? document.getElementById('cart-icon') : null

  // Reduced-motion nebo chybějící data → animaci přeskoč, jen pulse + onArrive
  if (prefersReducedMotion() || !origin || !imgSrc || !target) {
    finish()
    return
  }

  const SIZE = 56
  const o = origin.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  const startX = o.left + o.width / 2 - SIZE / 2
  const startY = o.top + o.height / 2 - SIZE / 2
  const endX = t.left + t.width / 2 - SIZE / 2
  const endY = t.top + t.height / 2 - SIZE / 2
  const dx = endX - startX
  const dy = endY - startY

  const clone = document.createElement('img')
  clone.src = imgSrc
  clone.alt = ''
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText = [
    'position:fixed',
    `left:${startX}px`,
    `top:${startY}px`,
    `width:${SIZE}px`,
    `height:${SIZE}px`,
    'border-radius:9999px',
    'object-fit:cover',
    'background:#fff',
    'box-shadow:0 10px 28px rgba(0,0,0,.28)',
    'z-index:2000',
    'pointer-events:none',
    'will-change:transform,opacity',
  ].join(';')
  document.body.appendChild(clone)

  // Oblouk: vrchol nadzvednutý nad spojnici (bezier-like přes mezikrok)
  const anim = clone.animate(
    [
      { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(0.8)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0, offset: 1 },
    ],
    { duration: 600, easing: 'ease-in', fill: 'forwards' },
  )

  anim.onfinish = () => { clone.remove(); finish() }
  anim.oncancel = () => { clone.remove() }
}
