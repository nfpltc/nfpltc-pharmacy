"use client"
import { useEffect, useRef, useState } from "react"

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
  // Optional: which API endpoint generates a downloadable PDF.
  // If provided, a "Download PDF" button appears that POSTs the row to it.
  // The endpoint should respond with a PDF blob.
  downloadPdfEndpoint?: string
}

export default function SubmissionDetailModal({
  data, title, subtitle, sections, onClose, downloadPdfEndpoint,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  // ESC closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!data) return null

  const shownKeys = new Set<string>()
  for (const s of sections) for (const f of s.fields) shownKeys.add(f.key)
  for (const k of ["id", "raw_data", "full_form_date", "screening_responses"]) shownKeys.add(k)
  const otherKeys = Object.keys(data).filter(k => !shownKeys.has(k))

  // ── Print ONLY the modal contents ──────────────────────────────────────
  // Open a hidden iframe, copy the modal HTML into it, copy stylesheets,
  // and trigger that iframe's print dialog. This keeps the rest of the page
  // out of the print preview entirely.
  const handlePrint = () => {
    const node = printRef.current
    if (!node) return

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) { document.body.removeChild(iframe); return }

    // Copy ALL existing stylesheet links + style tags so Tailwind classes work
    const styleHTML = Array.from(document.head.querySelectorAll("link[rel='stylesheet'], style"))
      .map(el => el.outerHTML)
      .join("\n")

    doc.open()
    doc.write(`<!doctype html><html><head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      ${styleHTML}
      <style>
        @page { size: letter; margin: 0.5in; }
        body { background: #fff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-root { padding: 16px; }
        .print-header { background: #0B7C79; color: #fff; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; }
        .print-header h1 { margin: 0; font-size: 20px; font-weight: 600; }
        .print-header .subtitle { margin-top: 4px; font-size: 13px; opacity: 0.9; }
        .print-section { margin-bottom: 18px; page-break-inside: avoid; }
        .print-section h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0B7C79; margin: 0 0 8px 0; }
        .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb; }
        .print-field-label { font-size: 11px; font-weight: 600; color: #6b7280; }
        .print-field-value { font-size: 13px; color: #111827; word-break: break-word; }
        .print-empty { font-size: 13px; color: #9ca3af; font-style: italic; }
      </style>
    </head><body>${buildPrintHtml(data, sections, otherKeys, title, subtitle || "")}</body></html>`)
    doc.close()

    // Wait a tick for stylesheets to load before printing
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        // Clean up after print dialog closes
        setTimeout(() => { document.body.removeChild(iframe) }, 1000)
      }
    }, 250)
  }

  // ── Download PDF (server-generated, if endpoint provided) ──────────────
  const handleDownload = async () => {
    if (!downloadPdfEndpoint) return
    setDownloading(true)
    try {
      const r = await fetch(downloadPdfEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      })
      if (!r.ok) {
        alert("Failed to generate PDF: " + (await r.text().catch(() => r.statusText)))
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = sanitizeFilename(`${title || "submission"}.pdf`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/90">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {downloadPdfEndpoint && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
                title="Download as PDF"
              >
                {downloading ? "..." : "⬇ Download"}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
              title="Print"
            >
              🖨 Print
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body — wrapped in printRef so handlePrint can grab it */}
        <div ref={printRef} className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5">
          {sections.map((sec) => {
            const hasAny = sec.fields.some(f => isNonEmpty(data[f.key]))
            if (!hasAny) return null
            return (
              <section key={sec.title} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {sec.title}
                </h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                  {sec.fields.map(f => (
                    <FieldRow key={f.key} label={f.label} value={data[f.key]} />
                  ))}
                </div>
              </section>
            )
          })}

          {otherKeys.some(k => isNonEmpty(data[k])) && (
            <section className="mb-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Other
              </h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                {otherKeys.map(k => (
                  <FieldRow key={k} label={prettyLabel(k)} value={data[k]} />
                ))}
              </div>
            </section>
          )}

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

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim()
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
  let display: string
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const d = new Date(value)
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

// ── Print HTML generator (used inside the hidden iframe) ────────────────────
function buildPrintHtml(
  data: Record<string, any>,
  sections: DetailSection[],
  otherKeys: string[],
  title: string,
  subtitle: string,
): string {
  const h = (s: string) => escapeHtml(s)
  const nonEmpty = (v: any) =>
    v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") &&
    !(Array.isArray(v) && v.length === 0)

  const renderValue = (v: any): string => {
    if (!nonEmpty(v)) return `<div class="print-empty">—</div>`
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      try {
        const d = new Date(v)
        return `<div class="print-field-value">${h(v.length <= 10
          ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</div>`
      } catch { /* fall through */ }
    }
    if (typeof v === "object") return `<div class="print-field-value">${h(JSON.stringify(v))}</div>`
    return `<div class="print-field-value">${h(String(v))}</div>`
  }

  const sectionParts: string[] = []
  for (const sec of sections) {
    const hasAny = sec.fields.some(f => nonEmpty(data[f.key]))
    if (!hasAny) continue
    const fieldsHtml = sec.fields.map(f => `
      <div>
        <div class="print-field-label">${h(f.label)}</div>
        ${renderValue(data[f.key])}
      </div>`).join("")
    sectionParts.push(`<div class="print-section">
      <h3>${h(sec.title)}</h3>
      <div class="print-grid">${fieldsHtml}</div>
    </div>`)
  }

  if (otherKeys.some(k => nonEmpty(data[k]))) {
    const fieldsHtml = otherKeys.map(k => `
      <div>
        <div class="print-field-label">${h(prettyLabel(k))}</div>
        ${renderValue(data[k])}
      </div>`).join("")
    sectionParts.push(`<div class="print-section">
      <h3>Other</h3>
      <div class="print-grid">${fieldsHtml}</div>
    </div>`)
  }

  return `<div class="print-root">
    <div class="print-header">
      <h1>${h(title)}</h1>
      ${subtitle ? `<div class="subtitle">${h(subtitle)}</div>` : ""}
    </div>
    ${sectionParts.join("")}
  </div>`
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
