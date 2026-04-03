"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Subscriber {
  id: string; email: string; status: string; source: string | null
  subscribed_at: string; created_at: string
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700", unsubscribed: "bg-gray-100 text-gray-600",
}

export default function AdminSubscribersPage() {
  const [items, setItems] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/subscribers"); const d = await r.json()
      if (r.ok) setItems(d.subscribers || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const del = async (id: string) => {
    if (!confirm("Remove this subscriber?")) return
    try { const r = await fetch(`/api/admin/subscribers?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Removed" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const exportEmails = () => {
    const emails = items.filter(s => s.status === "active").map(s => s.email).join("\n")
    const blob = new Blob([emails], { type: "text/plain" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `subscribers-${new Date().toISOString().split("T")[0]}.txt`; a.click()
    setMsg({ ok: true, text: `Exported ${items.filter(s => s.status === "active").length} emails` })
  }

  const exportCSV = () => {
    const rows = [["Email", "Status", "Source", "Date"], ...items.map(s => [s.email, s.status, s.source || "", new Date(s.subscribed_at || s.created_at).toLocaleDateString()])]
    const csv = rows.map(r => r.join(",")).join("\n")
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`; a.click()
    setMsg({ ok: true, text: "CSV exported" })
  }

  const list = items.filter(s => (filter === "all" || s.status === filter) && (!search || s.email.toLowerCase().includes(search.toLowerCase())))
  const c = { t: items.length, a: items.filter(s => s.status === "active").length, u: items.filter(s => s.status === "unsubscribed").length }
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Newsletter Subscribers</h1>
              <p className="mt-2 text-white/90">{c.t} total · {c.a} active</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <button onClick={exportCSV} className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/30">Export CSV</button>
              <button onClick={exportEmails} className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/30">Export Emails</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-3 gap-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Active", v: c.a, c: "text-emerald-600" }, { l: "Unsubscribed", v: c.u, c: "text-gray-500" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by email..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2">
            {["all", "active", "unsubscribed"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        <div className="flex gap-2 mb-6 sm:hidden">
          <button onClick={exportCSV} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">Export CSV</button>
          <button onClick={exportEmails} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium">Export Emails</button>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No subscribers found</h3></div>
        : <div className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subscribed</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y">{list.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[s.status] || "bg-gray-100"}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.source || "Website"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{fmt(s.subscribed_at || s.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del(s.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove">🗑️</button>
                  </td>
                </tr>))}</tbody>
            </table>
          </div>}
      </section>
    </main>
  )
}
