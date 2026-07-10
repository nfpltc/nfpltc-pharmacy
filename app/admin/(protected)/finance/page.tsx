"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Wallet, TrendingUp, AlertTriangle, Building2, Loader2, Plus, Trash2, DollarSign,
} from "lucide-react"

type Month = {
  month_ym: string; revenue: number; collected: number; outstanding: number
  over_30: number; over_60: number; over_90: number; over_120: number
  overdue_count: number; customers: number; expenses: number
}
type Facility = { facility: string; overdue: number }
type Expense = { id: string; month_ym: string; category: string; label: string | null; amount: number }

const usd = (v: number) => "$" + Math.round(v || 0).toLocaleString()
const label = (ym: string) => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split("-")
  return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
const shortLabel = (ym: string) => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split("-")
  return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export default function FinancePage() {
  const [months, setMonths] = useState<Month[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [sel, setSel] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/finance/summary")
      const d = await r.json()
      setMonths(d.months || [])
      setFacilities(d.facilities || [])
      setExpenses(d.expenses || [])
      if (!sel && d.months?.length) setSel(d.months[0].month_ym)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // `sel` is a month_ym, or an aggregate scope: __ytd / __6mo / __all.
  const isAgg = ["__ytd", "__6mo", "__all"].includes(sel)
  const rangeMonths = useMemo(() => {
    if (!months.length) return []
    if (sel === "__all") return months
    if (sel === "__6mo") return months.slice(0, 6)
    if (sel === "__ytd") { const yr = months[0].month_ym.slice(0, 4); return months.filter((m) => m.month_ym.slice(0, 4) === yr) }
    return []
  }, [months, sel])

  // For an aggregate scope, revenue/collected/expenses are SUMMED across the
  // range, while outstanding/overdue are point-in-time — the latest month in
  // range (you can't add running balances across months).
  const cur = useMemo(() => {
    if (isAgg && rangeMonths.length) {
      const latest = rangeMonths[0]
      const sum = (k: keyof Month) => rangeMonths.reduce((s, m) => s + (Number(m[k]) || 0), 0)
      return {
        month_ym: sel, revenue: sum("revenue"), collected: sum("collected"), expenses: sum("expenses"),
        outstanding: latest.outstanding, over_30: latest.over_30, over_60: latest.over_60,
        over_90: latest.over_90, over_120: latest.over_120, overdue_count: latest.overdue_count, customers: latest.customers,
      } as Month
    }
    return months.find((m) => m.month_ym === sel) || months[0]
  }, [months, sel, rangeMonths, isAgg])

  const overdueTotal = cur ? cur.over_30 + cur.over_60 + cur.over_90 + cur.over_120 : 0
  const collRate = cur && cur.revenue ? Math.round((cur.collected / cur.revenue) * 100) : 0
  const net = cur ? cur.revenue - (cur.expenses || 0) : 0
  const maxRev = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.collected)))
  const maxAge = cur ? Math.max(1, cur.over_30, cur.over_60, cur.over_90, cur.over_120) : 1
  const maxFac = Math.max(1, ...facilities.map((f) => f.overdue))
  const drillMonth = isAgg ? (rangeMonths[0]?.month_ym || "") : sel
  const scopeLabel = isAgg
    ? (rangeMonths.length ? `${shortLabel(rangeMonths[rangeMonths.length - 1].month_ym)} – ${shortLabel(rangeMonths[0].month_ym)}` : "")
    : label(sel)

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>

  if (!months.length) return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      <Wallet className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-800">No financial data yet</h2>
      <p className="mt-2 text-sm text-gray-500">Upload a monthly statement PDF with the <b>“One monthly PDF”</b> option. Revenue, collections, and overdue balances will appear here.</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><Wallet className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Money</h1>
            <p className="text-sm text-gray-500">{isAgg ? `Totals across ${scopeLabel} — sales & collections summed; owed/overdue as of the latest month.` : "Revenue, collections, and overdue — from your monthly statements."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/finance/overdue${drillMonth ? `?month=${drillMonth}` : ""}`} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100">
            <AlertTriangle className="h-4 w-4" /> Overdue customers
          </Link>
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="__ytd">Year to date</option>
            <option value="__6mo">Last 6 months</option>
            <option value="__all">All time</option>
            <option disabled>──────────</option>
            {months.map((m) => <option key={m.month_ym} value={m.month_ym}>{label(m.month_ym)}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Revenue" value={usd(cur?.revenue || 0)} sub={isAgg ? `sales · ${scopeLabel}` : "this month's sales"} />
        <Kpi label="Collected" value={usd(cur?.collected || 0)} sub={`${collRate}% of revenue`} subClass="text-emerald-600" />
        <Kpi label="Outstanding" value={usd(cur?.outstanding || 0)} sub={isAgg ? `as of ${shortLabel(drillMonth)}` : "total owed"} />
        <Kpi label="Overdue" value={usd(overdueTotal)} sub={`${cur?.overdue_count || 0} customers`} valueClass="text-red-600" subClass="text-red-500" />
        <Kpi label={cur && cur.expenses ? "Net (after expenses)" : "Over 120 days"} value={cur && cur.expenses ? usd(net) : usd(cur?.over_120 || 0)} sub={cur && cur.expenses ? "revenue − expenses" : "most serious"} valueClass={cur && cur.expenses ? (net >= 0 ? "text-emerald-600" : "text-red-600") : ""} />
      </div>

      {/* Revenue trend */}
      <Card title="Revenue vs. collected" subtitle="Each month's sales and how much came in.">
        <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 160 }}>
          {[...months].reverse().map((m) => (
            <div key={m.month_ym} className="flex min-w-[46px] flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div title={`Revenue ${usd(m.revenue)}`} className="w-3 rounded-t bg-emerald-500" style={{ height: `${(m.revenue / maxRev) * 100}%` }} />
                <div title={`Collected ${usd(m.collected)}`} className="w-3 rounded-t bg-emerald-200" style={{ height: `${(m.collected / maxRev) * 100}%` }} />
              </div>
              <span className={`text-[10px] ${m.month_ym === sel ? "font-semibold text-emerald-700" : "text-gray-400"}`}>{shortLabel(m.month_ym)}</span>
            </div>
          ))}
        </div>
        <Legend items={[["bg-emerald-500", "Revenue"], ["bg-emerald-200", "Collected"]]} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Aging */}
        <Card title="Overdue by age" subtitle="Click a band to see those customers.">
          {[["Over 30 days", cur?.over_30 || 0, "bg-amber-400", "30"], ["Over 60 days", cur?.over_60 || 0, "bg-orange-500", "60"], ["Over 90 days", cur?.over_90 || 0, "bg-red-500", "90"], ["Over 120 days", cur?.over_120 || 0, "bg-red-800", "120"]].map(([nm, val, color, bk]: any) => (
            <Bar key={nm} name={nm} pct={(val / maxAge) * 100} color={color} amt={usd(val)} href={`/admin/finance/overdue?month=${drillMonth}&bucket=${bk}`} />
          ))}
        </Card>

        {/* Facility */}
        <Card title="Overdue by facility" subtitle="Click a facility to see its customers.">
          {facilities.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">No overdue balances this month 🎉</p> :
            facilities.slice(0, 8).map((f) => <Bar key={f.facility} name={f.facility} pct={(f.overdue / maxFac) * 100} color="bg-[#0B7C79]" amt={usd(f.overdue)} icon={<Building2 className="h-3 w-3" />} href={`/admin/finance/overdue?month=${drillMonth}&facility=${encodeURIComponent(f.facility)}`} />)}
        </Card>
      </div>

      {/* Income vs pending */}
      <Card title="Income vs. pending" subtitle="Collected vs. still owed this cycle.">
        <div className="flex h-9 overflow-hidden rounded-lg">
          <div className="flex items-center bg-emerald-600 px-3 text-xs font-medium text-white" style={{ width: `${cur && (cur.collected + cur.outstanding) ? (cur.collected / (cur.collected + cur.outstanding)) * 100 : 50}%` }}>{usd(cur?.collected || 0)}</div>
          <div className="flex items-center bg-amber-400 px-3 text-xs font-medium text-amber-900" style={{ width: `${cur && (cur.collected + cur.outstanding) ? (cur.outstanding / (cur.collected + cur.outstanding)) * 100 : 50}%` }}>{usd(cur?.outstanding || 0)}</div>
        </div>
        <Legend items={[["bg-emerald-600", "Collected"], ["bg-amber-400", "Outstanding"]]} />
      </Card>

      {isAgg
        ? <p className="mt-2 text-center text-xs text-gray-400">Pick a specific month to add or review expenses.</p>
        : <ExpensesCard month={sel} onChange={load} expenses={expenses.filter((e) => e.month_ym === sel)} revenue={cur?.revenue || 0} />}
    </div>
  )
}

function Kpi({ label, value, sub, valueClass = "", subClass = "text-gray-400" }: any) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums text-gray-900 ${valueClass}`}>{value}</p>
      <p className={`mt-0.5 text-xs ${subClass}`}>{sub}</p>
    </div>
  )
}
function Card({ title, subtitle, children }: any) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="mb-4 text-xs text-gray-500">{subtitle}</p>}
      {children}
    </div>
  )
}
function Bar({ name, pct, color, amt, icon, href }: any) {
  const inner = (
    <div className="grid grid-cols-[110px_1fr_90px] items-center gap-3">
      <span className="flex items-center gap-1 text-xs text-gray-600">{icon}{name}</span>
      <div className="h-3.5 rounded-full bg-gray-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
      <span className="text-right text-xs tabular-nums text-gray-800">{amt}</span>
    </div>
  )
  if (href) return <Link href={href} className="-mx-1 mb-2 block rounded-md px-1 py-0.5 hover:bg-gray-50" title="View these customers">{inner}</Link>
  return <div className="mb-2">{inner}</div>
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 flex gap-4 text-xs text-gray-500">
      {items.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{l}</span>)}
    </div>
  )
}

