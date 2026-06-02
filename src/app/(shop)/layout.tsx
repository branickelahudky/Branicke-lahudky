import { prisma } from '@/lib/prisma'
import { Header, type NavItem } from './_components/Header'
import { Footer, type FooterNavItem } from './_components/Footer'
import { CartProvider } from './_context/CartContext'
import { CartDrawer } from './_components/CartDrawer'

export default async function ShopLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const [identity, headerMenuItems, footerMenuItems, branch] = await Promise.all([
    prisma.siteIdentity.findFirst(),
    prisma.menuItem.findMany({
      where: { location: 'HEADER', isVisible: true },
      orderBy: { sortOrder: 'asc' },
      include: { page: { select: { slug: true } } },
    }),
    prisma.menuItem.findMany({
      where: { location: 'FOOTER', isVisible: true },
      orderBy: { sortOrder: 'asc' },
      include: { page: { select: { slug: true } } },
    }),
    prisma.branchSettings.findFirst(),
  ])

  function resolveHref(item: typeof headerMenuItems[0]): string {
    if (item.linkType === 'PAGE' && item.page?.slug) return `/${item.page.slug}`
    if (item.linkType === 'CATEGORY') return `/kategorie/${item.categoryId ?? '#'}`
    if (item.linkType === 'URL' && item.url) return item.url
    return '#'
  }

  const headerNavItems: NavItem[] = headerMenuItems.map((item) => ({
    id: item.id, label: item.label, href: resolveHref(item), openNewTab: item.openNewTab,
  }))

  const footerNavItems: FooterNavItem[] = footerMenuItems.map((item) => ({
    id: item.id, label: item.label, href: resolveHref(item), openNewTab: item.openNewTab,
  }))

  return (
    <CartProvider>
    <div id="shop-root" data-theme="dark" className="min-h-screen bg-shop-bg text-shop-fg">
      <Header
        logoUrl={identity?.logoUrl ?? null}
        logoAlt={identity?.logoAlt ?? null}
        navItems={headerNavItems}
      />
      <main>{children}</main>
      {modal}
      <Footer
        logoUrl={identity?.logoUrl ?? null}
        logoAlt={identity?.logoAlt ?? null}
        footerText={identity?.footerText ?? null}
        footerCopyright={identity?.footerCopyright ?? null}
        navItems={footerNavItems}
        branch={branch ? {
          name: branch.name,
          street: branch.street,
          zip: branch.zip,
          city: branch.city,
          email: branch.email,
          phone1: branch.phone1,
          phone2: branch.phone2,
          openingHours: branch.openingHours,
        } : null}
        social={{
          facebook: identity?.socialFacebook ?? null,
          instagram: identity?.socialInstagram ?? null,
          youtube: identity?.socialYoutube ?? null,
          tiktok: identity?.socialTiktok ?? null,
        }}
      />
      <CartDrawer />
    </div>
    </CartProvider>
  )
}
