'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderProductImages, setPrimaryImage } from './actions'

type ProductImage = {
  id: string
  url: string
  thumbnailUrl: string
  storageKey: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

const MAX_IMAGES = 6
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 10

// ── Sortable item ──────────────────────────────────────────────────────────

function SortableImage({
  image,
  productId,
  onDelete,
  onSetPrimary,
}: {
  image: ProductImage
  productId: string
  onDelete: (id: string) => void
  onSetPrimary: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [deleting, setDeleting] = useState(false)
  const [settingPrimary, setSettingPrimary] = useState(false)

  async function handleDelete() {
    if (!confirm('Smazat tuto fotografii?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productId}/images/${image.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Chyba při mazání')
      }
      onDelete(image.id)
      toast.success('Fotografie smazána.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
      setDeleting(false)
    }
  }

  async function handleSetPrimary() {
    setSettingPrimary(true)
    try {
      await setPrimaryImage(productId, image.id)
      onSetPrimary(image.id)
      toast.success('Hlavní fotografie nastavena.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSettingPrimary(false)
    }
  }

  const src = image.thumbnailUrl || image.url

  return (
    <div ref={setNodeRef} style={style} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
      {src ? (
        <Image
          src={src}
          alt={image.altText ?? ''}
          fill
          className="object-cover"
          sizes="200px"
          unoptimized={src.startsWith('http') && !src.includes('r2.dev')}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-stone-300">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* Primary star */}
      {image.isPrimary && (
        <div className="absolute left-2 top-2 rounded-full bg-amber-400 p-1 shadow" title="Hlavní fotografie">
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      )}

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 cursor-grab rounded bg-black/40 p-1 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="Přetáhnout"
      >
        <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a1 1 0 000 2h6a1 1 0 000-2H7zM7 8a1 1 0 000 2h6a1 1 0 000-2H7zM7 14a1 1 0 000 2h6a1 1 0 000-2H7z" />
        </svg>
      </div>

      {/* Hover overlay actions */}
      <div className="absolute inset-x-0 bottom-0 flex translate-y-full flex-col gap-1 bg-black/60 p-2 transition-transform group-hover:translate-y-0">
        {!image.isPrimary && (
          <button
            onClick={handleSetPrimary}
            disabled={settingPrimary}
            className="w-full rounded bg-amber-400 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
          >
            {settingPrimary ? '…' : 'Nastavit jako hlavní'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full rounded bg-red-600 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {deleting ? 'Mažu…' : 'Smazat'}
        </button>
      </div>
    </div>
  )
}

// ── Upload zone ────────────────────────────────────────────────────────────

function UploadZone({
  productId,
  disabled,
  onUploaded,
}: {
  productId: string
  disabled: boolean
  onUploaded: (image: ProductImage) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error(`Nepodporovaný formát: ${file.type}. Povolené: JPG, PNG, WebP`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Soubor je příliš velký (max ${MAX_MB} MB)`)
      return
    }

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch(`/api/products/${productId}/images`, {
      method: 'POST',
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Chyba při nahrávání')
    onUploaded(data.image as ProductImage)
  }

  async function handleFiles(files: FileList | File[]) {
    if (disabled || uploading) return
    const arr = Array.from(files)
    setUploading(true)
    let errors = 0
    for (const f of arr) {
      try {
        await uploadFile(f)
      } catch (err) {
        errors++
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    }
    setUploading(false)
    if (arr.length - errors > 0) {
      toast.success(`${arr.length - errors} ${arr.length - errors === 1 ? 'fotografie nahrána' : 'fotografie nahrány'}.`)
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (disabled || uploading) return
      handleFiles(e.dataTransfer.files)
    },
    [disabled, uploading], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (disabled) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-stone-200 bg-stone-50">
        <p className="text-sm text-stone-400">Maximum {MAX_IMAGES} fotek dosaženo</p>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100'
      } ${uploading ? 'cursor-wait opacity-60' : ''}`}
    >
      {uploading ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Nahrávám…
        </div>
      ) : (
        <>
          <svg className="mb-1 h-6 w-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm text-stone-500">
            <span className="font-medium text-blue-600">Klikněte</span> nebo přetáhněte fotky sem
          </p>
          <p className="mt-0.5 text-xs text-stone-400">JPG, PNG, WebP · max {MAX_MB} MB · max {MAX_IMAGES} fotek</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED.join(',')}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PhotoGallery({
  productId,
  initialImages,
}: {
  productId: string
  initialImages: ProductImage[]
}) {
  const router = useRouter()
  const [images, setImages] = useState<ProductImage[]>(
    [...initialImages].sort((a, b) => a.sortOrder - b.sortOrder),
  )
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleUploaded(image: ProductImage) {
    setImages((prev) => {
      const next = [...prev, image]
      startTransition(() => router.refresh())
      return next
    })
  }

  function handleDeleted(imageId: string) {
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== imageId)
      // If deleted was primary, mark first remaining as primary
      if (prev.find((i) => i.id === imageId)?.isPrimary && next.length > 0) {
        next[0] = { ...next[0], isPrimary: true }
      }
      startTransition(() => router.refresh())
      return next
    })
  }

  function handleSetPrimary(imageId: string) {
    setImages((prev) =>
      prev.map((i) => ({ ...i, isPrimary: i.id === imageId })),
    )
    startTransition(() => router.refresh())
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setImages((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id)
      const newIdx = prev.findIndex((i) => i.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx).map((img, idx) => ({
        ...img,
        sortOrder: idx,
      }))
      reorderProductImages(productId, next.map((i) => i.id)).catch(() => {
        toast.error('Chyba při ukládání pořadí')
      })
      return next
    })
  }

  if (images.length === 0) {
    return (
      <div className="space-y-4">
        <UploadZone productId={productId} disabled={false} onUploaded={handleUploaded} />
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 py-12 text-center">
          <svg className="mb-3 h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium text-stone-500">Zatím žádné fotografie</p>
          <p className="mt-1 text-sm text-stone-400">Přetáhněte sem fotky nebo klikněte do oblasti výše</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {images.length} / {MAX_IMAGES} fotek · Přetažením změníte pořadí
        </p>
      </div>

      <UploadZone
        productId={productId}
        disabled={images.length >= MAX_IMAGES}
        onUploaded={handleUploaded}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => (
              <SortableImage
                key={image.id}
                image={image}
                productId={productId}
                onDelete={handleDeleted}
                onSetPrimary={handleSetPrimary}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
