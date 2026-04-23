"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface LogRow {
  id: string
  account_number: string
  billing_period: string
  email_to: string
  resend_message_id: string | null
  status: string
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  created_at: string
}

function formatPeriod(p: string) {
  if (!p) return "—"
  const [y, m] = p.split("-")
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { year: "numeric", month: "long" })
}
function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

const STATUS_COLORS: Record<string, string> = {
  queued:     "bg-gray-100 text-gray-700",
  sent:       "bg-blue-50 text-blue-700",
  delivered:  "bg-emerald-50 text-emerald-700",
  bounced:    "bg-red-50 text-red-700",
  complained: "bg-amber-50 text-amber-800",
  failed:     "bg-red-50 text-red-700",
  skipped:    "bg-gray-50 text-gray-500",
}

export default function AdminEmailLogPage() {
  const [log, setLog] = useState<LogRow[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [periods, setPeriods] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      const r = await fetch("/api/admin/statements")
      const d = await r.json()
      if (r.ok && d.periods) setPeriods(d.periods)
    })()
  }, [])

  useEffect(() => { load() }, [periodFilter, statusFilter])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (periodFilter) params.append("period", periodFilter)
      if (statusFilter) params.append("status", statusFilter)
      const r = await fetch(`/api/admin/statements/send-log?${params}`)
      const d = await r.json()
      if (r.ok) {
        setLog(d.log || [])
        setSummary(d.summary || {})
      }
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }} className="px-6 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/admin/customers" className="mb-2 inline-flex items-center gap-1 text-sm opacity-90 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Link>
          <h1 className="text-3xl font-bold">Email Send History</h1>
          <p className="mt-1 text-sm opacity-90">Track statement emails sent to customers</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl p-6">
        {/* Summary chips */}
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {Object.entries(summary).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
              className={`rounded-full px-3 py-1 ring-1 ring-black/5 ${STATUS_COLORS[status] || "bg-gray-100"} ${statusFilter === status ? "ring-2 ring-offset-1 ring-[#0B7C79]" : ""}`}
            >
              {status}: <strong>{count}</strong>
            </button>
          ))}
          {(periodFilter || statusFilter) && (
            <button onClick={() => { setPeriodFilter(""); setStatusFilter("") }}
              className="text-xs text-gray-500 underline hover:text-gray-700">
              Clear filters
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All periods</option>
            {periods.map(p => <option key={p} value={p}>{formatPeriod(p)}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Account #</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : log.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No emails sent yet.</td></tr>
              ) : log.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] || "bg-gray-100"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.account_number}</td>
                  <td className="px-4 py-3 text-gray-600">{row.email_to}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPeriod(row.billing_period)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(row.sent_at || row.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-red-700">{row.error_message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
