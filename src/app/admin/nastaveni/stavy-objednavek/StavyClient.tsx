'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OrderStatus } from '@prisma/client'
import { updateStatusConfig, type StatusConfigData } from './actions'

export type SerializedStatusConfig = {
  status: OrderStatus
  label: string
  color: string
  sortOrder: number
  sendEmail: boolean
  emailSubject: string | null
  emailHeading: string | null
  emailBody: string | null
  generateInvoice: boolean
  attachInvoice: boolean
  isActive: boolean
}

// ─── helpers ─────────────────────────────────────────────────────

function inp(cls?: string) {
  return `w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none ${cls ?? ''}`
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-stone-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-amber-500"
      />
      {label}
    </label>
  )
}

// ─── Row (module level) ───────────────────────────────────────────

function StatusRow({
  cfg,
  onSaved,
}: {
  cfg: SerializedStatusConfig
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<StatusConfigData>({
    label: cfg.label,
    color: cfg.color,
    sendEmail: cfg.sendEmail,
    emailSubject: cfg.emailSubject,
    emailHeading: cfg.emailHeading,
    emailBody: cfg.emailBody,
    generateInvoice: cfg.generateInvoice,
    attachInvoice: cfg.attachInvoice,
    isActive: cfg.isActive,
  })
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof StatusConfigData>(k: K, v: StatusConfigData[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateStatusConfig(cfg.status, form)
        toast.success(`Stav „${form.label}" uložen.`)
        setOpen(false)
        onSaved()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
      >
        <span
          className="inline-block size-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: cfg.color }}
        />
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: cfg.color + '22', color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="text-xs text-stone-400 font-mono">{cfg.status}</span>
        <span className="ml-auto flex items-center gap-2">
          {cfg.sendEmail && (
            <span title="Odesílá email" className="text-base">📧</span>
          )}
          {cfg.generateInvoice && (
            <span title="Generuje fakturu" className="text-base">📄</span>
          )}
          <svg
            className={`size-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Expanded edit panel */}
      {open && (
        <div className="border-t border-stone-100 px-4 py-4 space-y-4 bg-stone-50/50">
          {/* Row 1: label + color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-stone-500">Název</label>
              <input
                value={form.label}
                onChange={(e) => set('label', e.target.value)}
                className={inp()}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Barva</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-stone-300 p-0.5"
                />
                <input
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                  placeholder="#6b7280"
                  className={inp('font-mono')}
                />
              </div>
            </div>
          </div>

          {/* Email section */}
          <div className="space-y-3">
            <Checkbox
              checked={form.sendEmail}
              onChange={(v) => set('sendEmail', v)}
              label="Poslat email zákazníkovi při přechodu do tohoto stavu"
            />
            {form.sendEmail && (
              <div className="ml-6 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Předmět emailu</label>
                  <input
                    value={form.emailSubject ?? ''}
                    onChange={(e) => set('emailSubject', e.target.value || null)}
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Nadpis v emailu</label>
                  <input
                    value={form.emailHeading ?? ''}
                    onChange={(e) => set('emailHeading', e.target.value || null)}
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Text emailu</label>
                  <textarea
                    rows={4}
                    value={form.emailBody ?? ''}
                    onChange={(e) => set('emailBody', e.target.value || null)}
                    className={inp('resize-y')}
                  />
                  <p className="mt-1 text-xs text-stone-400">
                    Použitelné značky: <code className="text-stone-500">{'{jmeno}'}</code>,{' '}
                    <code className="text-stone-500">{'{cislo}'}</code>,{' '}
                    <code className="text-stone-500">{'{sledovani}'}</code>,{' '}
                    <code className="text-stone-500">{'{castka}'}</code>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Invoice section */}
          <div className="space-y-2">
            <Checkbox
              checked={form.generateInvoice}
              onChange={(v) => set('generateInvoice', v)}
              label="Vygenerovat fakturu"
            />
            {form.generateInvoice && (
              <div className="ml-6">
                <Checkbox
                  checked={form.attachInvoice}
                  onChange={(v) => set('attachInvoice', v)}
                  label="Přiložit fakturu k emailu"
                />
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {isPending ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

interface Props {
  configs: SerializedStatusConfig[]
}

export function StavyClient({ configs }: Props) {
  const router = useRouter()
  const sorted = [...configs].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-semibold text-stone-800">Stavy objednávek</h2>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="mt-0.5 flex-shrink-0">⏳</span>
        <span>
          Odesílání emailů zatím není aktivní (čeká se na zprovoznění SMTP).
          Konfigurace se ukládá a aktivuje se po nastavení odesílání.
        </span>
      </div>

      {/* Status list */}
      <div className="space-y-2">
        {sorted.map((cfg) => (
          <StatusRow
            key={cfg.status}
            cfg={cfg}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  )
}
