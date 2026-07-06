import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/customer-auth'
import { Header, type NavItem } from './_components/Header'
import type { MegaCategory } from './_components/CategoryNavBar'
import { Footer, type FooterNavItem } from './_components/Footer'
import { CartProvider } from './_context/CartContext'
import { CartFlyout } from './_components/CartFlyout'
import { CookieBanner } from './_components/CookieBanner'
import { UspTopBar } from './_components/UspTopBar'

export default async function ShopLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const [identity, headerMenuItems, footerMenuItems, branch, categoryTree, customerSession, uspItems] = await Promise.all([
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
    prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { products: { where: { isActive: true } } } } },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
    getCustomerSession(),
    // USP proužek nahoře — položky z adminu (Vzhled → Benefity)
    prisma.uspItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, icon: true, title: true, subtitle: true },
    }),
  ])

  const categories: MegaCategory[] = categoryTree.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
    children: c.children.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      productCount: s._count.products,
    })),
  }))

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
    <div id="shop-root" data-theme="light" className="min-h-screen bg-shop-bg text-shop-fg">
      <UspTopBar items={uspItems} />
      <Header
        logoUrl={identity?.logoUrl ?? null}
        logoAlt={identity?.logoAlt ?? null}
        navItems={headerNavItems}
        categories={categories}
        customerName={customerSession?.customer.firstName ?? null}
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
      <CartFlyout />
      <CookieBanner />
    </div>
    </CartProvider>
  )
}
