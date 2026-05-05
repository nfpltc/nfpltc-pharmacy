"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SubmissionDetailModal, { DetailSection } from "@/components/SubmissionDetailModal"

// We list the columns our UI uses by name, but the modal will display every
// field returned by the API — so this interface just types the common ones.
interface Enrollment {
  id: string
  first_name: string
  last_name: string
  dob: string
  submitter_email: string
  submitter_phone: string
  facility_name: string
  room_number: string
  start_date: string
  status: string
  notes: string | null
  created_at: string
  // ...all other columns are passed through to the modal
  [key: string]: any
}

// Sections shown in the View modal. The modal also auto-shows any field
// present on the row that's not in any section, so nothing is hidden.
const ENROLLMENT_SECTIONS: DetailSection[] = [
  {
    title: "Submission Info",
    fields: [
      { key: "todays_date", label: "Today's Date" },
      { key: "start_date",  label: "Start Date" },
      { key: "start_time",  label: "Start Time" },
      { key: "status",      label: "Status" },
      { key: "created_at",  label: "Submitted" },
    ],
  },
  {
    title: "Submitter",
    fields: [
      { key: "submitter_relation",   label: "Relationship" },
      { key: "submitter_first_name", label: "First Name" },
      { key: "submitter_last_name",  label: "Last Name" },
      { key: "submitter_phone",      label: "Phone" },
      { key: "submitter_email",      label: "Email" },
    ],
  },
  {
    title: "Resident / Patient",
    fields: [
      { key: "first_name",     label: "First Name" },
      { key: "last_name",      label: "Last Name" },
      { key: "middle_initial", label: "Middle Initial" },
      { key: "dob",            label: "Date of Birth" },
      { key: "ssn_last4",      label: "SSN (Last 4)" },
      { key: "gender",         label: "Gender" },
      { key: "home_address",   label: "Home Address" },
      { key: "city",           label: "City" },
      { key: "state",          label: "State" },
      { key: "zip",            label: "ZIP" },
      { key: "allergies",      label: "Allergies" },
    ],
  },
  {
    title: "Facility",
    fields: [
      { key: "facility_name",        label: "Facility Name" },
      { key: "room_number",          label: "Room Number" },
      { key: "facility_address",     label: "Address" },
      { key: "facility_city",        label: "City" },
      { key: "facility_state",       label: "State" },
      { key: "facility_zip",         label: "ZIP" },
      { key: "moving_from",          label: "Moving From" },
      { key: "hospital_rehab_name",  label: "Hospital/Rehab Name" },
      { key: "hospital_rehab_phone", label: "Hospital/Rehab Phone" },
    ],
  },
  {
    title: "Primary Care Physician",
    fields: [
      { key: "pcp_name",      label: "Name" },
      { key: "pcp_specialty", label: "Specialty" },
      { key: "pcp_address",   label: "Address" },
      { key: "pcp_phone",     label: "Phone" },
      { key: "pcp_fax",       label: "Fax" },
    ],
  },
  {
    title: "Insurance",
    fields: [
      { key: "rx_member_id", label: "Member ID" },
      { key: "rx_grp",       label: "Group" },
      { key: "rx_bin",       label: "BIN" },
      { key: "rx_pcn",       label: "PCN" },
    ],
  },
  {
    title: "Payment Card (last 4 only)",
    fields: [
      { key: "card_type",        label: "Card Type" },
      { key: "card_last4",       label: "Last 4" },
      { key: "card_exp",         label: "Expiration" },
      { key: "cardholder_name",  label: "Cardholder Name" },
      { key: "billing_address",  label: "Billing Address" },
      { key: "billing_city",     label: "Billing City" },
      { key: "billing_state",    label: "Billing State" },
      { key: "billing_zip",      label: "Billing ZIP" },
    ],
  },
  {
    title: "Additional Contact",
    fields: [
      { key: "additional_contact_name",  label: "Name" },
      { key: "additional_contact_phone", label: "Phone" },
    ],
  },
  {
    title: "Authorization",
    fields: [
      { key: "auth_name", label: "Authorized By" },
      { key: "auth_date", label: "Date" },
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
  pending: "bg-yellow-100 text-yellow-700", processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-gray-100 text-gray-600",
}

export default function AdminEnrollmentsPage() {
  const [items, setItems] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ status: "", notes: "" })
  const [viewing, setViewing] = useState<Enrollment | null>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/enrollments"); const d = await r.json()
      if (r.ok) setItems(d.submissions || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!editId) return
    try { const r = await fetch("/api/admin/enrollments", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...editForm }) })
      if (r.ok) { setMsg({ ok: true, text: "Updated!" }); setEditId(null); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const del = async (id: string) => {
    if (!confirm("Delete this enrollment?")) return
    try { const r = await fetch(`/api/admin/enrollments?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = items.filter(e => (filter === "all" || e.status === filter) &&
    (!search || `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (e.facility_name || "").toLowerCase().includes(search.toLowerCase())))

  const c = { t: items.length, p: items.filter(e => e.status === "pending").length,
    pr: items.filter(e => e.status === "processing").length, co: items.filter(e => e.status === "completed").length }

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Enrollments</h1>
          <p className="mt-2 text-white/90">{c.t} total · {c.p} pending · {c.pr} processing · {c.co} completed</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Pending", v: c.p, c: "text-yellow-600" }, { l: "Processing", v: c.pr, c: "text-blue-600" }, { l: "Completed", v: c.co, c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by name or facility..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2">
            {["all", "pending", "processing", "completed", "cancelled"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No enrollments found</h3></div>
        : <div className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="border-b bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Facility</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y">{list.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4"><p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p><p className="text-sm text-gray-500">DOB: {fmt(e.dob)}</p></td>
                  <td className="px-4 py-4"><p className="text-gray-900">{e.facility_name || "—"}</p><p className="text-sm text-gray-500">{e.room_number ? `Room ${e.room_number}` : ""}</p></td>
                  <td className="px-4 py-4 text-sm text-gray-600">{fmt(e.start_date)}</td>
                  <td className="px-4 py-4">
                    {editId === e.id ? <select value={editForm.status} onChange={ev => setEditForm({ ...editForm, status: ev.target.value })} className="rounded border px-2 py-1 text-sm">
                      <option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select> : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[e.status] || "bg-gray-100"}`}>{e.status}</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">{fmt(e.created_at)}</td>
                  <td className="px-4 py-4 text-right">
                    {editId === e.id ? <div className="flex justify-end gap-2">
                      <button onClick={save} className="text-sm font-medium text-emerald-600">Save</button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-400">Cancel</button>
                    </div> : <div className="flex justify-end gap-1">
                      <button onClick={() => setViewing(e)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="View details">👁️</button>
                      <button onClick={() => { setEditId(e.id); setEditForm({ status: e.status, notes: e.notes || "" }) }} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                      <button onClick={() => del(e.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                    </div>}
                  </td>
                </tr>))}</tbody>
            </table></div>
          </div>}
      </section>

      {viewing && (
        <SubmissionDetailModal
          data={viewing}
          title={`${viewing.first_name || ""} ${viewing.last_name || ""}`.trim() || "Enrollment"}
          subtitle={`Enrollment submitted ${fmt(viewing.created_at)}`}
          sections={ENROLLMENT_SECTIONS}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  )
}
