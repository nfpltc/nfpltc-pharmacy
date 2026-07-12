"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Mail, Send, Loader2, Search, RefreshCw, PenSquare, Inbox, CheckCircle2, AlertCircle, X,
  Sparkles, Wand2, CalendarClock, Trash2, Save, Pencil, Repeat,
} from "lucide-react"

type Item = { id: string; to: string | null; subject: string; category: string; status: string; date: string | null; error?: string | null; sent_by?: string | null }
type Outbox = { id: string; to_email: string; to_name?: string | null; subject: string; message: string; status: string; send_at: string | null; repeat: string; error?: string | null }

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
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso); if (isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
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
  const [scheduleAt, setScheduleAt] = useState("")
  const [repeat, setRepeat] = useState("none")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | "send" | "draft" | "schedule" | "ai">(null)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // CRM recipient search
  const [suggestions, setSuggestions] = useState<{ name: string; email: string }[]>([])
  const [showSug, setShowSug] = useState(false)

  // Drafts + scheduled
  const [outbox, setOutbox] = useState<Outbox[]>([])
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Body viewer
  const [viewing, setViewing] = useState<Item | null>(null)
  const [body, setBody] = useState<{ available: boolean; subject?: string; html?: string | null; text?: string | null; to?: string | null; error?: string } | null>(null)
  const [bodyLoading, setBodyLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await fetch("/api/admin/mail"); const d = await r.json(); setItems(d.items || []) }
    catch { /* ignore */ } finally { setLoading(false) }
  }
  const loadOutbox = async () => {
    try { const r = await fetch("/api/admin/mail/outbox"); const d = await r.json(); setOutbox(d.items || []) } catch { /* ignore */ }
  }
  useEffect(() => { load(); loadOutbox() }, [])

  // Pre-fill the composer from a link (e.g. the Candidates page):
  // /admin/mail?tab=new&to=&subject=&message=
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const pto = sp.get("to"), psub = sp.get("subject"), pmsg = sp.get("message")
    if (pto || psub || pmsg || sp.get("tab") === "new") {
      if (pto) setTo(pto)
      if (psub) setSubject(psub)
      if (pmsg) setMessage(pmsg)
      setTab("new")
    }
  }, [])

  // Debounced CRM search on the "To" field.
  useEffect(() => {
    const q = to.trim()
    if (q.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/customers?search=${encodeURIComponent(q)}`)
        const d = await r.json()
        const list = (d.customers || []).filter((c: any) => c.email).slice(0, 8)
          .map((c: any) => ({ name: `${c.first_name || ""} ${c.last_name || ""}`.trim(), email: String(c.email) }))
        setSuggestions(list)
      } catch { setSuggestions([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [to])

  const openBody = async (item: Item) => {
    setViewing(item); setBody(null); setBodyLoading(true)
    try { const r = await fetch(`/api/admin/mail/body?id=${encodeURIComponent(item.id)}`); setBody(await r.json()) }
    catch { setBody({ available: false, error: "Could not load the email." }) }
    finally { setBodyLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => `${i.to || ""} ${i.subject} ${i.category} ${i.status}`.toLowerCase().includes(q))
  }, [items, search])

  const resetForm = () => { setTo(""); setSubject(""); setMessage(""); setScheduleAt(""); setRepeat("none"); setEditingId(null) }

  const aiAssist = async (mode: "polish" | "write") => {
    if (!message.trim()) { setMsg({ type: "error", text: mode === "write" ? "Type a short note of what to say first." : "Type a draft to polish first." }); return }
    setBusy("ai"); setMsg(null)
    try {
      const r = await fetch("/api/admin/customers/polish-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: message, subject, mode }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: "error", text: d.error || "AI could not help right now." }); return }
      if (d.subject) setSubject(d.subject)
      if (d.body) setMessage(d.body)
    } catch { setMsg({ type: "error", text: "Network error." }) } finally { setBusy(null) }
  }

  const send = async () => {
    setBusy("send"); setMsg(null)
    try {
      if (editingId) {
        // Persist any edits, then send through the claimed path so the cron
        // can't also send this scheduled row.
        const sv = await fetch("/api/admin/mail/outbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", id: editingId, to, subject, message }) })
        const svd = await sv.json().catch(() => ({}))
        if (!sv.ok) { setMsg({ type: "error", text: svd.error || "Could not send." }); return }
        const r = await fetch("/api/admin/mail/outbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", id: editingId }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setMsg({ type: "error", text: d.error || "Send failed." }); return }
      } else {
        const r = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, message }) })
        const d = await r.json()
        if (!r.ok) { setMsg({ type: "error", text: d.error || "Send failed." }); return }
      }
      setMsg({ type: "success", text: `Email sent to ${to}.` })
      resetForm(); load(); loadOutbox()
      setTimeout(() => { setTab("sent"); setMsg(null) }, 1200)
    } catch { setMsg({ type: "error", text: "Send failed." }) } finally { setBusy(null) }
  }

  const saveOrSchedule = async (action: "save" | "schedule") => {
    setBusy(action === "save" ? "draft" : "schedule"); setMsg(null)
    try {
      // Convert the local datetime-local value to a real UTC instant so it fires
      // at the time the admin picked (the server runs in UTC).
      const iso = scheduleAt ? new Date(scheduleAt).toISOString() : ""
      const r = await fetch("/api/admin/mail/outbox", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: editingId, to, subject, message, send_at: iso, repeat }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: "error", text: d.error || "Could not save." }); return }
      setMsg({ type: "success", text: action === "save" ? "Saved to drafts." : "Scheduled." })
      resetForm(); loadOutbox()
    } catch { setMsg({ type: "error", text: "Could not save." }) } finally { setBusy(null) }
  }

  const editOutbox = (o: Outbox) => {
    setTo(o.to_email); setSubject(o.subject || ""); setMessage(o.message || "")
    setScheduleAt(toLocalInput(o.send_at)); setRepeat(o.repeat || "none"); setEditingId(o.id)
    setTab("new"); setMsg(null)
  }
  const outboxAction = async (action: "send" | "delete", id: string) => {
    if (action === "send") { if (sendingId) return; setSendingId(id) }
    try {
      const r = await fetch("/api/admin/mail/outbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) })
      const d = await r.json().catch(() => ({}))
      if (action === "send") setMsg(r.ok ? { type: "success", text: "Sent." } : { type: "error", text: d.error || "Send failed." })
      loadOutbox(); if (action === "send") load()
    } catch { /* ignore */ } finally { if (action === "send") setSendingId(null) }
  }

  const canCompose = to.trim() && subject.trim() && message.trim()

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
          <span className="inline-flex items-center gap-1.5"><PenSquare className="h-4 w-4" /> New email{outbox.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">{outbox.length}</span>}</span>
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
                    <tr key={i.id} onClick={() => openBody(i)} className="cursor-pointer hover:bg-gray-50" title="View email">
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
          <p className="mt-3 text-xs text-gray-400">Includes form confirmations, statement emails, past-due reminders, and custom sends. Click any row to read the email.</p>
        </>
      ) : (
        <div className="space-y-6">
          <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {editingId && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">Editing a saved draft/scheduled email.</p>}
            <div className="space-y-4">
              {/* To with CRM autocomplete */}
              <div className="relative">
                <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                <input value={to}
                  onChange={(e) => { setTo(e.target.value); setShowSug(true) }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 150)}
                  placeholder="Type a name or email — searches your customers"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <button key={s.email} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setTo(s.email); setShowSug(false) }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50">
                        <span className="font-medium text-gray-800">{s.name || "—"}</span>
                        <span className="text-xs text-gray-500">{s.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Write your message, or jot a quick note and let AI draft it…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => aiAssist("polish")} disabled={busy === "ai"} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50" title="Clean up grammar + subject">
                    {busy === "ai" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Polish with AI
                  </button>
                  <button onClick={() => aiAssist("write")} disabled={busy === "ai"} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50" title="Turn a short note into a full email + subject">
                    <Wand2 className="h-3.5 w-3.5" /> Write for me
                  </button>
                  <span className="text-[11px] text-gray-400">AI drafts subject + body — review before sending.</span>
                </div>
              </div>

              {/* Schedule */}
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500"><CalendarClock className="h-3.5 w-3.5" /> Schedule</span>
                  <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Repeat className="h-3.5 w-3.5" /></span>
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
                    <option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                  </select>
                  <button onClick={() => saveOrSchedule("schedule")} disabled={!canCompose || !scheduleAt || busy === "schedule"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    {busy === "schedule" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Schedule
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={send} disabled={!canCompose || busy === "send"}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                  {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send now
                </button>
                <button onClick={() => saveOrSchedule("save")} disabled={!to.trim() || busy === "draft"}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
                </button>
                {editingId && <button onClick={resetForm} className="text-sm text-gray-400 hover:text-gray-600">Cancel edit</button>}
              </div>
              <p className="text-xs text-gray-400">Sent from your pharmacy address with the branded header. Line breaks are preserved.</p>
            </div>
          </div>

          {/* Drafts & scheduled */}
          {outbox.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Drafts &amp; scheduled ({outbox.length})</h3>
              <div className="divide-y">
                {outbox.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{o.subject || "(no subject)"}</div>
                      <div className="truncate text-xs text-gray-500">{o.to_name ? `${o.to_name} · ` : ""}{o.to_email}</div>
                    </div>
                    <div className="text-xs">
                      {o.status === "scheduled" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          <CalendarClock className="h-3 w-3" /> {fmt(o.send_at)}{o.repeat && o.repeat !== "none" ? ` · ${o.repeat}` : ""}
                        </span>
                      ) : o.status === "failed" ? <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700" title={o.error || ""}>Failed</span>
                      : o.status === "sending" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Sending…</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">Draft</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editOutbox(o)} title="Edit" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => outboxAction("send", o.id)} disabled={sendingId === o.id} title="Send now" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">{sendingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                      <button onClick={() => outboxAction("delete", o.id)} title="Delete" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email body viewer */}
      {viewing && (
        <div onClick={() => setViewing(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-900">{body?.subject || viewing.subject}</h3>
                <p className="mt-0.5 truncate text-xs text-gray-500">To {viewing.to || body?.to || "—"} · {fmt(viewing.date)}</p>
              </div>
              <button onClick={() => setViewing(null)} title="Close" className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4">
              {bodyLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
                !body ? null :
                !body.available ? <p className="py-12 text-center text-sm text-gray-400">{body.error || "Body not available."}</p> :
                body.html ? <iframe title="email" sandbox="" srcDoc={body.html} className="h-[62vh] w-full rounded-lg border border-gray-200 bg-white" /> :
                <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">{body.text}</pre>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
