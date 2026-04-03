"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

interface Job {
  id: string; title: string; department: string; location: string; type: string
  salary_range: string; description: string; requirements: string[]; responsibilities: string[]
  benefits: string[]; status: string; created_at: string
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [deptFilter, setDeptFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  useEffect(() => {
    fetch("/api/jobs").then(r => r.json()).then(d => setJobs(d.jobs || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const departments = ["all", ...new Set(jobs.map(j => j.department))]
  const types = ["all", ...new Set(jobs.map(j => j.type))]
  const filtered = jobs.filter(j =>
    (deptFilter === "all" || j.department === deptFilter) &&
    (typeFilter === "all" || j.type === typeFilter))

  const timeAgo = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (days === 0) return "Today"; if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`; if (days < 30) return `${Math.floor(days/7)} weeks ago`
    return `${Math.floor(days/30)} months ago`
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm text-white ring-1 ring-white/25">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              {loading ? "Loading..." : `${jobs.length} open position${jobs.length !== 1 ? "s" : ""}`}
            </div>
            <h1 className="text-4xl font-semibold text-white md:text-5xl">Join Our Team</h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">Build your career at North Falmouth Pharmacy. We&apos;re looking for passionate individuals who share our commitment to exceptional long-term care.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4 rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 outline-none">
              <option value="all">All Departments</option>
              {departments.filter(d => d !== "all").map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Job Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 outline-none">
              <option value="all">All Types</option>
              {types.filter(t => t !== "all").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setDeptFilter("all"); setTypeFilter("all") }} className="h-11 rounded-lg border border-gray-200 px-5 text-sm font-medium text-gray-600 hover:bg-gray-50">Clear</button>
          </div>
        </div>

        {/* Jobs */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white py-16 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{jobs.length === 0 ? "No open positions" : "No matching positions"}</h3>
            <p className="text-gray-500 mb-4">{jobs.length === 0 ? "Check back soon for new openings!" : "Try adjusting your filters."}</p>
            {jobs.length > 0 && <button onClick={() => { setDeptFilter("all"); setTypeFilter("all") }} className="text-emerald-600 font-medium">Clear filters</button>}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(job => (
              <div key={job.id} className="overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm hover:shadow-md transition">
                <div className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">📍 {job.location}</span>
                        <span className="flex items-center gap-1">🏢 {job.department}</span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{job.type}</span>
                        <span className="text-gray-400">{timeAgo(job.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-900">{job.salary_range}</span>
                      <Link href={`/careers/apply?jobId=${job.id}&title=${encodeURIComponent(job.title)}`} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition">Apply Now</Link>
                      <button onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)} className="p-2 text-gray-400 hover:text-gray-600">
                        <svg className={`h-5 w-5 transition-transform ${expandedJob === job.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {expandedJob === job.id && (
                  <div className="border-t bg-gray-50 px-6 pb-6 pt-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <h4 className="mb-2 font-semibold text-gray-900">About This Role</h4>
                        <p className="mb-6 text-gray-600">{job.description}</p>
                        {job.responsibilities?.length > 0 && <>
                          <h4 className="mb-2 font-semibold text-gray-900">Responsibilities</h4>
                          <ul className="mb-6 space-y-2">{job.responsibilities.map((r, i) => <li key={i} className="flex items-start gap-2 text-gray-600"><span className="mt-1 text-emerald-500">✓</span>{r}</li>)}</ul>
                        </>}
                        {job.requirements?.length > 0 && <>
                          <h4 className="mb-2 font-semibold text-gray-900">Requirements</h4>
                          <ul className="space-y-2">{job.requirements.map((r, i) => <li key={i} className="flex items-start gap-2 text-gray-600"><span className="mt-1 text-emerald-500">✓</span>{r}</li>)}</ul>
                        </>}
                      </div>
                      {job.benefits?.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-semibold text-gray-900">Benefits</h4>
                          <ul className="space-y-2">{job.benefits.map((b, i) => <li key={i} className="flex items-start gap-2 text-gray-600"><span className="mt-1 text-emerald-500">✓</span>{b}</li>)}</ul>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 flex justify-end border-t pt-6">
                      <Link href={`/careers/apply?jobId=${job.id}&title=${encodeURIComponent(job.title)}`} className="rounded-full bg-gray-900 px-8 py-3 text-sm font-medium text-white hover:bg-gray-800">Apply for This Position</Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Why Join */}
        <div className="mt-16 rounded-xl border border-emerald-900/10 bg-white p-8 shadow-sm md:p-12">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">Why Join North Falmouth Pharmacy?</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: "👥", title: "Close-Knit Team", desc: "Work alongside experienced professionals who care about your growth and success." },
              { icon: "💚", title: "Meaningful Work", desc: "Make a real difference in patients' lives at long-term care facilities across Cape Cod." },
              { icon: "📈", title: "Growth Opportunities", desc: "Continuing education support, competitive benefits, and room to advance your career." },
            ].map(item => (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">{item.icon}</div>
                <h3 className="mb-2 font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
