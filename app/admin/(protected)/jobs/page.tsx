"use client"
import { useState, useEffect } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────
interface Job {
  id: string; title: string; department: string; location: string; type: string
  salary_range: string; description: string; responsibilities: string[]
  requirements: string[]; benefits: string[]; status: string; is_active: boolean; created_at: string
}
interface Candidate {
  id: string; job_title: string; first_name: string; last_name: string; email: string; phone: string
  address: string; city: string; state: string; zip: string; linkedin: string; portfolio: string
  current_employer: string; current_title: string; years_experience: string; highest_education: string
  licenses: string; cover_letter: string; how_heard: string; start_date: string; salary_expectation: string
  authorized_to_work: boolean; require_sponsorship: boolean; resume_url: string; resume_filename: string
  resume_signed_url: string | null; status: string; notes: string; created_at: string
}

const jobStatusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  draft:  "bg-gray-100 text-gray-600",
  closed: "bg-red-100 text-red-700",
}
const candStatusColors: Record<string, string> = {
  new:         "bg-blue-100 text-blue-700",
  reviewed:    "bg-yellow-100 text-yellow-700",
  interviewed: "bg-purple-100 text-purple-700",
  hired:       "bg-emerald-100 text-emerald-700",
  rejected:    "bg-red-100 text-red-700",
}

const emptyForm = {
  title: "", department: "Pharmacy", location: "North Falmouth, MA 02556",
  type: "Full-time", salary_range: "", description: "",
  responsibilities: "", requirements: "", benefits: "", status: "active",
}

