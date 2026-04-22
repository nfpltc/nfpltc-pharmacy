"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, UserPlus, Pencil, Trash2, Mail, MailX, Search } from "lucide-react"

interface Customer {
  account_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  email_opt_in: boolean
  unsubscribed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Stats {
  total: number
  with_email: number
  no_email: number
  opted_out: number
}

type FilterType = "all" | "with_email" | "no_email" | "opted_out"

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, with_email: 0, no_email: 0, opted_out: 0 })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")

  // Edit / add modal
  const [editing, setEditing] = useState<Customer | null>(null)
  const [adding, setAdding] = useState(false)

  // Import modal
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => load(), 250)  // tiny debounce while typing
    return () => clearTimeout(t)
  }, [search, filter])

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (filter !== "all") params.append("filter", filter)
      const r = await fetch(`/api/admin/customers?${params}`)
      const d = await r.json()
      if (r.ok) {
        setCustomers(d.customers || [])
        setStats(d.stats || { total: 0, with_email: 0, no_email: 0, opted_out: 0 })
      } else {
        setMsg({ ok: false, text: d.error || "Failed to load" })
      }
    } catch {
      setMsg({ ok: false, text: "Failed to load customers" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete ${c.first_name} ${c.last_name} (#${c.account_number})?\nThis removes only the customer record, not their past statements.`)) return
    const r = await fetch(`/api/admin/customers?account_number=${encodeURIComponent(c.account_number)}`, { method: "DELETE" })
    if (r.ok) {
      setMsg({ ok: true, text: "Customer deleted" })
      load()
    } else {
      const d = await r.json()
      setMsg({ ok: false, text: d.error || "Delete failed" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-8 text-white">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm opacity-90 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="mt-1 text-sm opacity-90">
          {stats.total} customers · {stats.with_email} with email · {stats.opted_out} opted out
        </p>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {msg && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            {msg.text}
          </div>
        )}

        {/* Action bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            <UserPlus className="h-4 w-4" /> Add Customer
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
            <Upload className="h-4 w-4" /> Import from Excel
          </button>
          <a href="/api/admin/customers/export" download
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
            Export CSV
          </a>
        </div>

        {/* Search + filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, account #, or email..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterType)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="all">All Customers</option>
            <option value="with_email">With Email</option>
            <option value="no_email">Missing Email</option>
            <option value="opted_out">Opted Out</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Account #</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">
                  No customers found. {stats.total === 0 ? "Import an Excel file to get started." : "Try adjusting your search."}
                </td></tr>
              ) : customers.map((c) => (
                <tr key={c.account_number} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.last_name.toUpperCase()}, {c.first_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.account_number}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.email || <span className="italic text-gray-400">none</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3">
                    {!c.email ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        No email
                      </span>
                    ) : c.email_opt_in ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Mail className="h-3 w-3" /> Subscribed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <MailX className="h-3 w-3" /> Opted out
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(c)} className="mr-2 inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add modal */}
      {(editing || adding) && (
        <CustomerFormModal
          customer={editing}
          isAdd={adding}
          onClose={() => { setEditing(null); setAdding(false) }}
          onSaved={() => { setEditing(null); setAdding(false); load(); setMsg({ ok: true, text: "Saved" }) }}
        />
      )}

      {/* Import modal */}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); load(); setMsg({ ok: true, text: "Import complete" }) }} />
      )}
    </div>
  )
}

