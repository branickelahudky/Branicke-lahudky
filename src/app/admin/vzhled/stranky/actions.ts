'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type PageFormData = {
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  metaTitle: string | null
  metaDescription: string | null
  robotsIndex: boolean
}

async function authOwnerOrAdmin() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
  return user
}

export async function createPage() {
  await authOwnerOrAdmin()

  let slug = `nova-stranka-${Date.now()}`
  const page = await prisma.page.create({
    data: { title: 'Nová stránka', slug, isSystem: false, isPublished: false },
  })

  revalidatePath('/admin/vzhled/stranky')
  redirect(`/admin/vzhled/stranky/${page.id}`)
}

export async function updatePage(pageId: string, data: PageFormData) {
  await authOwnerOrAdmin()

  if (!data.title.trim()) throw new Error('Název stránky je povinný.')

  const slug = data.slug.trim().toLowerCase()
  if (!slug) throw new Error('Slug je povinný.')
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug může obsahovat pouze a–z, 0–9 a pomlčky.')

  const conflict = await prisma.page.findFirst({
    where: { slug, id: { not: pageId } },
    select: { id: true },
  })
  if (conflict) throw new Error('Tento slug je již použit jinou stránkou.')

  await prisma.page.update({
    where: { id: pageId },
    data: {
      title: data.title.trim(),
      slug,
      excerpt: data.excerpt?.trim() || null,
      content: data.content || null,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
      robotsIndex: data.robotsIndex,
    },
  })

  revalidatePath('/admin/vzhled/stranky')
  revalidatePath(`/admin/vzhled/stranky/${pageId}`)
}

export async function togglePublished(pageId: string) {
  await authOwnerOrAdmin()

  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId }, select: { isPublished: true } })
  await prisma.page.update({ where: { id: pageId }, data: { isPublished: !page.isPublished } })

  revalidatePath('/admin/vzhled/stranky')
  revalidatePath(`/admin/vzhled/stranky/${pageId}`)
}

export async function deletePage(pageId: string) {
  await authOwnerOrAdmin()

  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId }, select: { isSystem: true, title: true } })
  if (page.isSystem) throw new Error(`Systémovou stránku „${page.title}" nelze smazat.`)

  await prisma.page.delete({ where: { id: pageId } })

  revalidatePath('/admin/vzhled/stranky')
  redirect('/admin/vzhled/stranky')
}

export async function suggestSlug(title: string) {
  return slugify(title)
}
