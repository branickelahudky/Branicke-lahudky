import Link from 'next/link'
import Image from 'next/image'
import { Landmark, Banknote, PackageCheck, CreditCard, Phone, Mail } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export type FooterNavItem = { id: string; label: string; href: string; openNewTab: boolean }
export type FooterCategory = { id: string; name: string; slug: string }
export type FooterPayment = { id: string; code: string; name: string; provider: string }

interface Props {
  logoUrl: string | null
  logoAlt: string | null
  footerText: string | null
  footerCopyright: string | null
  navItems: FooterNavItem[]
  categories: FooterCategory[]
  payments: FooterPayment[]
  branch: {
    name: string
    street: string
    zip: string
    city: string
    email: string | null
    phone1: string | null
    phone2: string | null
    openingHours: string | null
  } | null
  social: {
    facebook: string | null
    instagram: string | null
    youtube: string | null
    tiktok: string | null
  }
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      className="text-shop-muted hover:text-gold transition">
      {children}
    </a>
  )
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">{children}</h3>
  )
}

function FooterLink({ href, children, openNewTab }: { href: string; children: React.ReactNode; openNewTab?: boolean }) {
  return (
    <Link href={href} target={openNewTab ? '_blank' : undefined}
      className="text-sm text-shop-muted hover:text-gold transition">
      {children}
    </Link>
  )
}

/** Badge platební metody ve spodním pruhu — jen skutečně nabízené metody,
 *  žádná falešná loga. PayPal jako dvoubarevný wordmark, ostatní text + ikonka. */
function PaymentBadge({ payment }: { payment: FooterPayment }) {
  if (payment.provider === 'PAYPAL') {
    return (
      <span className="flex items-center rounded-md border border-shop-border bg-shop-bg px-2 py-1 text-xs font-bold italic" title={payment.name}>
        <span className="text-[#003087]">Pay</span>
        <span className="text-[#009cde]">Pal</span>
      </span>
    )
  }

  const Icon =
    payment.code === 'BANK_TRANSFER' ? Landmark
    : payment.code === 'COD' ? PackageCheck
    : payment.code === 'CASH_ON_PICKUP' ? Banknote
    : CreditCard

  return (
    <span className="flex items-center gap-1.5 rounded-md border border-shop-border bg-shop-bg px-2 py-1 text-xs text-shop-muted">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {payment.name}
    </span>
  )
}

export function Footer({
  logoUrl, logoAlt, footerText, footerCopyright,
  navItems, categories, payments, branch, social,
}: Props) {
  const hasSocial = social.facebook || social.instagram || social.youtube || social.tiktok
  const phoneHref = (phone: string) => `tel:${phone.replace(/\s+/g, '')}`

  return (
    <footer className="border-t border-shop-border bg-shop-bg mt-12">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Kontakt — na mobilu první (nejdůležitější), na desktopu poslední sloupec */}
          {branch && (
            <div className="sm:col-span-2 lg:order-last lg:col-span-1">
              <ColumnHeading>Kontakt</ColumnHeading>
              <p className="text-sm font-semibold text-shop-fg">{branch.name}</p>
              <p className="mt-0.5 text-sm text-shop-muted">
                {branch.street}, {branch.zip} {branch.city}
              </p>
              {branch.phone1 && (
                <a href={phoneHref(branch.phone1)}
                  className="mt-3 flex items-center gap-2 text-xl font-bold text-gold hover:text-gold/80 transition">
                  <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {branch.phone1}
                </a>
              )}
              {branch.phone2 && (
                <a href={phoneHref(branch.phone2)}
                  className="mt-1 flex items-center gap-2 text-sm font-medium text-shop-fg hover:text-gold transition">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {branch.phone2}
                </a>
              )}
              {branch.email && (
                <a href={`mailto:${branch.email}`}
                  className="mt-2 flex items-center gap-2 text-sm text-shop-muted hover:text-gold transition">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {branch.email}
                </a>
              )}
              {branch.openingHours && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-shop-muted">Otevírací doba</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-shop-muted">
                    {branch.openingHours}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Značka */}
          <div className="sm:col-span-2 lg:col-span-1">
            {logoUrl ? (
              <div className="relative mb-3 h-14 w-14 overflow-hidden rounded-xl bg-[#0a0a0a]">
                <Image src={logoUrl} alt={logoAlt ?? 'Branické lahůdkářství'}
                  fill className="object-contain" sizes="56px" unoptimized />
              </div>
            ) : (
              <p className="mb-3 text-lg font-bold text-gold">Branické lahůdkářství</p>
            )}
            {footerText && (
              <p className="text-sm leading-relaxed text-shop-muted">{footerText}</p>
            )}
            {hasSocial && (
              <div className="mt-4 flex items-center gap-3">
                {social.facebook && (
                  <SocialIcon href={social.facebook} label="Facebook">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </SocialIcon>
                )}
                {social.instagram && (
                  <SocialIcon href={social.instagram} label="Instagram">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                  </SocialIcon>
                )}
                {social.youtube && (
                  <SocialIcon href={social.youtube} label="YouTube">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </SocialIcon>
                )}
                {social.tiktok && (
                  <SocialIcon href={social.tiktok} label="TikTok">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                    </svg>
                  </SocialIcon>
                )}
              </div>
            )}
          </div>

          {/* Nakupování */}
          <div>
            <ColumnHeading>Nakupování</ColumnHeading>
            <nav className="flex flex-col gap-1.5">
              <FooterLink href="/akce">Akce</FooterLink>
              <FooterLink href="/novinky">Novinky</FooterLink>
              <FooterLink href="/doporucujeme">Doporučujeme</FooterLink>
              {categories.map((c) => (
                <FooterLink key={c.id} href={`/kategorie/${c.slug}`}>{c.name}</FooterLink>
              ))}
              <FooterLink href="/ucet">Můj účet</FooterLink>
            </nav>
          </div>

          {/* Informace — FOOTER menu z adminu */}
          {navItems.length > 0 && (
            <div>
              <ColumnHeading>Informace</ColumnHeading>
              <nav className="flex flex-col gap-1.5">
                {navItems.map((item) => (
                  <FooterLink key={item.id} href={item.href} openNewTab={item.openNewTab}>
                    {item.label}
                  </FooterLink>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Spodní pruh: copyright | platby | přepínač tématu */}
      <div className="border-t border-shop-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-shop-muted">
            {footerCopyright ?? `© ${new Date().getFullYear()} Branické lahůdkářství`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {payments.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="mr-1 text-xs text-shop-muted">Způsoby platby:</span>
                {payments.map((pm) => (
                  <PaymentBadge key={pm.id} payment={pm} />
                ))}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
