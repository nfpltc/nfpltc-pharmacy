"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SubmissionDetailModal, { DetailSection } from "@/components/SubmissionDetailModal"

interface Vaccine {
  id: string
  first_name: string
  last_name: string
  dob: string
  email: string
  phone: string
  vaccine_type: string
  consent_name: string
  consent_date: string
  status: string
  administered_date: string
  administered_by: string
  lot_number: string
  screening_responses: Record<string, any> | null
  notes: string | null
  created_at: string
  [key: string]: any
}

// Sections shown in the View modal. Modal also auto-shows any other field.
const VACCINE_SECTIONS: DetailSection[] = [
  {
    title: "Patient",
    fields: [
      { key: "first_name", label: "First Name" },
      { key: "last_name",  label: "Last Name" },
      { key: "dob",        label: "Date of Birth" },
      { key: "phone",      label: "Phone" },
      { key: "email",      label: "Email" },
      { key: "address",    label: "Address" },
      { key: "city",       label: "City" },
      { key: "state",      label: "State" },
      { key: "zip",        label: "ZIP" },
    ],
  },
  {
    title: "Vaccine Selection",
    fields: [
      { key: "vaccine_type", label: "Vaccines Selected" },
    ],
  },
  {
    title: "Consent",
    fields: [
      { key: "consent_name", label: "Consent Signed By" },
      { key: "consent_date", label: "Consent Date" },
    ],
  },
  {
    title: "Administration",
    fields: [
      { key: "status",            label: "Status" },
      { key: "administered_date", label: "Date Administered" },
      { key: "administered_by",   label: "Administered By" },
      { key: "lot_number",        label: "Lot Number" },
    ],
  },
  {
    title: "Submission Info",
    fields: [
      { key: "created_at", label: "Submitted" },
      { key: "updated_at", label: "Last Updated" },
    ],
  },
  {
    title: "Internal",
    fields: [
      { key: "notes", label: "Admin Notes" },
    ],
  },
]

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", scheduled: "bg-blue-100 text-blue-700",
  administered: "bg-emerald-100 text-emerald-700", cancelled: "bg-gray-100 text-gray-600",
}

export default function AdminVaccinesPage() {
  const [items, setItems] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ status: "", notes: "" })
  const [viewing, setViewing] = useState<Vaccine | null>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/vaccines"); const d = await r.json()
      if (r.ok) setItems(d.submissions || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!editId) return
    try { const r = await fetch("/api/admin/vaccines", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...editForm }) })
      if (r.ok) { setMsg({ ok: true, text: "Updated!" }); setEditId(null); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const del = async (id: string) => {
    if (!confirm("Delete this submission?")) return
    try { const r = await fetch(`/api/admin/vaccines?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = items.filter(s => (filter === "all" || s.status === filter) &&
    (!search || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.vaccine_type || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(search.toLowerCase())))

  const c = { t: items.length, p: items.filter(s => s.status === "pending").length,
    sc: items.filter(s => s.status === "scheduled").length, a: items.filter(s => s.status === "administered").length }

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Vaccine Consent Forms</h1>
          <p className="mt-2 text-white/90">{c.t} total · {c.p} pending · {c.sc} scheduled · {c.a} administered</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Pending", v: c.p, c: "text-yellow-600" }, { l: "Scheduled", v: c.sc, c: "text-blue-600" }, { l: "Administered", v: c.a, c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by name, email, or vaccine..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "scheduled", "administered", "cancelled"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No submissions found</h3></div>
        : <div className="space-y-3">{list.map(s => (
            <div key={s.id} className="rounded-xl border border-emerald-900/10 bg-white shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="text-gray-400 hover:text-gray-600">
                  <svg className={`w-5 h-5 transition-transform ${expandedId === s.id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{s.vaccine_type}</span>
                    {editId === s.id ? <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="text-sm border rounded px-2 py-1">
                      <option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="administered">Administered</option><option value="cancelled">Cancelled</option>
                    </select> : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[s.status] || "bg-gray-100"}`}>{s.status}</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{s.email} · {s.phone} · {fmt(s.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {editId === s.id ? <>
                    <button onClick={save} className="text-sm font-medium text-emerald-600">Save</button>
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-400 ml-2">Cancel</button>
                  </> : <>
                    <button onClick={() => setViewing(s)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="View details">👁️</button>
                    <button onClick={() => { setEditId(s.id); setEditForm({ status: s.status, notes: s.notes || "" }) }} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                    <button onClick={() => del(s.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                  </>}
                </div>
              </div>
              {expandedId === s.id && <div className="border-t bg-gray-50 p-4">
                <div className="grid md:grid-cols-3 gap-6 text-sm">
                  <div><h4 className="font-medium mb-2">Patient Info</h4>
                    <p>DOB: {fmt(s.dob)}</p><p>Consent by: {s.consent_name} on {fmt(s.consent_date)}</p></div>
                  <div><h4 className="font-medium mb-2">Administration</h4>
                    <p>Administered: {s.administered_date ? fmt(s.administered_date) : "Not yet"}</p>
                    <p>By: {s.administered_by || "—"}</p><p>Lot #: {s.lot_number || "—"}</p></div>
                  <div><h4 className="font-medium mb-2">Screening</h4>
                    {s.screening_responses ? <p className="text-emerald-600">✓ Screening completed</p> : <p className="text-gray-500">No screening data</p>}</div>
                </div>
                {s.notes && <div className="mt-4 pt-4 border-t"><p><span className="font-medium">Notes:</span> {s.notes}</p></div>}
              </div>}
            </div>))}</div>}
      </section>

      {viewing && (
        <SubmissionDetailModal
          data={viewing}
          title={`${viewing.first_name || ""} ${viewing.last_name || ""}`.trim() || "Vaccine Submission"}
          subtitle={`Submitted ${fmt(viewing.created_at)}`}
          sections={VACCINE_SECTIONS}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  )
}
