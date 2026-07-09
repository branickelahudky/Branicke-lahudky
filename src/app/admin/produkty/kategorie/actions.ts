'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

export async function updateCategorySEO(
  categoryId: string,
  data: { metaTitle: string | null; metaDescription: string | null }
) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, slug: true },
  })
  if (!category) throw new Error('Kategorie neexistuje.')

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
    },
  })

  revalidatePath('/admin/produkty/kategorie')
  revalidatePath(`/kategorie/${category.slug}`)
}