// ============================================================================
// Add / Edit modal
// ============================================================================
function CustomerFormModal({ customer, isAdd, onClose, onSaved }:
  { customer: Customer | null; isAdd: boolean; onClose: () => void; onSaved: () => void }) {
  const [account, setAccount]     = useState(customer?.account_number || "")
  const [firstName, setFirstName] = useState(customer?.first_name || "")
  const [lastName, setLastName]   = useState(customer?.last_name || "")
  const [email, setEmail]         = useState(customer?.email || "")
  const [phone, setPhone]         = useState(customer?.phone || "")
  const [optIn, setOptIn]         = useState(customer?.email_opt_in ?? true)
  const [notes, setNotes]         = useState(customer?.notes || "")
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    if (!account || !firstName || !lastName) {
      setError("Account number, first name, and last name are required")
      return
    }
    setSaving(true)
    const payload = {
      account_number: account, first_name: firstName, last_name: lastName,
      email: email || null, phone: phone || null, email_opt_in: optIn, notes: notes || null,
    }
    const r = await fetch("/api/admin/customers", {
      method: isAdd ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) onSaved()
    else setError(d.error || "Save failed")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{isAdd ? "Add Customer" : "Edit Customer"}</h2>
        </div>
        <div className="space-y-4 p-5">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <Field label="Account Number *">
            <input type="text" value={account} onChange={(e) => setAccount(e.target.value)}
              disabled={!isAdd}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *">
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Last Name *">
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            Subscribed to monthly statement emails
          </label>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm" rows={2} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button onClick={onClose} disabled={saving}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

// ============================================================================
// Excel import modal (two-step: preview then confirm)
// ============================================================================
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any | null>(null)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doPreview = async (f: File) => {
    setError(null); setPreview(null)
    const fd = new FormData()
    fd.append("file", f)
    const r = await fetch("/api/admin/customers/import", { method: "POST", body: fd })
    const d = await r.json()
    if (!r.ok) { setError(d.error || "Failed to parse file"); return }
    setPreview(d.summary)
  }

  const doCommit = async () => {
    if (!file) return
    setCommitting(true); setError(null)
    const fd = new FormData()
    fd.append("file", file)
    const r = await fetch("/api/admin/customers/import?commit=1", { method: "POST", body: fd })
    const d = await r.json()
    setCommitting(false)
    if (!r.ok) { setError(d.error || "Import failed"); return }
    onDone()
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); doPreview(f) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Import Customers from Excel</h2>
          <p className="mt-1 text-xs text-gray-600">
            Required columns: account_number, first_name, last_name. Optional: email, phone, notes.
            Existing customers (matched by account number) will be updated.
          </p>
        </div>

        <div className="space-y-4 p-5">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

          {/* File picker */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center ${dragActive ? "border-emerald-600 bg-emerald-50" : "border-gray-300"}`}
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium">{file ? file.name : "Drop Excel file here or click to browse"}</p>
            <p className="mt-1 text-xs text-gray-500">.xlsx, .xls, or .csv</p>
            <input ref={fileRef} type="file" className="hidden"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); doPreview(f) } }}
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm">
              <p className="mb-2 font-semibold text-emerald-900">Preview — no changes made yet</p>
              <ul className="space-y-1 text-emerald-900">
                <li>Rows in file: <strong>{preview.total_rows}</strong></li>
                <li>Valid: <strong>{preview.valid}</strong></li>
                <li>↳ New customers to add: <strong>{preview.new_customers}</strong></li>
                <li>↳ Existing customers to update: <strong>{preview.updates}</strong></li>
                {preview.skipped > 0 && (
                  <li className="text-amber-800">Skipped: <strong>{preview.skipped}</strong> (see issues below)</li>
                )}
              </ul>

              {preview.preview?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-emerald-900">First rows:</p>
                  <div className="overflow-x-auto rounded bg-white ring-1 ring-emerald-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-emerald-100"><tr>
                        <th className="px-2 py-1 text-left">Account</th>
                        <th className="px-2 py-1 text-left">Name</th>
                        <th className="px-2 py-1 text-left">Email</th>
                      </tr></thead>
                      <tbody>
                        {preview.preview.map((p: any, i: number) => (
                          <tr key={i} className="border-t border-emerald-100">
                            <td className="px-2 py-1">{p.account_number}</td>
                            <td className="px-2 py-1">{p.last_name}, {p.first_name}</td>
                            <td className="px-2 py-1">{p.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.issues?.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-800">
                    {preview.skipped} issue(s) — click to view
                  </summary>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-amber-900">
                    {preview.issues.map((iss: any, i: number) => (
                      <li key={i}>Row {iss.row}: {iss.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button onClick={onClose} disabled={committing}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={doCommit}
            disabled={!preview || committing || preview.valid === 0}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            {committing ? "Importing..." : preview ? `Import ${preview.valid} Rows` : "Import"}
          </button>
        </div>
      </div>
    </div>
  )
}
