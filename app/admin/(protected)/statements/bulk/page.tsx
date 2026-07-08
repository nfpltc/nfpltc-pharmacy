"use client"

import { useState } from "react"
import { FileUp, Loader2, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

type Result = { customers: number; total_pages: number; month_label?: string } | null

export default function BulkStatementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("9291")
  const [monthYm, setMonthYm] = useState("") // optional override, e.g. 2026-03
  const [phase, setPhase] = useState<"idle" | "uploading" | "indexing">("idle")
  const [msg, setMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null)
  const [result, setResult] = useState<Result>(null)

  const busy = phase !== "idle"

  async function run() {
    if (!file) { setMsg({ type: "error", text: "Choose the monthly PDF first." }); return }
    setMsg(null); setResult(null)
    try {
      // 1) Ask the server for a signed upload URL.
      setPhase("uploading")
      const signRes = await fetch("/api/admin/statements/bulk-sign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month_ym: monthYm || "auto", stamp: Date.now() }),
      })
      const sign = await signRes.json()
      if (!signRes.ok) throw new Error(sign.error || "Could not start upload")

      // 2) Upload the big PDF straight to Supabase (not through Vercel).
      const up = await supabase.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file)
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`)

      // 3) Index it (server fetches it + calls the statement service).
      setPhase("indexing")
      setMsg({ type: "info", text: "Uploaded. Reading the PDF and building the index…" })
      const idxRes = await fetch("/api/admin/statements/bulk-index", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sign.path, password, month_ym: monthYm || undefined }),
      })
      const idx = await idxRes.json()
      if (!idxRes.ok) throw new Error(idx.error || "Indexing failed")

      setResult({ customers: idx.customers, total_pages: idx.total_pages, month_label: idx.month_label })
      setMsg({ type: "success", text: `Done — ${idx.customers} customers indexed for ${idx.month_label || idx.month_ym}.` })
      setFile(null)
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Something went wrong" })
    } finally {
      setPhase("idle")
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><UploadCloud className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Upload monthly statements</h1>
          <p className="text-sm text-gray-500">Upload one bulk PDF. It's split by customer automatically — patients search and download only their own.</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : msg.type === "info" ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : msg.type === "info" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Monthly statement PDF</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 hover:border-emerald-400">
            <FileUp className="h-5 w-5 text-gray-400" />
            <span>{file ? file.name : "Choose the big monthly PDF…"}</span>
            <input type="file" accept="application/pdf" className="hidden" disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">PDF password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p className="mt-1 text-xs text-gray-400">Usually 9291.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Month <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="month" value={monthYm} onChange={(e) => setMonthYm(e.target.value)} disabled={busy}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p className="mt-1 text-xs text-gray-400">Auto-detected from the PDF if left blank.</p>
          </div>
        </div>

        <button onClick={run} disabled={busy || !file}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
          {phase === "uploading" ? <><Loader2 className="h-5 w-5 animate-spin" /> Uploading…</>
            : phase === "indexing" ? <><Loader2 className="h-5 w-5 animate-spin" /> Indexing customers…</>
            : <><UploadCloud className="h-5 w-5" /> Upload & index</>}
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">{result.month_label} is ready</p>
          <p className="mt-1 text-sm text-emerald-800">{result.customers} customers indexed from {result.total_pages} pages. Patients can now search and download their statement.</p>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Nothing is split into separate files — the bulk PDF is stored once and each patient's pages are pulled out on demand when they download.
      </p>
    </div>
  )
}
