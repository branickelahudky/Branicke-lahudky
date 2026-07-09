import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/seo'

// Sitemapa je dynamická — obsah (produkty, kategorie, CMS stránky)
// se mění v adminu bez rebuildů.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, pages] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, isIndexable: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.page.findMany({
      where: { isPublished: true, robotsIndex: true },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const newestUpdate = (dates: Date[]) =>
    dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: newestUpdate(products.map((p) => p.updatedAt)),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...(['akce', 'novinky', 'doporucujeme'] as const).map((path) => ({
      url: `${SITE_URL}/${path}`,
      lastModified: newestUpdate(products.map((p) => p.updatedAt)),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ]

  return [
    ...staticEntries,
    ...categories.map((c) => ({
      url: `${SITE_URL}/kategorie/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/produkt/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...pages.map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ]
}
