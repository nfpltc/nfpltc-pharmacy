"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface CreditCard {
  id: string; first_name: string; last_name: string; email: string; phone: string
  account_number: string; card_type: string; card_last4: string; card_exp: string
  cardholder_name: string; status: string; notes: string | null; created_at: string
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", verified: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
}

export default function AdminCreditCardsPage() {
  const [items, setItems] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ status: "", notes: "" })

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/credit-cards"); const d = await r.json()
      if (r.ok) setItems(d.submissions || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!editId) return
    try { const r = await fetch("/api/admin/credit-cards", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...editForm }) })
      if (r.ok) { setMsg({ ok: true, text: "Updated!" }); setEditId(null); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const del = async (id: string) => {
    if (!confirm("Delete this submission?")) return
    try { const r = await fetch(`/api/admin/credit-cards?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = items.filter(s => (filter === "all" || s.status === filter) &&
    (!search || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.account_number || "").includes(search) || (s.card_last4 || "").includes(search)))

  const c = { t: items.length, p: items.filter(s => s.status === "pending").length,
    v: items.filter(s => s.status === "verified").length, co: items.filter(s => s.status === "completed").length }

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <div>
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Pending", v: c.p, c: "text-yellow-600" }, { l: "Verified", v: c.v, c: "text-blue-600" }, { l: "Completed", v: c.co, c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by name, account, or card..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2">
            {["all", "pending", "verified", "completed"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No submissions found</h3></div>
        : <div className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="border-b bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Account #</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Card</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y">{list.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4"><p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p><p className="text-sm text-gray-500">{s.email}</p></td>
                  <td className="px-4 py-4 text-sm text-gray-600">{s.account_number || "—"}</td>
                  <td className="px-4 py-4"><p className="text-sm text-gray-900">{s.card_type || "Card"} ****{s.card_last4}</p><p className="text-xs text-gray-500">Exp: {s.card_exp}</p></td>
                  <td className="px-4 py-4">
                    {editId === s.id ? <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="rounded border px-2 py-1 text-sm">
                      <option value="pending">Pending</option><option value="verified">Verified</option><option value="completed">Completed</option>
                    </select> : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[s.status] || "bg-gray-100"}`}>{s.status}</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">{fmt(s.created_at)}</td>
                  <td className="px-4 py-4 text-right">
                    {editId === s.id ? <div className="flex justify-end gap-2">
                      <button onClick={save} className="text-sm font-medium text-emerald-600">Save</button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-400">Cancel</button>
                    </div> : <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditId(s.id); setEditForm({ status: s.status, notes: s.notes || "" }) }} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                      <button onClick={() => del(s.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                    </div>}
                  </td>
                </tr>))}</tbody>
            </table></div>
          </div>}
      
    </div>
  )
}
