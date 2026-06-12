// Prázdný stav košíku — sdíleno mezi CartDrawer (mobil) a CartSidebar (desktop).
export function CartEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <p className="mb-4 text-4xl">🛒</p>
      <p className="font-semibold text-stone-300">Košík je prázdný</p>
      <p className="mt-1 text-sm text-shop-muted">Přidejte produkty z nabídky</p>
    </div>
  )
}
