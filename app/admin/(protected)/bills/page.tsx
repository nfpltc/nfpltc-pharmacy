"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Bill {
  id: string; first_name: string; last_name: string; email: string; phone: string | null
  bill_date: string; due_date: string | null; amount: number; description: string | null
  file_path: string | null; file_name: string | null; status: string; notes: string | null; created_at: string
}

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700", unpaid: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700", pending: "bg-gray-100 text-gray-600",
}

const emptyForm = { first_name: "", last_name: "", email: "", phone: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", amount: "", status: "unpaid", description: "" }

export default function AdminBillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ status: "", notes: "" })
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/bills"); const d = await r.json()
      if (r.ok) setBills(d.bills || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setMsg({ ok: false, text: "Select a PDF file" }); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      const r = await fetch("/api/admin/bills", { method: "POST", body: fd })
      if (r.ok) { setMsg({ ok: true, text: "Bill uploaded!" }); setForm(emptyForm); setFile(null); if (fileRef.current) fileRef.current.value = ""; load() }
      else { const d = await r.json(); setMsg({ ok: false, text: d.error || "Upload failed" }) }
    } catch { setMsg({ ok: false, text: "Upload failed" }) }
    finally { setUploading(false) }
  }

  const save = async () => {
    if (!editId) return
    try { const r = await fetch("/api/admin/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...editForm }) })
      if (r.ok) { setMsg({ ok: true, text: "Updated!" }); setEditId(null); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const del = async (id: string) => {
    if (!confirm("Delete this bill?")) return
    try { const r = await fetch(`/api/admin/bills?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = bills.filter(b => (filter === "all" || b.status === filter) &&
    (!search || `${b.first_name} ${b.last_name}`.toLowerCase().includes(search.toLowerCase()) || (b.email || "").toLowerCase().includes(search.toLowerCase())))

  const c = { t: bills.length, u: bills.filter(b => b.status === "unpaid").length, o: bills.filter(b => b.status === "overdue").length, p: bills.filter(b => b.status === "paid").length }
  const unpaidAmt = bills.filter(b => b.status !== "paid").reduce((s, b) => s + (b.amount || 0), 0)
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0)

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Bill Management</h1>
          <p className="mt-2 text-white/90">{c.t} total · {c.u} unpaid · {money(unpaidAmt)} outstanding</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Unpaid", v: c.u, c: "text-amber-600" }, { l: "Overdue", v: c.o, c: "text-red-600" }, { l: "Outstanding", v: money(unpaidAmt), c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upload Form */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Upload New Bill</h2>
              <form onSubmit={upload} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1">First Name *</label><input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" /></div>
                  <div><label className="block text-xs font-medium mb-1">Last Name *</label><input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" /></div>
                </div>
                <div><label className="block text-xs font-medium mb-1">Email *</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1">Bill Date *</label><input type="date" required value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" /></div>
                  <div><label className="block text-xs font-medium mb-1">Amount ($) *</label><input type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" placeholder="0.00" /></div>
                </div>
                <div><label className="block text-xs font-medium mb-1">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full h-10 rounded-lg border px-3 text-sm" placeholder="e.g. March 2024 Medications" /></div>
                <div><label className="block text-xs font-medium mb-1">PDF Bill *</label><input ref={fileRef} type="file" accept=".pdf" required onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700" /></div>
                <button type="submit" disabled={uploading} className="w-full h-11 rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{uploading ? "Uploading..." : "Upload Bill"}</button>
              </form>
            </div>
          </div>

          {/* Bills List */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row">
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border bg-white py-2.5 px-4 text-sm" />
              <div className="flex gap-2">
                {["all", "unpaid", "overdue", "paid"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
              </div>
            </div>

            {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
            : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No bills found</h3></div>
            : <div className="space-y-3">{list.map(b => (
                <div key={b.id} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm hover:shadow-md">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{b.first_name} {b.last_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[b.status] || "bg-gray-100"}`}>{b.status}</span>
                        <span className="text-lg font-bold text-gray-900">{money(b.amount)}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{b.email} · Bill: {fmt(b.bill_date)}{b.description ? ` · ${b.description}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {editId === b.id ? <>
                        <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="rounded border px-2 py-1 text-sm"><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select>
                        <button onClick={save} className="text-sm font-medium text-emerald-600 ml-2">Save</button>
                        <button onClick={() => setEditId(null)} className="text-sm text-gray-400 ml-1">Cancel</button>
                      </> : <>
                        <button onClick={() => { setEditId(b.id); setEditForm({ status: b.status, notes: b.notes || "" }) }} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                        <button onClick={() => del(b.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                      </>}
                    </div>
                  </div>
                </div>))}</div>}
          </div>
        </div>
      </section>
    </main>
  )
}
