import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  IdentityClient,
  type SerializedIdentity,
  type SerializedBranch,
} from './IdentityClient'

async function getOrCreateIdentity() {
  const existing = await prisma.siteIdentity.findFirst()
  if (existing) return existing
  return prisma.siteIdentity.create({
    data: { footerCopyright: `© ${new Date().getFullYear()} Branické lahůdkářství` },
  })
}

export default async function IdentitaPage() {
  const { user } = await requireAuth()

  const [identity, branch] = await Promise.all([
    getOrCreateIdentity(),
    prisma.branchSettings.findFirst(),
  ])

  const serializedIdentity: SerializedIdentity = {
    logoUrl: identity.logoUrl,
    logoAlt: identity.logoAlt,
    faviconUrl: identity.faviconUrl,
    socialFacebook: identity.socialFacebook,
    socialInstagram: identity.socialInstagram,
    socialYoutube: identity.socialYoutube,
    socialTiktok: identity.socialTiktok,
    footerText: identity.footerText,
    footerCopyright: identity.footerCopyright,
  }

  const serializedBranch: SerializedBranch = branch
    ? {
        name: branch.name,
        street: branch.street,
        zip: branch.zip,
        city: branch.city,
        email: branch.email,
        phone1: branch.phone1,
        phone2: branch.phone2,
        openingHours: branch.openingHours,
      }
    : {
        name: 'Branické lahůdkářství',
        street: 'Branická 75',
        zip: '14000',
        city: 'Praha',
        email: 'info@lahudkybranik.cz',
        phone1: '731 862 387',
        phone2: '775 182 396',
        openingHours: null,
      }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/identita" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Identita & patička" user={user} />
        <div className="p-6 max-w-2xl">
          <p className="mb-5 text-sm text-stone-500">
            Logo, favicon, sociální sítě a texty patičky webu.
          </p>
          <IdentityClient identity={serializedIdentity} branch={serializedBranch} />
        </div>
      </div>
    </div>
  )
}