function ExpensesCard({ month, expenses, revenue, onChange }: { month: string; expenses: Expense[]; revenue: number; onChange: () => void }) {
  const [cat, setCat] = useState("Payroll")
  const [lbl, setLbl] = useState("")
  const [amt, setAmt] = useState("")
  const [saving, setSaving] = useState(false)
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  const add = async () => {
    if (!amt || Number(amt) <= 0) return
    setSaving(true)
    try {
      await fetch("/api/admin/finance/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month_ym: month, category: cat, label: lbl, amount: Number(amt) }) })
      setLbl(""); setAmt(""); onChange()
    } finally { setSaving(false) }
  }
  const del = async (id: string) => { await fetch(`/api/admin/finance/expenses?id=${id}`, { method: "DELETE" }); onChange() }

  return (
    <Card title="Expenses (optional)" subtitle="Add payroll, rent, inventory, etc. to see profit. Leave blank to track income only.">
      {expenses.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
              <span className="text-gray-700">{e.category}{e.label ? ` · ${e.label}` : ""}</span>
              <span className="flex items-center gap-3"><span className="tabular-nums text-gray-800">{usd(Number(e.amount))}</span><button onClick={() => del(e.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-gray-100 px-3 pt-2 text-sm font-medium">
            <span className="text-gray-700">Profit (revenue − expenses)</span>
            <span className={`tabular-nums ${revenue - total >= 0 ? "text-emerald-700" : "text-red-600"}`}>{usd(revenue - total)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-2 text-sm">
          {["Payroll", "Rent", "Inventory", "Utilities", "Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input value={lbl} onChange={(e) => setLbl(e.target.value)} placeholder="Label (optional)" className="h-10 flex-1 min-w-[120px] rounded-lg border border-gray-200 px-3 text-sm" />
        <div className="relative"><DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className="h-10 w-28 rounded-lg border border-gray-200 pl-7 pr-2 text-sm" /></div>
        <button onClick={add} disabled={saving || !amt} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"><Plus className="h-4 w-4" /> Add</button>
      </div>
    </Card>
  )
}
