'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateIdentity, deleteIdentityAsset, type IdentityFormData } from './actions'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedIdentity = {
  logoUrl: string | null
  logoAlt: string | null
  faviconUrl: string | null
  socialFacebook: string | null
  socialInstagram: string | null
  socialYoutube: string | null
  socialTiktok: string | null
  footerText: string | null
  footerCopyright: string | null
}

export type SerializedBranch = {
  name: string
  street: string
  zip: string
  city: string
  email: string | null
  phone1: string | null
  phone2: string | null
  openingHours: string | null
}

interface Props {
  identity: SerializedIdentity
  branch: SerializedBranch
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

// ── Upload widget ─────────────────────────────────────────────────

function AssetUpload({
  type,
  label,
  hint,
  currentUrl,
  onUploaded,
  onDeleted,
}: {
  type: 'logo' | 'favicon'
  label: string
  hint: string
  currentUrl: string | null
  onUploaded: (url: string) => void
  onDeleted: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error('Povolené formáty: JPG, PNG, WebP')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Soubor je příliš velký (max ${MAX_MB} MB)`)
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)

      const res = await fetch('/api/admin/identity/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chyba při nahrávání')

      onUploaded(data.url)
      toast.success(`${label} nahrán`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!confirm(`Smazat ${label.toLowerCase()}?`)) return
    setDeleting(true)
    try {
      await deleteIdentityAsset(type)
      onDeleted()
      toast.success(`${label} smazán`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setDeleting(false)
    }
  }

  const previewSize = type === 'logo' ? { w: 160, h: 80 } : { w: 64, h: 64 }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          style={{ width: previewSize.w, height: previewSize.h }}
          className="relative shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 flex items-center justify-center"
        >
          {currentUrl ? (
            <Image
              src={currentUrl}
              alt={label}
              fill
              className={type === 'logo' ? 'object-contain p-2' : 'object-cover'}
              unoptimized
            />
          ) : (
            <span className="text-xs text-stone-400">Náhled</span>
          )}
        </div>

        {/* Upload zone */}
        <div className="flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors text-sm ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400'
            } ${uploading ? 'cursor-wait opacity-60' : ''}`}
          >
            {uploading ? (
              <span className="text-stone-500">Nahrávám…</span>
            ) : (
              <span className="text-stone-500">
                <span className="font-medium text-blue-600">Klikněte</span> nebo přetáhněte soubor
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(',')}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }}
          />
        </div>
      </div>

      {currentUrl && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
        >
          {deleting ? 'Mažu…' : `Smazat ${label.toLowerCase()}`}
        </button>
      )}
    </div>
  )
}

// ── Sekce wrapper ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      {children}
    </div>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function IdentityClient({ identity: initial, branch }: Props) {
  const [isPending, startTransition] = useTransition()

  // Asset URLs (updated immediately on upload/delete)
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl)
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl)

  // Text fields
  const [logoAlt, setLogoAlt] = useState(initial.logoAlt ?? '')
  const [socialFacebook, setSocialFacebook] = useState(initial.socialFacebook ?? '')
  const [socialInstagram, setSocialInstagram] = useState(initial.socialInstagram ?? '')
  const [socialYoutube, setSocialYoutube] = useState(initial.socialYoutube ?? '')
  const [socialTiktok, setSocialTiktok] = useState(initial.socialTiktok ?? '')
  const [footerText, setFooterText] = useState(initial.footerText ?? '')
  const [footerCopyright, setFooterCopyright] = useState(initial.footerCopyright ?? '')

  function handleSave() {
    const data: IdentityFormData = {
      logoAlt: logoAlt || null,
      socialFacebook: socialFacebook || null,
      socialInstagram: socialInstagram || null,
      socialYoutube: socialYoutube || null,
      socialTiktok: socialTiktok || null,
      footerText: footerText || null,
      footerCopyright: footerCopyright || null,
    }

    startTransition(async () => {
      try {
        await updateIdentity(data)
        toast.success('Nastavení uloženo')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className={`space-y-5 transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* Logo & favicon */}
      <Section title="Logo & favicon">
        <div>
          <p className="mb-2 text-sm font-medium text-stone-700">Logo</p>
          <AssetUpload
            type="logo"
            label="Logo"
            hint="JPG, PNG, WebP · max 5 MB · doporučeno 400×200 px"
            currentUrl={logoUrl}
            onUploaded={setLogoUrl}
            onDeleted={() => setLogoUrl(null)}
          />
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-stone-700">Alt text loga</label>
            <input
              type="text"
              value={logoAlt}
              onChange={(e) => setLogoAlt(e.target.value)}
              placeholder="např. Branické lahůdkářství"
              className={inputCls}
            />
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="mb-2 text-sm font-medium text-stone-700">Favicon</p>
          <AssetUpload
            type="favicon"
            label="Favicon"
            hint="JPG, PNG, WebP · max 5 MB · bude oříznut na 64×64 px"
            currentUrl={faviconUrl}
            onUploaded={setFaviconUrl}
            onDeleted={() => setFaviconUrl(null)}
          />
        </div>
      </Section>

      {/* Sociální sítě */}
      <Section title="Sociální sítě">
        <p className="text-xs text-stone-400">Prázdné pole = odkaz se na webu nezobrazí.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: 'Facebook', value: socialFacebook, set: setSocialFacebook, ph: 'https://facebook.com/...' },
            { label: 'Instagram', value: socialInstagram, set: setSocialInstagram, ph: 'https://instagram.com/...' },
            { label: 'YouTube', value: socialYoutube, set: setSocialYoutube, ph: 'https://youtube.com/...' },
            { label: 'TikTok', value: socialTiktok, set: setSocialTiktok, ph: 'https://tiktok.com/@...' },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
              <input
                type="url"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Patička */}
      <Section title="Patička">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Text patičky</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={3}
            placeholder="Krátký popis provozovny nebo motto…"
            className={`${inputCls} resize-y`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Copyright</label>
          <input
            type="text"
            value={footerCopyright}
            onChange={(e) => setFooterCopyright(e.target.value)}
            placeholder={`© ${new Date().getFullYear()} Branické lahůdkářství`}
            className={inputCls}
          />
        </div>

        {/* Read-only náhled Provozovny */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Údaje z Provozovny (pouze čtení)
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-stone-400">Provozovna</dt>
              <dd className="text-stone-700">{branch.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-stone-400">Adresa</dt>
              <dd className="text-stone-700">{branch.street}, {branch.zip} {branch.city}</dd>
            </div>
            {branch.email && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-stone-400">E-mail</dt>
                <dd className="text-stone-700">{branch.email}</dd>
              </div>
            )}
            {(branch.phone1 || branch.phone2) && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-stone-400">Telefon</dt>
                <dd className="text-stone-700">{[branch.phone1, branch.phone2].filter(Boolean).join(', ')}</dd>
              </div>
            )}
            {branch.openingHours && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-stone-400">Otevírací doba</dt>
                <dd className="whitespace-pre-line text-stone-700">{branch.openingHours}</dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-stone-400">
            Tyto údaje se upravují v{' '}
            <a href="/admin/nastaveni/provozovna" className="underline hover:text-stone-600">
              Nastavení → Provozovna
            </a>.
          </p>
        </div>
      </Section>

      {/* Uložit */}
      <div className="flex justify-start">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          {isPending ? 'Ukládám…' : 'Uložit nastavení'}
        </button>
      </div>

    </div>
  )
}
