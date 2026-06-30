"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, MessageCircle, User, Bot, Loader2, Trash2, Clock, CheckCircle2, AlertCircle, Power, Eye, EyeOff, Send, Sparkles, Wand2 } from "lucide-react"

export default function AdminChatsPage() {
  const [convs, setConvs] = useState<any[]>([])
  const [counts, setCounts] = useState({ all: 0, active: 0, escalated: 0, resolved: 0 })
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [adminReply, setAdminReply] = useState("")
  const [sending, setSending] = useState(false)
  const [suggestion, setSuggestion] = useState("")
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [rewriting, setRewriting] = useState(false)

  // Settings
  const [chatEnabled, setChatEnabled] = useState(true)
  const [chatVisible, setChatVisible] = useState(true)
  const [stats, setStats] = useState({ total_conversations: 0, today: 0, this_week: 0, escalated: 0, total_messages: 0 })
  const [toggling, setToggling] = useState(false)

  const loadSettings = async () => {
    try {
      const r = await fetch("/api/admin/chat-settings")
      const d = await r.json()
      if (r.ok) {
        setChatEnabled(d.settings?.enabled ?? true)
        setChatVisible(d.settings?.visible ?? true)
        setStats(d.stats || stats)
      }
    } catch {}
  }

  const toggleChat = async (field: "enabled" | "visible") => {
    setToggling(true)
    const newVal = field === "enabled" ? !chatEnabled : !chatVisible
    if (field === "enabled") setChatEnabled(newVal)
    else setChatVisible(newVal)
    try {
      await fetch("/api/admin/chat-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      })
    } catch {
      if (field === "enabled") setChatEnabled(!newVal)
      else setChatVisible(!newVal)
    }
    finally { setToggling(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/chats?status=${filter}`)
      const d = await r.json()
      if (r.ok) { setConvs(d.conversations || []); setCounts(d.counts || counts) }
    } catch {}
    finally { setLoading(false) }
  }, [filter]) // eslint-disable-line

  useEffect(() => { load(); loadSettings() }, [load])

  // Auto-refresh every 10 seconds to catch new escalations
  useEffect(() => {
    const timer = setInterval(() => { load() }, 10000)
    return () => clearInterval(timer)
  }, [load])

  const expand = async (id: string) => {
    if (expanded === id) { setExpanded(null); setSuggestion(""); return }
    setExpanded(id)
    setLoadingMsgs(true)
    setSuggestion("")
    setAdminReply("")
    try {
      const r = await fetch(`/api/chat?conversation_id=${id}`)
      const d = await r.json()
      setMessages(d.messages || [])
    } catch { setMessages([]) }
    finally { setLoadingMsgs(false) }

    // Fetch AI suggestion
    const conv = convs.find(c => c.id === id)
    if (conv && conv.status !== "resolved") {
      setLoadingSuggestion(true)
      try {
        const r = await fetch(`/api/admin/chats/suggest?conversation_id=${id}`)
        const d = await r.json()
        if (d.suggestion) setSuggestion(d.suggestion)
      } catch {}
      finally { setLoadingSuggestion(false) }
    }
  }

  // Auto-refresh messages in expanded conversation
  useEffect(() => {
    if (!expanded) return
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/chat?conversation_id=${expanded}`)
        const d = await r.json()
        if (d.messages) setMessages(d.messages)
      } catch {}
    }, 5000)
    return () => clearInterval(timer)
  }, [expanded])

  const deleteConv = async (id: string) => {
    if (!confirm("Delete this conversation?")) return
    await fetch(`/api/admin/chats?id=${id}`, { method: "DELETE" })
    load()
  }

  const sendAdminReply = async (convId: string, text?: string) => {
    const msg = (text || adminReply).trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const r = await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, message: msg }),
      })
      if (r.ok) {
        setAdminReply("")
        setSuggestion("")
        expand(convId) // refresh messages + get new suggestion
      }
    } catch {}
    finally { setSending(false) }
  }

  const resolveChat = async (convId: string) => {
    await fetch("/api/admin/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, action: "resolve" }),
    })
    setExpanded(null)
    load()
  }

  const rewriteWithAI = async () => {
    if (!adminReply.trim() || rewriting) return
    setRewriting(true)
    try {
      const r = await fetch("/api/admin/chats/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: adminReply }),
      })
      const d = await r.json()
      if (d.rewritten) setAdminReply(d.rewritten)
    } catch {}
    finally { setRewriting(false) }
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white md:text-3xl">
            <MessageCircle className="h-7 w-7" /> Website Chats
          </h1>
          <p className="mt-1 text-sm text-white/85">Conversations from the website chatbot.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-6">
        {/* Chat settings panel */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${chatEnabled ? "bg-emerald-50" : "bg-gray-100"}`}>
                <MessageCircle className={`h-5 w-5 ${chatEnabled ? "text-[#0B7C79]" : "text-gray-400"}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Website Chatbot</h3>
                <p className="text-xs text-gray-500">
                  {!chatVisible ? "Hidden — chat bubble is not visible on your website"
                    : !chatEnabled ? "Visible but offline — bubble shows, but displays 'we're offline'"
                    : "Active — visitors can chat with the AI assistant"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleChat("visible")}
                disabled={toggling}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  chatVisible
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                {chatVisible ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Show</>}
              </button>
              <button
                onClick={() => toggleChat("enabled")}
                disabled={toggling}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  chatEnabled
                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                <Power className="h-4 w-4" />
                {chatEnabled ? "Turn Off" : "Turn On"}
              </button>
            </div>
          </div>
          {/* Stats */}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>{stats.total_conversations} total chats</span>
            <span>{stats.today} today</span>
            <span>{stats.this_week} this week</span>
            <span>{stats.escalated} escalated</span>
            <span>{stats.total_messages} total messages logged</span>
          </div>
        </div>

        {/* Escalated alert banner */}
        {counts.escalated > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 animate-pulse">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">{counts.escalated} customer{counts.escalated > 1 ? "s" : ""} waiting for a reply</p>
              <p className="text-xs text-amber-600">Click on an escalated conversation below to see their question.</p>
            </div>
            <button onClick={() => setFilter("escalated")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
              View Now
            </button>
          </div>
        )}

        {/* Filter cards */}
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            { l: "All", v: "all", c: counts.all, cl: "text-gray-700" },
            { l: "Active", v: "active", c: counts.active, cl: "text-blue-600" },
            { l: "Escalated", v: "escalated", c: counts.escalated, cl: "text-amber-600" },
            { l: "Resolved", v: "resolved", c: counts.resolved, cl: "text-emerald-600" },
          ].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              className={`rounded-xl border bg-white p-3 text-left ${filter === f.v ? "border-[#0B7C79] ring-1 ring-[#0B7C79]" : "border-gray-200"}`}>
              <div className={`text-xl font-bold ${f.cl}`}>{f.c}</div>
              <div className="text-xs text-gray-500">{f.l}</div>
            </button>
          ))}
        </div>

        {/* Conversation list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : convs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">No {filter === "all" ? "" : filter} conversations yet.</div>
        ) : (
          <div className="space-y-3">
            {convs.map(c => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-gray-50" onClick={() => expand(c.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-gray-400">{timeAgo(c.updated_at)}</span>
                    </div>
                    <h3 className="mt-1 font-medium text-gray-900">
                      {c.visitor_name || "Anonymous"}
                      {c.visitor_email && <span className="text-sm font-normal text-gray-500"> · {c.visitor_email}</span>}
                      {c.visitor_phone && <span className="text-sm font-normal text-gray-500"> · {c.visitor_phone}</span>}
                    </h3>
                    {c.last_message && <p className="mt-0.5 text-sm text-gray-600 line-clamp-1">{c.last_message}</p>}
                    <span className="mt-1 text-xs text-gray-400">{c.message_count} messages</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteConv(c.id) }} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded: show full conversation */}
                {expanded === c.id && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                    {loadingMsgs ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading messages…</div>
                    ) : (
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {messages.map((m, i) => (
                          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            {m.role !== "user" && (
                              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${m.role === "admin" ? "bg-blue-100" : "bg-emerald-50"}`}>
                                {m.role === "admin" ? <User className="h-3 w-3 text-blue-600" /> : <Bot className="h-3 w-3 text-[#0B7C79]" />}
                              </div>
                            )}
                            <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${
                              m.role === "user" ? "bg-[#0B7C79] text-white"
                                : m.role === "admin" ? "bg-blue-50 text-gray-800 border border-blue-100"
                                : "bg-white text-gray-800 border border-gray-200"
                            }`}>
                              {m.role === "admin" && <p className="text-[10px] font-medium text-blue-600">Pharmacy Team</p>}
                              {m.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* AI Suggestion */}
                    {c.status !== "resolved" && (suggestion || loadingSuggestion) && (
                      <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-purple-700">
                          <Sparkles className="h-3.5 w-3.5" /> AI Suggested Reply
                        </p>
                        {loadingSuggestion ? (
                          <div className="flex items-center gap-2 text-xs text-purple-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating suggestion…</div>
                        ) : (
                          <>
                            <p className="text-sm text-purple-900">{suggestion}</p>
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => sendAdminReply(c.id, suggestion)} disabled={sending}
                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                                ✅ Send This
                              </button>
                              <button onClick={() => { setAdminReply(suggestion); setSuggestion("") }}
                                className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100">
                                ✏️ Edit First
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Admin reply box */}
                    {c.status !== "resolved" && (
                      <div className="mt-3">
                        <textarea
                          value={adminReply}
                          onChange={e => setAdminReply(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(c.id) } }}
                          placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
                          rows={2}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex gap-2">
                            <button onClick={rewriteWithAI} disabled={rewriting || !adminReply.trim()}
                              className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                              {rewriting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Rewrite with AI
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => resolveChat(c.id)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                              <CheckCircle2 className="mr-1 inline h-3 w-3" /> Resolve
                            </button>
                            <button onClick={() => sendAdminReply(c.id)} disabled={sending || !adminReply.trim()}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#0B7C79] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#0a6b68] disabled:opacity-50">
                              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {c.status === "resolved" && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Resolved</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "escalated") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"><AlertCircle className="h-3 w-3" /> Escalated</span>
  if (status === "resolved") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Resolved</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><Clock className="h-3 w-3" /> Active</span>
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
