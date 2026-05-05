"use client"
import { useEffect } from "react"

// Reusable detail modal that displays every field of any submission row.
// Pass in the row data, a section schema (groups of field keys), and labels.
// Anything not in the schema is dumped into an "Other" section so nothing is hidden.

export interface DetailSection {
  title: string
  fields: Array<{ key: string; label: string }>
}

interface Props {
  data: Record<string, any> | null
  title: string
  subtitle?: string
  sections: DetailSection[]
  onClose: () => void
}

export default function SubmissionDetailModal({ data, title, subtitle, sections, onClose }: Props) {
  // ESC closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!data) return null

  // Compute which keys are already shown so we can collect leftovers
  const shownKeys = new Set<string>()
  for (const s of sections) for (const f of s.fields) shownKeys.add(f.key)
  // Auto-hide internal/system columns
  for (const k of ["id", "raw_data", "full_form_date", "screening_responses"]) shownKeys.add(k)

  const otherKeys = Object.keys(data).filter(k => !shownKeys.has(k))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl print:max-h-none print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4 text-white print:bg-white print:text-black">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/90 print:text-gray-600">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 print:hidden"
              title="Print"
            >
              🖨 Print
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white print:hidden"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5 print:overflow-visible">
          {sections.map((sec) => {
            // Skip empty sections (where every field is null/empty)
            const hasAny = sec.fields.some(f => isNonEmpty(data[f.key]))
            if (!hasAny) return null
            return (
              <section key={sec.title} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {sec.title}
                </h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2 print:bg-white print:border-gray-300">
                  {sec.fields.map(f => (
                    <FieldRow key={f.key} label={f.label} value={data[f.key]} />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Anything not in a section — never silently drop fields */}
          {otherKeys.some(k => isNonEmpty(data[k])) && (
            <section className="mb-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Other
              </h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2 print:bg-white print:border-gray-300">
                {otherKeys.map(k => (
                  <FieldRow key={k} label={prettyLabel(k)} value={data[k]} />
                ))}
              </div>
            </section>
          )}

          {/* Optional: show screening_responses as JSON if present (vaccine forms) */}
          {data.screening_responses && (
            <section className="mb-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Screening Responses
              </h3>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm">
                {Object.entries(data.screening_responses as Record<string, any>).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-200 py-1.5 last:border-0">
                    <span className="text-gray-600">{prettyLabel(k)}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function isNonEmpty(v: any): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "object") return Object.keys(v).length > 0
  return true
}

function prettyLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function FieldRow({ label, value }: { label: string; value: any }) {
  if (!isNonEmpty(value)) {
    return (
      <div className="text-sm">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        <div className="italic text-gray-400">—</div>
      </div>
    )
  }
  // Format dates nicely if they look like ISO dates
  let display: string
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const d = new Date(value)
      // Just date if no time, otherwise date + time
      display = value.length <= 10
        ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    } catch { display = String(value) }
  } else if (typeof value === "object") {
    display = JSON.stringify(value)
  } else {
    display = String(value)
  }

  return (
    <div className="text-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="break-words text-gray-900">{display}</div>
    </div>
  )
}
