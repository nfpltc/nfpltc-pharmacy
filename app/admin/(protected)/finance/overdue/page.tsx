"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, Mail, ArrowLeft, MailX, Ban, CheckCircle2, AlertCircle } from "lucide-react"

type Row = {
  id: string; first_name: string; last_name: string; account_number: string; facility: string | null
  over_30: number; over_60: number; over_90: number; over_120: number; total_overdue: number
  email: string | null; opted_out: boolean
}
type Summary = { total: number; emailable: number; no_email: number; opted_out: number; total_overdue: number }

const usd = (v: number) => "$" + Math.round(v || 0).toLocaleString()
const label = (ym: string) => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
const BUCKETS = [
  { id: "all", label: "All overdue" }, { id: "30", label: "30+ days" },
  { id: "60", label: "60+ days" }, { id: "90", label: "90+ days" }, { id: "120", label: "120+ days" },
]

export default function OverduePage() {
  const [months, setMonths] = useState<string[]>([])
  const [month, setMonth] = useState("")
  const [bucket, setBucket] = useState("all")
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/finance/summary").then(r => r.json()).then(d => {
      const ms = (d.months || []).map((m: any) => m.month_ym)
      setMonths(ms); setMonth((cur) => cur || d.latest_month || ms[0] || "")
    }).catch(() => {})
  }, [])

  const load = async (mo: string, bk: string) => {
    if (!mo) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/finance/overdue?month=${mo}&bucket=${bk}`)
      const d = await r.json()
      setRows(d.customers || []); setSummary(d.summary || null)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { if (month) load(month, bucket) }, [month, bucket])

  const send = async () => {
    if (!summary?.emailable) return
    if (!confirm(`Send a past-due reminder to ${summary.emailable} customer(s)?`)) return
    setSending(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/finance/overdue/send", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, bucket }),
      })
      const d = await r.json()
      if (r.ok) setMsg({ type: "success", text: `Sent ${d.sent}, ${d.skipped} already reminded, ${d.failed} failed.` })
      else setMsg({ type: "error", text: d.error || "Send failed." })
    } catch { setMsg({ type: "error", text: "Send failed." }) }
    finally { setSending(false) }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2"><Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to Money</Link></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Overdue customers</h1>
            <p className="text-sm text-gray-500">Customers with a past-due balance — filter by age and email a reminder.</p>
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
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {BUCKETS.map((b) => (
          <button key={b.id} onClick={() => setBucket(b.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${bucket === b.id ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{b.label}</button>
        ))}
      </div>

      {/* Summary + send */}
      {summary && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <Stat n={summary.total} l="overdue" />
          <Stat n={summary.emailable} l="can email" cls="text-emerald-700" />
          <Stat n={summary.no_email} l="no email" icon={<MailX className="h-3.5 w-3.5" />} />
          <Stat n={summary.opted_out} l="opted out" icon={<Ban className="h-3.5 w-3.5" />} />
          <Stat n={usd(summary.total_overdue)} l="total past-due" isText />
          <button onClick={send} disabled={sending || !summary.emailable}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email {summary.emailable} customer{summary.emailable === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
          rows.length === 0 ? <p className="py-16 text-center text-sm text-gray-400">No overdue customers in this bucket 🎉</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr>
              <th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Facility</th>
              <th className="px-3 py-3 text-right">30</th><th className="px-3 py-3 text-right">60</th>
              <th className="px-3 py-3 text-right">90</th><th className="px-3 py-3 text-right">120</th>
              <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y">{rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5"><div className="font-medium text-gray-900">{r.last_name}, {r.first_name}</div><div className="text-xs text-gray-400">{r.account_number}</div></td>
                <td className="px-4 py-2.5 text-gray-600">{r.facility || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_30 ? usd(r.over_30) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_60 ? usd(r.over_60) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.over_90 ? usd(r.over_90) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{r.over_120 ? usd(r.over_120) : "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">{usd(r.total_overdue)}</td>
                <td className="px-4 py-2.5">{r.email ? (r.opted_out ? <span className="text-xs text-amber-600">opted out</span> : <span className="text-xs text-gray-500">{r.email}</span>) : <span className="text-xs text-gray-300">no email</span>}</td>
                <td className="px-4 py-2.5 text-right"><a href={`/api/admin/statements/extract?id=${r.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800">View</a></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
      <p className="mt-3 text-xs text-gray-400">Reminders are deduped — a customer already reminded for this month + bucket is skipped. Only customers with an email who haven't opted out are contacted.</p>
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
