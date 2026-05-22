"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Statement {
  id: string; first_name: string; last_name: string; account_number: string
  billing_period: string; file_path: string; file_name: string; file_url?: string
  amount_due?: number; created_at: string
}

// Parse filename: LASTNAME_FIRSTNAME_MIDDLENAME_ACCOUNT.pdf
function parseFilename(name: string): { lastName: string; firstName: string; account: string } {
  const base = name.replace(/\.pdf$/i, "")
  const parts = base.split("_")
  // Last part is account number (numeric)
  // First part is last name
  // Middle parts are first + middle name
  if (parts.length < 3) return { lastName: parts[0] || "", firstName: parts[1] || "", account: "" }
  const account = parts[parts.length - 1]
  const lastName = parts[0]
  const firstName = parts.slice(1, -1).join(" ")
  return { lastName, firstName, account }
}

function formatPeriod(p: string) {
  if (!p) return "—"
  const [year, month] = p.split("-")
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" })
}

export default function AdminStatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [searchInput, setSearchInput] = useState("")      // what user is typing
  const [search, setSearch] = useState("")                 // what's actually being searched
  const [filterPeriod, setFilterPeriod] = useState("all")

  // ── Pagination (server-side) ─────────────────────────────────────────
  // Default 100 rows per page is fast (loads in <1s for any reasonable
  // dataset). User can browse pages without re-fetching the entire 1100-row
  // list every time. Also: we no longer pre-sign URLs upfront — they're
  // generated on-demand when admin clicks View on a specific row.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [openingId, setOpeningId] = useState<string | null>(null)  // for View loading spinner

  // Upload state
  const [billingPeriod, setBillingPeriod] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" })
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0, errors: [] as string[] })
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Debounce the search input: wait 400ms after typing stops before actually searching.
  // Saves hammering the API with 3400-row fetches on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // When filters change, jump back to page 1 (otherwise you could be on
  // page 5 of "All Periods" then switch to a month with only 1 page)
  useEffect(() => { setPage(1) }, [filterPeriod, search])

  useEffect(() => { load() }, [filterPeriod, search, page, pageSize])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterPeriod !== "all") params.append("period", filterPeriod)
      if (search) params.append("search", search)
      params.append("page", String(page))
      params.append("page_size", String(pageSize))
      // Skip the expensive distinct-periods fetch when we're paginating —
      // we already have the periods list from the first load.
      if (periods.length > 0 && page > 1) params.append("skip_periods", "1")

      const r = await fetch(`/api/admin/statements?${params}`)
      const d = await r.json()
      if (r.ok) {
        setStatements(d.statements || [])
        if (d.periods?.length) setPeriods(d.periods)
        setTotalRows(d.total ?? 0)
        setTotalPages(d.total_pages ?? 0)
      }
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  // On-demand sign URL when admin clicks View. Avoids generating 1000+
  // signed URLs upfront on initial page load.
  const openStatement = async (id: string) => {
    setOpeningId(id)
    try {
      const r = await fetch(`/api/admin/statements/sign?id=${id}`)
      const d = await r.json()
      if (!r.ok || !d.url) {
        setMsg({ ok: false, text: d.error || "Could not open statement" })
        return
      }
      window.open(d.url, "_blank", "noopener,noreferrer")
    } catch {
      setMsg({ ok: false, text: "Could not open statement" })
    } finally {
      setOpeningId(null)
    }
  }

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"))
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped])
    else setMsg({ ok: false, text: "Only PDF files are accepted" })
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"))
    setFiles(prev => [...prev, ...selected])
    if (fileRef.current) fileRef.current.value = ""
  }

  // Bulk upload
  const handleUpload = async () => {
    if (!billingPeriod) { setMsg({ ok: false, text: "Select a billing month" }); return }
    if (files.length === 0) { setMsg({ ok: false, text: "Add PDF files first" }); return }

    setUploading(true)
    setUploadResults({ success: 0, failed: 0, errors: [] })
    setProgress({ current: 0, total: files.length, name: "" })

    let success = 0, failed = 0
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const parsed = parseFilename(file.name)
      setProgress({ current: i + 1, total: files.length, name: `${parsed.lastName}, ${parsed.firstName}` })

      try {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("billing_period", billingPeriod)
        fd.append("file_name", file.name)
        fd.append("first_name", parsed.firstName)
        fd.append("last_name", parsed.lastName)
        fd.append("account_number", parsed.account)

        const r = await fetch("/api/admin/statements", { method: "POST", body: fd })
        if (r.ok) success++
        else { failed++; errors.push(`${file.name}: ${(await r.json()).error}`) }
      } catch {
        failed++; errors.push(`${file.name}: Network error`)
      }
    }

    setUploadResults({ success, failed, errors })
    setUploading(false)
    setMsg({ ok: failed === 0, text: `Uploaded ${success} of ${files.length} statements${failed > 0 ? ` (${failed} failed)` : ""}` })
    setFiles([])
    load()
  }

  const handleDeletePeriod = async (period: string) => {
    const count = statements.filter(s => s.billing_period === period).length
    if (!confirm(`Delete ALL ${count} statements for ${formatPeriod(period)}? This removes files from storage too.`)) return
    const r = await fetch(`/api/admin/statements?period=${period}`, { method: "DELETE" })
    if (r.ok) { setMsg({ ok: true, text: `Deleted ${count} statements` }); load() }
  }

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Delete this statement?")) return
    const r = await fetch(`/api/admin/statements?id=${id}`, { method: "DELETE" })
    if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Customer Statements</h1>
          <p className="mt-2 text-white/90">{totalRows.toLocaleString()} statements · {periods.length} billing periods</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Bulk Upload Statements</h2>

              {/* Billing Period */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium">Billing Month *</label>
                <input type="month" value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} className="w-full h-11 rounded-lg border px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                <p className="mt-1 text-xs text-gray-400">e.g. March 2026</p>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${dragActive ? "border-emerald-400 bg-emerald-50" : files.length > 0 ? "border-emerald-300 bg-emerald-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}`}
              >
                <input ref={fileRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
                {files.length > 0 ? (
                  <div>
                    <p className="text-3xl mb-2">📄</p>
                    <p className="font-medium text-emerald-700">{files.length} PDFs ready</p>
                    <p className="text-xs text-emerald-600 mt-1">{(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total</p>
                    <button onClick={(e) => { e.stopPropagation(); setFiles([]) }} className="mt-2 text-xs text-red-500 hover:text-red-700">Clear all</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">📂</p>
                    <p className="font-medium text-gray-700">Drag & Drop PDFs here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse (800+ files OK)</p>
                    <p className="text-[10px] text-gray-400 mt-2">Filename format: LASTNAME_FIRSTNAME_ACCOUNT.pdf</p>
                  </div>
                )}
              </div>

              {/* File Preview */}
              {files.length > 0 && files.length <= 20 && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-2 text-xs">
                  {files.map((f, i) => {
                    const p = parseFilename(f.name)
                    return <div key={i} className="flex items-center justify-between py-0.5"><span className="truncate text-gray-600">{p.lastName}, {p.firstName}</span><span className="text-gray-400">{p.account}</span></div>
                  })}
                </div>
              )}
              {files.length > 20 && <p className="mt-2 text-xs text-gray-500">Showing count only for {files.length} files</p>}

              {/* Progress Bar */}
              {uploading && (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-700">{progress.current} / {progress.total}</span>
                    <span className="text-gray-500">{pct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">Uploading: {progress.name}</p>
                </div>
              )}

              {/* Upload Results */}
              {!uploading && uploadResults.success > 0 && (
                <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm">
                  <p className="font-medium text-emerald-700">✅ {uploadResults.success} uploaded</p>
                  {uploadResults.failed > 0 && <p className="text-red-600">❌ {uploadResults.failed} failed</p>}
                </div>
              )}

              {/* Upload Button */}
              <button onClick={handleUpload} disabled={uploading || files.length === 0 || !billingPeriod}
                className="mt-4 w-full h-11 rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? `Uploading ${progress.current}/${progress.total}...` : `Upload ${files.length} Statement${files.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {/* Statements List */}
          <div className="lg:col-span-2">
            {/* Stats */}
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm">
                <p className="text-2xl font-semibold text-gray-900">{totalRows.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Total Statements</p>
              </div>
              <div className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm">
                <p className="text-2xl font-semibold text-blue-600">{periods.length}</p>
                <p className="text-sm text-gray-500">Billing Periods</p>
              </div>
              <div className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm">
                <p className="text-2xl font-semibold text-emerald-600">{statements.length}</p>
                <p className="text-sm text-gray-500">
                  {(search || filterPeriod !== "all") ? "On This Page" : "Showing This Page"}
                </p>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search box with icon, submit on Enter, and inline clear */}
              <form
                onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()) }}
                className="relative flex-1"
              >
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or account number..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-24 text-sm focus:border-emerald-500 focus:outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(""); setSearch("") }}
                    className="absolute right-20 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                    title="Clear"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  Search
                </button>
              </form>

              {/* Period filter */}
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Periods ({periods.length})</option>
                {periods.map(p => <option key={p} value={p}>{formatPeriod(p)}</option>)}
              </select>

              {/* Clear filter button — only visible when a period is selected */}
              {filterPeriod !== "all" && (
                <button
                  onClick={() => setFilterPeriod("all")}
                  className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
                  title="Show all periods"
                >
                  Clear filter
                </button>
              )}

              {filterPeriod !== "all" && (
                <button onClick={() => handleDeletePeriod(filterPeriod)} className="h-11 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50">
                  Delete {formatPeriod(filterPeriod)}
                </button>
              )}
            </div>

            {/* Active filters pill row */}
            {(search || filterPeriod !== "all") && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">Showing:</span>
                {search && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
                    Search: "{search}"
                    <button onClick={() => { setSearchInput(""); setSearch("") }} className="ml-1 text-emerald-700 hover:text-emerald-900">✕</button>
                  </span>
                )}
                {filterPeriod !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 ring-1 ring-blue-200">
                    Period: {formatPeriod(filterPeriod)}
                    <button onClick={() => setFilterPeriod("all")} className="ml-1 text-blue-700 hover:text-blue-900">✕</button>
                  </span>
                )}
                <span className="text-gray-500">· {statements.length} result{statements.length === 1 ? "" : "s"}</span>
              </div>
            )}

            {/* Table */}
            {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
            : statements.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center">
                <h3 className="text-lg font-medium mb-2">No statements found</h3>
                <p className="text-gray-500">
                  {(search || filterPeriod !== "all")
                    ? "Try clearing your search or filter above."
                    : "Upload your first batch to get started."}
                </p>
                {(search || filterPeriod !== "all") && (
                  <button
                    onClick={() => { setSearchInput(""); setSearch(""); setFilterPeriod("all") }}
                    className="mt-4 inline-flex items-center gap-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            : <div className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm">
                <div className="overflow-x-auto"><table className="w-full">
                  <thead className="border-b bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Period</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">PDF</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y">{statements.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium text-gray-900">{s.last_name}, {s.first_name}</p></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.account_number || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPeriod(s.billing_period)}</td>
                      <td className="px-4 py-3 text-center">
                        {s.file_path ? (
                          <button
                            onClick={() => openStatement(s.id)}
                            disabled={openingId === s.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {openingId === s.id ? "Opening..." : "📄 View"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteOne(s.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                      </td>
                    </tr>))}</tbody>
                </table></div>

                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
                    <div className="text-gray-600">
                      Showing <span className="font-medium">{((page - 1) * pageSize) + 1}</span>
                      –<span className="font-medium">{Math.min(page * pageSize, totalRows)}</span>
                      {" "}of <span className="font-medium">{totalRows.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Rows per page */}
                      <select
                        value={pageSize}
                        onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1) }}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
                        title="Rows per page"
                      >
                        <option value="50">50 per page</option>
                        <option value="100">100 per page</option>
                        <option value="200">200 per page</option>
                        <option value="500">500 per page</option>
                      </select>

                      {/* Prev */}
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                      >‹ Prev</button>

                      {/* Page indicator */}
                      <span className="px-2 text-xs text-gray-600">
                        Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                      </span>

                      {/* Next */}
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                      >Next ›</button>
                    </div>
                  </div>
                )}
              </div>}
          </div>
        </div>
      </section>
    </main>
  )
}
