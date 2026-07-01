"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Contact {
  id: string; first_name: string; last_name: string; email: string; phone: string
  message: string; status: string; notes: string | null; created_at: string
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700", read: "bg-yellow-100 text-yellow-700",
  replied: "bg-emerald-100 text-emerald-700", archived: "bg-gray-100 text-gray-600",
}

export default function AdminContactsPage() {
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [viewItem, setViewItem] = useState<Contact | null>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/contacts"); const d = await r.json()
      if (r.ok) setItems(d.submissions || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/contacts?id=${id}`, { method: "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    load()
  }

  const del = async (id: string) => {
    if (!confirm("Delete this message?")) return
    try { const r = await fetch(`/api/admin/contacts?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); setViewItem(null); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const view = (c: Contact) => {
    setViewItem(c)
    if (c.status === "new") updateStatus(c.id, "read")
  }

  const list = items.filter(c => (filter === "all" || c.status === filter))
  const nc = items.filter(c => c.status === "new").length
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <div>
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: items.length, c: "text-gray-900" }, { l: "New", v: nc, c: "text-blue-600" },
            { l: "Read", v: items.filter(c => c.status === "read").length, c: "text-yellow-600" },
            { l: "Replied", v: items.filter(c => c.status === "replied").length, c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          {["all", "new", "read", "replied", "archived"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No messages found</h3></div>
        : <div className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="border-b bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y">{list.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.status === "new" ? "bg-blue-50/30" : ""}`}>
                  <td className="px-4 py-4 font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-4 text-sm"><a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a></td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{c.message}</td>
                  <td className="px-4 py-4">
                    <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)} className={`rounded-lg px-2 py-1 text-xs font-medium border-0 ${statusColors[c.status] || "bg-gray-100"}`}>
                      <option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option><option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">{fmt(c.created_at)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => view(c)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="View">👁️</button>
                      <a href={`mailto:${c.email}?subject=Re: Your message to North Falmouth Pharmacy`} onClick={() => updateStatus(c.id, "replied")} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Reply">↩️</a>
                      <button onClick={() => del(c.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>))}</tbody>
            </table></div>
          </div>}
      

      {viewItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b p-6">
            <h2 className="text-xl font-semibold">Contact Details</h2>
            <button onClick={() => setViewItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Name</p><p className="font-medium">{viewItem.first_name} {viewItem.last_name}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[viewItem.status]}`}>{viewItem.status}</span></div>
            </div>
            <div><p className="text-xs text-gray-500">Email</p><a href={`mailto:${viewItem.email}`} className="text-blue-600 hover:underline">{viewItem.email}</a></div>
            {viewItem.phone && <div><p className="text-xs text-gray-500">Phone</p><p>{viewItem.phone}</p></div>}
            <div><p className="text-xs text-gray-500">Message</p><div className="mt-1 rounded-lg bg-gray-50 p-4 text-gray-700 whitespace-pre-wrap">{viewItem.message}</div></div>
            {viewItem.notes && <div><p className="text-xs text-gray-500">Admin Notes</p><div className="mt-1 rounded-lg bg-purple-50 p-4 text-purple-800 text-sm whitespace-pre-wrap">{viewItem.notes}</div></div>}
            <div><p className="text-xs text-gray-500">Submitted</p><p className="text-sm">{fmt(viewItem.created_at)}</p></div>
          </div>
          <div className="flex gap-3 border-t p-6">
            <a href={`mailto:${viewItem.email}?subject=Re: Your message to North Falmouth Pharmacy`} onClick={() => { updateStatus(viewItem.id, "replied"); setViewItem(null) }}
              className="flex-1 flex h-10 items-center justify-center rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800">Reply</a>
            <button onClick={() => setViewItem(null)} className="h-10 rounded-lg border border-gray-300 px-4 text-gray-600 hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
