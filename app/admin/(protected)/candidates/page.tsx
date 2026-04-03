"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Candidate {
  id: string; job_title: string; first_name: string; last_name: string; email: string; phone: string
  address: string; city: string; state: string; zip: string; linkedin: string; portfolio: string
  current_employer: string; current_title: string; years_experience: string; highest_education: string
  licenses: string; cover_letter: string; how_heard: string; start_date: string; salary_expectation: string
  authorized_to_work: boolean; require_sponsorship: boolean; resume_url: string; resume_filename: string; resume_signed_url: string | null
  status: string; notes: string; created_at: string
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700", reviewed: "bg-yellow-100 text-yellow-700",
  interviewed: "bg-purple-100 text-purple-700", hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
}

export default function AdminCandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/candidates"); const d = await r.json()
      if (r.ok) setItems(d.candidates || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/candidates", { method: "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    load()
  }

  const del = async (id: string) => {
    if (!confirm("Delete this application?")) return
    try { const r = await fetch(`/api/admin/candidates?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = items.filter(c => (filter === "all" || (c.status || "new") === filter) &&
    (!search || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.job_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())))

  const st = { t: items.length, n: items.filter(c => !c.status || c.status === "new").length,
    r: items.filter(c => c.status === "reviewed").length, i: items.filter(c => c.status === "interviewed").length,
    h: items.filter(c => c.status === "hired").length }

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 56px" }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Job Applications</h1>
          <p className="mt-2 text-white/90">{st.t} total · {st.n} new · {st.h} hired</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[{ l: "Total", v: st.t, c: "text-gray-900" }, { l: "New", v: st.n, c: "text-blue-600" }, { l: "Reviewed", v: st.r, c: "text-yellow-600" }, { l: "Interviewed", v: st.i, c: "text-purple-600" }, { l: "Hired", v: st.h, c: "text-emerald-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by name, position, or email..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2 flex-wrap">
            {["all", "new", "reviewed", "interviewed", "hired", "rejected"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No applications found</h3></div>
        : <div className="space-y-3">{list.map(c => (
            <div key={c.id} className="rounded-xl border border-emerald-900/10 bg-white shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="text-gray-400 hover:text-gray-600">
                  <svg className={`w-5 h-5 transition-transform ${expandedId === c.id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{c.first_name} {c.last_name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[c.status || "new"] || "bg-gray-100"}`}>{(c.status || "new")}</span>
                  </div>
                  <p className="text-sm text-gray-600"><span className="font-medium">{c.job_title}</span> · {c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-1">Applied {fmt(c.created_at)}{c.current_employer ? ` · Currently at ${c.current_employer}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={c.status || "new"} onChange={e => updateStatus(c.id, e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
                    <option value="new">New</option><option value="reviewed">Reviewed</option><option value="interviewed">Interviewed</option><option value="hired">Hired</option><option value="rejected">Rejected</option>
                  </select>
                  <a href={`mailto:${c.email}?subject=Re: Your Application for ${c.job_title}`} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Email">📧</a>
                  <button onClick={() => del(c.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                </div>
              </div>
              {expandedId === c.id && <div className="border-t bg-gray-50 p-4">
                <div className="grid md:grid-cols-3 gap-6 text-sm">
                  <div><h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Personal Info</h4>
                    <div className="space-y-1">
                      <p>{c.email}</p><p>{c.phone || "No phone"}</p>
                      {c.address && <p>{c.address}, {c.city}, {c.state} {c.zip}</p>}
                      {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline block">LinkedIn Profile</a>}
                      {c.portfolio && <a href={c.portfolio} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline block">Portfolio</a>}
                    </div>
                  </div>
                  <div><h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Professional</h4>
                    <div className="space-y-1">
                      <p><span className="font-medium">{c.current_title || "—"}</span>{c.current_employer ? ` at ${c.current_employer}` : ""}</p>
                      <p>{c.years_experience || "—"} years experience</p>
                      <p>Education: {c.highest_education || "—"}</p>
                      <p>Licenses: {c.licenses || "—"}</p>
                      <p>Salary: {c.salary_expectation || "—"}</p>
                      <p>Available: {fmt(c.start_date)}</p>
                    </div>
                  </div>
                  <div><h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Work Auth</h4>
                    <div className="space-y-1">
                      <p>{c.authorized_to_work ? "✅ Authorized to work in US" : "❌ Not authorized"}</p>
                      <p>{c.require_sponsorship ? "⚠️ Requires sponsorship" : "✅ No sponsorship needed"}</p>
                      <p>How heard: {c.how_heard || "—"}</p>
                      {(c.resume_signed_url || c.resume_url) && <a href={c.resume_signed_url || c.resume_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-200">📄 View Resume</a>}
                    </div>
                  </div>
                </div>
                {c.cover_letter && <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Cover Letter</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap rounded-lg border bg-white p-4">{c.cover_letter}</p>
                </div>}
              </div>}
            </div>))}</div>}
      </section>
    </main>
  )
}
