"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, Send, Loader2, Search, RefreshCw, PenSquare, Inbox, CheckCircle2, AlertCircle } from "lucide-react"

type Item = { id: string; to: string | null; subject: string; category: string; status: string; date: string | null; error?: string | null; sent_by?: string | null }

const CAT: Record<string, { label: string; cls: string }> = {
  statement: { label: "Statement", cls: "bg-emerald-50 text-emerald-700" },
  overdue: { label: "Past-due", cls: "bg-red-50 text-red-700" },
  form: { label: "Form", cls: "bg-blue-50 text-blue-700" },
  custom: { label: "Custom", cls: "bg-purple-50 text-purple-700" },
  other: { label: "Other", cls: "bg-gray-100 text-gray-600" },
}
const fmt = (d: string | null) => {
  if (!d) return "—"
  const t = new Date(d)
  return isNaN(t.getTime()) ? "—" : t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function MailPage() {
  const [tab, setTab] = useState<"sent" | "new">("sent")
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Compose
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try { const r = await fetch("/api/admin/mail"); const d = await r.json(); setItems(d.items || []) }
    catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => `${i.to || ""} ${i.subject} ${i.category} ${i.status}`.toLowerCase().includes(q))
  }, [items, search])

  const send = async () => {
    setSending(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: "error", text: d.error || "Send failed." }); return }
      setMsg({ type: "success", text: `Email sent to ${to}.` })
      setTo(""); setSubject(""); setMessage("")
      load()
      setTimeout(() => { setTab("sent"); setMsg(null) }, 1200)
    } catch { setMsg({ type: "error", text: "Send failed." }) }
    finally { setSending(false) }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><Mail className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Email</h1>
          <p className="text-sm text-gray-500">Every email sent to customers — and send a new one to anyone.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab("sent")} className={`relative px-4 py-2.5 text-sm font-medium ${tab === "sent" ? "text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="inline-flex items-center gap-1.5"><Inbox className="h-4 w-4" /> Sent email</span>
          {tab === "sent" && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-emerald-600" />}
        </button>
        <button onClick={() => setTab("new")} className={`relative px-4 py-2.5 text-sm font-medium ${tab === "new" ? "text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="inline-flex items-center gap-1.5"><PenSquare className="h-4 w-4" /> New email</span>
          {tab === "new" && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-emerald-600" />}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{msg.text}</span>
        </div>
      )}

      {tab === "sent" ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipient, subject, type…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
              filtered.length === 0 ? <p className="py-16 text-center text-sm text-gray-400">No emails yet. Sent emails will appear here.</p> :
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr>
                  <th className="px-4 py-3 text-left">Sent</th><th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Subject</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Status</th>
                </tr></thead>
                <tbody className="divide-y">{filtered.map((i) => {
                  const c = CAT[i.category] || CAT.other
                  const ok = ["sent", "delivered"].includes((i.status || "").toLowerCase())
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{fmt(i.date)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{i.to || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-900">{i.subject}{i.error && <span className="ml-2 text-xs text-red-500" title={i.error}>· error</span>}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span></td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-emerald-50 text-emerald-700" : (i.status || "").toLowerCase() === "failed" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-500"}`}>{i.status || "—"}</span>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table></div>}
          </div>
          <p className="mt-3 text-xs text-gray-400">Includes form confirmations, statement emails, past-due reminders, and custom sends. Statement/past-due history comes from the statement email log.</p>
        </>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="recipient@example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder="Write your message…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="mt-1 text-xs text-gray-400">Sent from your pharmacy address with the branded header. Line breaks are preserved.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !message.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
