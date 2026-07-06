import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

// CMS stránky z adminu (Vzhled → Stránky). Statické routy (pokladna,
// kategorie, produkt…) mají v Nextu přednost, sem propadne jen zbytek.

const getPage = cache(async (slug: string) => {
  return prisma.page.findUnique({ where: { slug } })
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page?.isPublished) return {}
  return {
    title: page.metaTitle?.trim() || page.title,
    description: page.metaDescription?.trim() || page.excerpt?.trim() || undefined,
    ...(page.robotsIndex ? {} : { robots: { index: false, follow: false } }),
  }
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page?.isPublished) notFound()

  const html = page.content?.trim() ? sanitizeHtml(page.content) : null

  return (
    <div className="mx-auto w-full max-w-[72ch] px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-shop-fg sm:text-3xl">{page.title}</h1>
      {html ? (
        <div
          className="page-richtext mt-6 text-shop-fg"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-6 text-shop-muted">Obsah této stránky právě připravujeme.</p>
      )}
    </div>
  )
}