const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminJobsPage() {
  const [tab, setTab] = useState<"jobs" | "candidates">("jobs")

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobMsg, setJobMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [jobFilter, setJobFilter] = useState("all")
  const [jobSearch, setJobSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candLoading, setCandLoading] = useState(true)
  const [candMsg, setCandMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [candFilter, setCandFilter] = useState("all")
  const [candSearch, setCandSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadJobs(); loadCandidates() }, [])

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const loadJobs = async () => {
    try { const r = await fetch("/api/admin/jobs"); const d = await r.json(); if (r.ok) setJobs(d.jobs || []) }
    catch { setJobMsg({ ok: false, text: "Failed to load jobs" }) }
    finally { setJobsLoading(false) }
  }

  const saveJob = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form,
      responsibilities: form.responsibilities.split("\n").filter(s => s.trim()),
      requirements: form.requirements.split("\n").filter(s => s.trim()),
      benefits: form.benefits.split("\n").filter(s => s.trim()),
    }
    try {
      const r = await fetch("/api/admin/jobs", { method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      if (r.ok) { setJobMsg({ ok: true, text: editing ? "Updated!" : "Posted!" }); closeForm(); loadJobs() }
      else { const d = await r.json(); setJobMsg({ ok: false, text: d.error || "Failed" }) }
    } catch { setJobMsg({ ok: false, text: "Error saving" }) }
  }

  const editJob = (j: Job) => {
    setEditing(j)
    setForm({ title: j.title, department: j.department, location: j.location,
      type: j.type, salary_range: j.salary_range || "", description: j.description,
      responsibilities: (j.responsibilities || []).join("\n"),
      requirements: (j.requirements || []).join("\n"),
      benefits: (j.benefits || []).join("\n"), status: j.status })
    setShowForm(true)
  }

  const delJob = async (id: string) => {
    if (!confirm("Delete this job?")) return
    try { const r = await fetch(`/api/admin/jobs?id=${id}`, { method: "DELETE" })
      if (r.ok) { setJobMsg({ ok: true, text: "Deleted" }); loadJobs() }
    } catch { setJobMsg({ ok: false, text: "Failed" }) }
  }

  const setJobStatus = async (id: string, status: string) => {
    await fetch("/api/admin/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    loadJobs()
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm) }

  const jobList = jobs.filter(j => (jobFilter === "all" || j.status === jobFilter) &&
    (!jobSearch || j.title.toLowerCase().includes(jobSearch.toLowerCase()) || j.department.toLowerCase().includes(jobSearch.toLowerCase())))
  const jc = { t: jobs.length, a: jobs.filter(j => j.status === "active").length, d: jobs.filter(j => j.status === "draft").length, x: jobs.filter(j => j.status === "closed").length }

  // ── Candidates ────────────────────────────────────────────────────────────
  const loadCandidates = async () => {
    try { const r = await fetch("/api/admin/candidates"); const d = await r.json(); if (r.ok) setCandidates(d.candidates || []) }
    catch { setCandMsg({ ok: false, text: "Failed to load applications" }) }
    finally { setCandLoading(false) }
  }

  const updateCandStatus = async (id: string, status: string) => {
    await fetch("/api/admin/candidates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    loadCandidates()
  }

  const delCand = async (id: string) => {
    if (!confirm("Delete this application?")) return
    try { const r = await fetch(`/api/admin/candidates?id=${id}`, { method: "DELETE" })
      if (r.ok) { setCandMsg({ ok: true, text: "Deleted" }); loadCandidates() }
    } catch { setCandMsg({ ok: false, text: "Failed" }) }
  }

  const candList = candidates.filter(c => (candFilter === "all" || (c.status || "new") === candFilter) &&
    (!candSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(candSearch.toLowerCase()) ||
      (c.job_title || "").toLowerCase().includes(candSearch.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(candSearch.toLowerCase())))
  const cc = { t: candidates.length, n: candidates.filter(c => !c.status || c.status === "new").length,
    r: candidates.filter(c => c.status === "reviewed").length,
    i: candidates.filter(c => c.status === "interviewed").length,
    h: candidates.filter(c => c.status === "hired").length }

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button onClick={() => setTab("jobs")}
            className={"rounded-lg px-5 py-2 text-sm font-medium transition-all " + (tab === "jobs" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50")}>
            Job Postings <span className={"ml-1.5 rounded-full px-2 py-0.5 text-xs " + (tab === "jobs" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>{jc.t}</span>
          </button>
          <button onClick={() => setTab("candidates")}
            className={"rounded-lg px-5 py-2 text-sm font-medium transition-all " + (tab === "candidates" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50")}>
            Applications <span className={"ml-1.5 rounded-full px-2 py-0.5 text-xs " + (tab === "candidates" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>{cc.t}</span>
          </button>
        </div>
        {tab === "jobs" && (
          <button onClick={() => { closeForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B7C79] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a6b68]">
            + Post New Job
          </button>
        )}
      </div>

      {/* ── JOBS TAB ── */}
      {tab === "jobs" && (
        <div className="space-y-5">
          {jobMsg && <div className={"flex items-center justify-between rounded-lg border p-4 text-sm " + (jobMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}><span>{jobMsg.text}</span><button onClick={() => setJobMsg(null)}>×</button></div>}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[{ l: "Total", v: jc.t, c: "text-gray-900" }, { l: "Active", v: jc.a, c: "text-emerald-600" }, { l: "Draft", v: jc.d, c: "text-gray-500" }, { l: "Closed", v: jc.x, c: "text-red-600" }].map(s => (
              <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className={"text-2xl font-bold " + s.c}>{s.v}</p>
                <p className="text-sm text-gray-500">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search jobs..."
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-sm" />
            <div className="flex gap-2">
              {["all", "active", "draft", "closed"].map(f => (
                <button key={f} onClick={() => setJobFilter(f)}
                  className={"rounded-xl px-3 py-2 text-sm font-medium " + (jobFilter === f ? "bg-[#0B7C79] text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Job list */}
          {jobsLoading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
          : jobList.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400">No jobs found. <button onClick={() => setShowForm(true)} className="text-[#0B7C79] underline">Post one?</button></div>
          : <div className="space-y-3">
              {jobList.map(j => (
                <div key={j.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">{j.title}</h3>
                        <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + (jobStatusColors[j.status] || "bg-gray-100")}>{j.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{j.department} · {j.location} · {j.type}{j.salary_range ? ` · ${j.salary_range}` : ""}</p>
                      <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{j.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={j.status} onChange={e => setJobStatus(j.id, e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                        <option value="active">Active</option><option value="draft">Draft</option><option value="closed">Closed</option>
                      </select>
                      <button onClick={() => editJob(j)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600">✏️</button>
                      <button onClick={() => delJob(j.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* ── CANDIDATES TAB ── */}
      {tab === "candidates" && (
        <div className="space-y-5">
          {candMsg && <div className={"flex items-center justify-between rounded-lg border p-4 text-sm " + (candMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}><span>{candMsg.text}</span><button onClick={() => setCandMsg(null)}>×</button></div>}

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            {[{ l: "Total", v: cc.t, c: "text-gray-900" }, { l: "New", v: cc.n, c: "text-blue-600" }, { l: "Reviewed", v: cc.r, c: "text-yellow-600" }, { l: "Interviewed", v: cc.i, c: "text-purple-600" }, { l: "Hired", v: cc.h, c: "text-emerald-600" }].map(s => (
              <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className={"text-2xl font-bold " + s.c}>{s.v}</p>
                <p className="text-sm text-gray-500">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={candSearch} onChange={e => setCandSearch(e.target.value)} placeholder="Search by name, position or email..."
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-sm" />
            <div className="flex flex-wrap gap-2">
              {["all","new","reviewed","interviewed","hired","rejected"].map(f => (
                <button key={f} onClick={() => setCandFilter(f)}
                  className={"rounded-xl px-3 py-2 text-sm font-medium " + (candFilter === f ? "bg-[#0B7C79] text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Candidate list */}
          {candLoading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
          : candList.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400">No applications found.</div>
          : <div className="space-y-3">
              {candList.map(c => (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="text-gray-400 hover:text-gray-600">
                      <svg className={"w-5 h-5 transition-transform " + (expandedId === c.id ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{c.first_name} {c.last_name}</h3>
                        <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + (candStatusColors[c.status || "new"] || "bg-gray-100 text-gray-600")}>{c.status || "new"}</span>
                      </div>
                      <p className="text-sm text-gray-600"><span className="font-medium">{c.job_title}</span> · {c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Applied {fmt(c.created_at)}{c.current_employer ? ` · Currently at ${c.current_employer}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={c.status || "new"} onChange={e => updateCandStatus(c.id, e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                        <option value="new">New</option><option value="reviewed">Reviewed</option><option value="interviewed">Interviewed</option><option value="hired">Hired</option><option value="rejected">Rejected</option>
                      </select>
                      <a href={`mailto:${c.email}?subject=Re: Your Application for ${c.job_title}`} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600">📧</a>
                      <button onClick={() => delCand(c.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">🗑️</button>
                    </div>
                  </div>
                  {expandedId === c.id && (
                    <div className="border-t bg-gray-50 p-4">
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
                    </div>
                  )}
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* ── Post/Edit Job Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? "Edit Job" : "Post New Job"}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={saveJob} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="e.g. Pharmacy Technician" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Department</label><input value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Location</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option>Full-time</option><option>Part-time</option><option>Full-time / Part-time</option><option>Contract</option><option>Per Diem</option></select></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Salary Range</label><input value={form.salary_range} onChange={e => setForm({...form, salary_range: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="e.g. $50k–$65k" /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Description *</label><textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Responsibilities (one per line)</label><textarea value={form.responsibilities} onChange={e => setForm({...form, responsibilities: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Requirements (one per line)</label><textarea value={form.requirements} onChange={e => setForm({...form, requirements: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Benefits (one per line)</label><textarea value={form.benefits} onChange={e => setForm({...form, benefits: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="active">Active</option><option value="draft">Draft</option><option value="closed">Closed</option></select></div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={closeForm} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#0B7C79] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a6b68]">{editing ? "Update" : "Post Job"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
