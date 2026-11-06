"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface DashboardData {
  customer: { first_name: string; last_name: string; account_number: string }
  summary: { current_balance: number; overdue_amount: number; total_paid: number; total_charged: number; statement_count: number }
  aging: { current: number; over_30: number; over_60: number; over_90: number; over_120: number } | null
  trend: { period: string; balance: number; charges: number; payments: number }[]
  statements: { id: string; billing_period: string; amount_due: number; balance: number; charges: number; payments: number; bill_date: string; file_url: string | null }[]
}

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) }
function fmtPeriod(p: string) {
  if (!p) return "—"
  const [y, m] = p.split("-")
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { year: "numeric", month: "short" })
}

function BarChart({ data }: { data: DashboardData["trend"] }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-8 text-center">No trend data yet</p>
  const maxVal = Math.max(...data.map(d => Math.max(d.balance, d.charges, d.payments)), 1)
  return (
    <div className="flex items-end gap-1.5 h-44 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end" style={{ height: "140px" }}>
            <div className="flex-1 rounded-t bg-emerald-500 transition-all" style={{ height: `${(d.payments / maxVal) * 140}px` }} title={`Payments: ${fmt(d.payments)}`} />
            <div className="flex-1 rounded-t bg-amber-400 transition-all" style={{ height: `${(d.charges / maxVal) * 140}px` }} title={`Charges: ${fmt(d.charges)}`} />
            <div className="flex-1 rounded-t bg-gray-300 transition-all" style={{ height: `${(d.balance / maxVal) * 140}px` }} title={`Balance: ${fmt(d.balance)}`} />
          </div>
          <span className="text-[10px] text-gray-400">{fmtPeriod(d.period)}</span>
        </div>
      ))}
    </div>
  )
}

function AgingBar({ aging }: { aging: DashboardData["aging"] }) {
  if (!aging) return null
  const total = aging.current + aging.over_30 + aging.over_60 + aging.over_90 + aging.over_120
  if (total <= 0) return null
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`
  const segments = [
    { label: "Current", value: aging.current, color: "bg-emerald-500" },
    { label: "30+ days", value: aging.over_30, color: "bg-amber-400" },
    { label: "60+ days", value: aging.over_60, color: "bg-orange-500" },
    { label: "90+ days", value: aging.over_90, color: "bg-red-500" },
    { label: "120+ days", value: aging.over_120, color: "bg-red-700" },
  ].filter(s => s.value > 0)

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div key={i} className={`${s.color} transition-all`} style={{ width: pct(s.value) }} title={`${s.label}: ${fmt(s.value)}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
            {s.label}: {fmt(s.value)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UserDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "statements">("overview")

  const load = useCallback(async () => {
    try {
      const [sessR, dashR] = await Promise.all([
        fetch("/api/user/session"),
        fetch("/api/user/dashboard"),
      ])
      const sess = await sessR.json()
      if (!sess.user) { router.replace("/user"); return }
      const dash = await dashR.json()
      if (dash.error) { router.replace("/user"); return }
      setData(dash)
    } catch { router.replace("/user") }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  const handleLogout = async () => {
    await fetch("/api/user/logout", { method: "POST" })
    router.replace("/user")
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5EF]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  const { customer, summary, aging, trend, statements } = data

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <header className="border-b border-emerald-900/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">NF</Link>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Welcome, {customer.first_name}</h1>
              <p className="text-xs text-gray-500">Account: {customer.account_number}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600 transition">Sign Out</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit">
          <button onClick={() => setActiveTab("overview")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition ${activeTab === "overview" ? "bg-emerald-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            Overview
          </button>
          <button onClick={() => setActiveTab("statements")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition ${activeTab === "statements" ? "bg-emerald-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            Statements
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Current Balance" value={fmt(summary.current_balance)} color={summary.current_balance > 0 ? "text-red-600" : "text-emerald-600"} icon="💰" />
              <SummaryCard label="Overdue Amount" value={fmt(summary.overdue_amount)} color={summary.overdue_amount > 0 ? "text-red-600" : "text-emerald-600"}
                sub={summary.overdue_amount > 0 ? "Action needed" : "All current"} icon="⏰" />
              <SummaryCard label="Total Paid" value={fmt(summary.total_paid)} color="text-emerald-600" icon="✅" />
              <SummaryCard label="Statements" value={String(summary.statement_count)} color="text-gray-900" sub="Monthly records" icon="📄" />
            </div>

            {/* Aging breakdown */}
            {aging && (aging.over_30 > 0 || aging.over_60 > 0 || aging.over_90 > 0 || aging.over_120 > 0) && (
              <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs">⚠️</span>
                  Aging Breakdown
                </h3>
                <AgingBar aging={aging} />
              </div>
            )}

            {/* Monthly trend */}
            <div className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-gray-900">Monthly Trend</h3>
              <p className="mb-4 text-xs text-gray-500">Payments vs charges vs balance — last 12 months</p>
              <div className="flex gap-4 mb-3">
                <span className="flex items-center gap-1 text-xs text-gray-500"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Payments</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Charges</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" /> Balance</span>
              </div>
              <BarChart data={trend} />
            </div>

            {/* Recent statements preview */}
            <div className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Recent Statements</h3>
                <button onClick={() => setActiveTab("statements")} className="text-xs text-emerald-600 hover:underline">View all →</button>
              </div>
              <div className="space-y-2">
                {statements.slice(0, 5).map(s => (
                  <StatementRow key={s.id} s={s} />
                ))}
                {statements.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No statements yet</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === "statements" && (
          <div className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">All Statements</h3>
            <div className="space-y-2">
              {statements.map(s => (
                <StatementRow key={s.id} s={s} full />
              ))}
              {statements.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No statements found for your account</p>}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="mx-auto max-w-6xl px-6 py-4 text-center text-xs text-gray-400">
          North Falmouth Pharmacy · (508) 564-4459 · HIPAA Protected
        </div>
      </footer>
    </div>
  )
}

function SummaryCard({ label, value, color, sub, icon }: { label: string; value: string; color: string; sub?: string; icon: string }) {
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function StatementRow({ s, full }: { s: DashboardData["statements"][0]; full?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 transition">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{fmtPeriod(s.billing_period)}</p>
          {full && (
            <p className="text-xs text-gray-500">
              Charges: {fmt(s.charges)} · Payments: {fmt(s.payments)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`text-sm font-bold ${s.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmt(s.balance || s.amount_due)}</p>
          {full && s.bill_date && <p className="text-[10px] text-gray-400">{new Date(s.bill_date).toLocaleDateString()}</p>}
        </div>
        {s.file_url ? (
          <a href={s.file_url} target="_blank" rel="noopener noreferrer"
            className="flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            PDF
          </a>
        ) : (
          <span className="text-[10px] text-gray-300">—</span>
        )}
      </div>
    </div>
  )
}
