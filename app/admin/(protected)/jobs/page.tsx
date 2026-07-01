"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Job {
  id: string
  title: string
  department: string
  location: string
  type: string
  salary_range: string
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  status: string
  is_active: boolean
  created_at: string
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  draft: "bg-gray-100 text-gray-600",
  closed: "bg-red-100 text-red-700",
}

const emptyForm = {
  title: "", department: "Pharmacy", location: "North Falmouth, MA 02556",
  type: "Full-time", salary_range: "", description: "",
  responsibilities: "", requirements: "", benefits: "", status: "active",
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const r = await fetch("/api/admin/jobs"); const d = await r.json()
      if (r.ok) setJobs(d.jobs || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form,
      responsibilities: form.responsibilities.split("\n").filter(s => s.trim()),
      requirements: form.requirements.split("\n").filter(s => s.trim()),
      benefits: form.benefits.split("\n").filter(s => s.trim()),
    }
    try {
      const r = await fetch("/api/admin/jobs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      if (r.ok) { setMsg({ ok: true, text: editing ? "Updated!" : "Posted!" }); close(); load() }
      else { const d = await r.json(); setMsg({ ok: false, text: d.error || "Failed" }) }
    } catch { setMsg({ ok: false, text: "Error saving" }) }
  }

  const edit = (j: Job) => {
    setEditing(j)
    setForm({ title: j.title, department: j.department, location: j.location,
      type: j.type, salary_range: j.salary_range || "", description: j.description,
      responsibilities: (j.responsibilities || []).join("\n"),
      requirements: (j.requirements || []).join("\n"),
      benefits: (j.benefits || []).join("\n"), status: j.status })
    setShowForm(true)
  }

  const del = async (id: string) => {
    if (!confirm("Delete this job?")) return
    try { const r = await fetch(`/api/admin/jobs?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const setStatus = async (id: string, status: string) => {
    await fetch("/api/admin/jobs", { method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }) })
    load()
  }

  const close = () => { setShowForm(false); setEditing(null); setForm(emptyForm) }

  const list = jobs.filter(j => (filter === "all" || j.status === filter) &&
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())))

  const c = { t: jobs.length, a: jobs.filter(j => j.status === "active").length,
    d: jobs.filter(j => j.status === "draft").length, x: jobs.filter(j => j.status === "closed").length }

  return (
    <div>
        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ l: "Total", v: c.t, c: "text-gray-900" }, { l: "Active", v: c.a, c: "text-emerald-600" }, { l: "Draft", v: c.d, c: "text-gray-500" }, { l: "Closed", v: c.x, c: "text-red-600" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.c}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2">
            {["all", "active", "draft", "closed"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        <button onClick={() => { close(); setShowForm(true) }} className="mb-6 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white sm:hidden">+ Post New Job</button>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium">No jobs found</h3><button onClick={() => setShowForm(true)} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">Post New Job</button></div>
        : <div className="space-y-4">{list.map(j => (
            <div key={j.id} className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{j.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[j.status] || "bg-gray-100"}`}>{j.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{j.department} · {j.location} · {j.type}{j.salary_range ? ` · ${j.salary_range}` : ""}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{j.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={j.status} onChange={e => setStatus(j.id, e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
                    <option value="active">Active</option><option value="draft">Draft</option><option value="closed">Closed</option>
                  </select>
                  <button onClick={() => edit(j)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                  <button onClick={() => del(j.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                </div>
              </div>
            </div>))}</div>}
      

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
        <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editing ? "Edit Job" : "Post New Job"}</h3>
            <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium">Job Title *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. Pharmacy Technician" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium">Department *</label><input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-sm font-medium">Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm"><option>Full-time</option><option>Part-time</option><option>Full-time / Part-time</option><option>Contract</option><option>Per Diem</option></select></div>
              <div><label className="mb-1 block text-sm font-medium">Salary Range</label><input value={form.salary_range} onChange={e => setForm({ ...form, salary_range: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. $50k-$65k" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium">Description *</label><textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} /></div>
            <div><label className="mb-1 block text-sm font-medium">Responsibilities (one per line)</label><textarea value={form.responsibilities} onChange={e => setForm({ ...form, responsibilities: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder={"Prepare and dispense medications\nMaintain records\nCollaborate with team"} /></div>
            <div><label className="mb-1 block text-sm font-medium">Requirements (one per line)</label><textarea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder={"Pharmacy Technician certification\n1+ years experience"} /></div>
            <div><label className="mb-1 block text-sm font-medium">Benefits (one per line)</label><textarea value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder={"Health insurance\nPaid time off"} /></div>
            <div><label className="mb-1 block text-sm font-medium">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="active">Active</option><option value="draft">Draft</option><option value="closed">Closed</option></select></div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={close} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-700 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-800">{editing ? "Update" : "Post Job"}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  )
}
