"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Loader2, Mail, ArrowLeft, MailX, Ban, CheckCircle2, AlertCircle,
  Search, Download, X,
} from "lucide-react"

type Row = {
  id: string; first_name: string; last_name: string; account_number: string; facility: string | null
  over_30: number; over_60: number; over_90: number; over_120: number
  total_overdue: number; balance: number | null; email: string | null; opted_out: boolean
}

const usd = (v: number) => "$" + Math.round(v || 0).toLocaleString()
const label = (ym: string) => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
const BUCKETS = [
  { id: "all", label: "All overdue" }, { id: "30", label: "30+ days" },
  { id: "60", label: "60+ days" }, { id: "90", label: "90+ days" }, { id: "120", label: "120+ days" },
]
const bucketKeyOf = (b: string): keyof Row | null =>
  (({ "30": "over_30", "60": "over_60", "90": "over_90", "120": "over_120" }) as any)[b] || null

export default function OverduePage() {
  const [months, setMonths] = useState<string[]>([])
  const [month, setMonth] = useState("")
  const [bucket, setBucket] = useState("all")
  const [facility, setFacility] = useState("")   // "" = all facilities
  const [search, setSearch] = useState("")
  const [minAmt, setMinAmt] = useState("")
  const [maxAmt, setMaxAmt] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  // Deep-link params from the Money dashboard (?bucket=30 or ?facility=MILL or ?month=)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const b = sp.get("bucket"); if (b && BUCKETS.some((x) => x.id === b)) setBucket(b)
    const f = sp.get("facility"); if (f) setFacility(f)
    const m = sp.get("month"); if (m) setMonth(m)
  }, [])

  // Available months
  useEffect(() => {
    fetch("/api/admin/finance/summary").then((r) => r.json()).then((d) => {
      const ms = (d.months || []).map((m: any) => m.month_ym)
      setMonths(ms); setMonth((cur) => cur || d.latest_month || ms[0] || "")
    }).catch(() => {})
  }, [])

  // Load ALL overdue rows for the month once; everything else filters client-side.
  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/admin/finance/overdue?month=${month}&bucket=all`)
      .then((r) => r.json())
      .then((d) => setRows(d.customers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  const facilities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.facility).filter(Boolean))).sort() as string[],
    [rows],
  )

  const filtered = useMemo(() => {
    const bk = bucketKeyOf(bucket)
    const mn = minAmt.trim() ? parseFloat(minAmt) : null
    const mx = maxAmt.trim() ? parseFloat(maxAmt) : null
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (bk && !((r[bk] as number) > 0)) return false
      if (facility && (r.facility || "") !== facility) return false
      if (mn != null && r.total_overdue < mn) return false
      if (mx != null && r.total_overdue > mx) return false
      if (q) {
        const hay = `${r.last_name} ${r.first_name} ${r.account_number} ${r.facility || ""} ${r.email || ""} ${r.total_overdue} ${r.balance ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, bucket, facility, minAmt, maxAmt, search])

  const summary = useMemo(() => ({
    total: filtered.length,
    emailable: filtered.filter((r) => r.email && !r.opted_out).length,
    no_email: filtered.filter((r) => !r.email).length,
    opted_out: filtered.filter((r) => r.email && r.opted_out).length,
    total_overdue: filtered.reduce((s, r) => s + r.total_overdue, 0),
    total_balance: filtered.reduce((s, r) => s + (r.balance || 0), 0),
  }), [filtered])

  const send = async () => {
    const accounts = Array.from(new Set(filtered.filter((r) => r.email && !r.opted_out).map((r) => r.account_number)))
    if (!accounts.length) return
    if (!confirm(`Send a past-due reminder to ${accounts.length} customer(s) in the current view?`)) return
    setSending(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/finance/overdue/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, accounts }),
      })
      const d = await r.json()
      if (r.ok) setMsg({ type: "success", text: `Sent ${d.sent}, ${d.skipped} already reminded, ${d.failed} failed.` })
      else setMsg({ type: "error", text: d.error || "Send failed." })
    } catch { setMsg({ type: "error", text: "Send failed." }) }
    finally { setSending(false) }
  }

  const exportCsv = () => {
    const head = ["Last Name", "First Name", "Account", "Facility", "Over 30", "Over 60", "Over 90", "Over 120", "Total Past-Due", "Balance", "Email", "Status"]
    const body = filtered.map((r) => [
      r.last_name, r.first_name, r.account_number, r.facility || "",
      r.over_30, r.over_60, r.over_90, r.over_120, r.total_overdue, r.balance ?? "",
      r.email || "", r.opted_out ? "opted out" : r.email ? "emailable" : "no email",
    ])
    const esc = (c: any) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [head, ...body].map((row) => row.map(esc).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `overdue-${month}${facility ? "-" + facility : ""}${bucket !== "all" ? "-" + bucket + "plus" : ""}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const activeFilters = Boolean(facility || search || minAmt || maxAmt || bucket !== "all")
  const clearFilters = () => { setFacility(""); setSearch(""); setMinAmt(""); setMaxAmt(""); setBucket("all") }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-2"><Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to Money</Link></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Overdue customers</h1>
            <p className="text-sm text-gray-500">Filter by age, facility, or amount — email a reminder or export the list.</p>
          </div>
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm">
          {months.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </select>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : msg.type === "info" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{msg.text}</span>
        </div>
      )}

      {/* Bucket tabs */}
      <div className="mb-3 inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {BUCKETS.map((b) => (
          <button key={b.id} onClick={() => setBucket(b.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${bucket === b.id ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{b.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, account, facility, email…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={facility} onChange={(e) => setFacility(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">All facilities</option>
          {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm">
          <span className="text-xs text-gray-400">Past-due&nbsp;$</span>
          <input value={minAmt} onChange={(e) => setMinAmt(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="min" className="w-16 px-1 py-1 text-sm focus:outline-none" />
          <span className="text-gray-300">–</span>
          <input value={maxAmt} onChange={(e) => setMaxAmt(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="max" className="w-16 px-1 py-1 text-sm focus:outline-none" />
        </div>
        {activeFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-500 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Clear</button>
        )}
        <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Quick amount presets */}
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
        {[["Under $100", "", "100"], ["$100–$500", "100", "500"], ["$500–$1k", "500", "1000"], ["Over $1k", "1000", ""]].map(([lbl, mn, mx]) => (
          <button key={lbl as string} onClick={() => { setMinAmt(mn as string); setMaxAmt(mx as string) }}
            className={`rounded-full border px-2.5 py-1 ${minAmt === mn && maxAmt === mx ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>{lbl}</button>
        ))}
      </div>

      {/* Summary + send */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Stat n={summary.total} l="in view" />
        <Stat n={summary.emailable} l="can email" cls="text-emerald-700" />
        <Stat n={summary.no_email} l="no email" icon={<MailX className="h-3.5 w-3.5" />} />
        <Stat n={summary.opted_out} l="opted out" icon={<Ban className="h-3.5 w-3.5" />} />
        <Stat n={usd(summary.total_overdue)} l="past-due" isText />
        <Stat n={usd(summary.total_balance)} l="balance" isText />
        <button onClick={send} disabled={sending || !summary.emailable}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email {summary.emailable} customer{summary.emailable === 1 ? "" : "s"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
          filtered.length === 0 ? <p className="py-16 text-center text-sm text-gray-400">No customers match these filters.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr>
              <th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Account #</th><th className="px-4 py-3 text-left">Facility</th>
              <th className="px-3 py-3 text-right">30</th><th className="px-3 py-3 text-right">60</th>
              <th className="px-3 py-3 text-right">90</th><th className="px-3 py-3 text-right">120</th>
              <th className="px-4 py-3 text-right">Total past-due</th><th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y">{filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.last_name}, {r.first_name}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{r.account_number}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.facility || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_30 ? usd(r.over_30) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_60 ? usd(r.over_60) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_90 ? usd(r.over_90) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{r.over_120 ? usd(r.over_120) : "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">{usd(r.total_overdue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.balance != null ? usd(r.balance) : "—"}</td>
                <td className="px-4 py-2.5">{r.email ? (r.opted_out ? <span className="text-xs text-amber-600">opted out</span> : <span className="text-xs text-gray-500">{r.email}</span>) : <span className="text-xs text-gray-300">no email</span>}</td>
                <td className="px-4 py-2.5 text-right"><a href={`/api/admin/statements/extract?id=${r.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800">View</a></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
      <p className="mt-3 text-xs text-gray-400">Reminders are deduped — a customer already reminded for this month is skipped. Email goes only to customers in the current view who have an email and haven't opted out. Export includes exactly the rows shown.</p>
    </div>
  )
}

function Stat({ n, l, cls = "text-gray-900", icon, isText }: any) {
  return (
    <div>
      <div className={`flex items-center gap-1 text-lg font-semibold tabular-nums ${cls}`}>{icon}{isText ? n : Number(n).toLocaleString()}</div>
      <div className="text-xs text-gray-400">{l}</div>
    </div>
  )
}
