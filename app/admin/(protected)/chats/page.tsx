"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  MessageCircle,
  User,
  Bot,
  Loader2,
  Trash2,
  CheckCircle2,
  Power,
  Eye,
  EyeOff,
  Send,
  Sparkles,
  Wand2,
  Search,
  Phone,
  Mail,
} from "lucide-react"

interface Conv {
  id: string
  status: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  message_count: number
  last_message: string
  created_at: string
  updated_at: string
}

interface Msg {
  id: string
  role: string
  content: string
  created_at: string
}

const EMPTY_COUNTS = { all: 0, active: 0, escalated: 0, resolved: 0 }
const EMPTY_STATS = {
  total_conversations: 0,
  today: 0,
  this_week: 0,
  escalated: 0,
  total_messages: 0,
}

export default function AdminChatsPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [adminReply, setAdminReply] = useState("")
  const [sending, setSending] = useState(false)
  const [suggestion, setSuggestion] = useState("")
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [rewriting, setRewriting] = useState(false)

  const [chatEnabled, setChatEnabled] = useState(true)
  const [chatVisible, setChatVisible] = useState(true)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [toggling, setToggling] = useState(false)

  const msgEndRef = useRef<HTMLDivElement>(null)

  const loadConvs = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/chats?status=${filter}`, { cache: "no-store" })
      const d = await r.json()

      if (r.ok) {
        setConvs(d.conversations || [])
        setCounts(d.counts || EMPTY_COUNTS)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    loadConvs()
  }, [loadConvs])

  useEffect(() => {
    const t = setInterval(loadConvs, 8000)
    return () => clearInterval(t)
  }, [loadConvs])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch("/api/admin/chat-settings", { cache: "no-store" })
        const d = await r.json()

        if (r.ok) {
          setChatEnabled(d.settings?.enabled ?? true)
          setChatVisible(d.settings?.visible ?? true)
          setStats(d.stats || EMPTY_STATS)
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (!activeId) return

    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/chat?conversation_id=${activeId}`, { cache: "no-store" })
        const d = await r.json()
        if (d.messages) setMessages(d.messages)
      } catch {}
    }, 4000)

    return () => clearInterval(t)
  }, [activeId])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const body = document.body
    const html = document.documentElement

    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = html.style.overflow
    const previousBodyHeight = body.style.height
    const previousHtmlHeight = html.style.height
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousHtmlOverscroll = html.style.overscrollBehavior

    body.style.overflow = "hidden"
    html.style.overflow = "hidden"
    body.style.height = "100dvh"
    html.style.height = "100dvh"
    body.style.overscrollBehavior = "none"
    html.style.overscrollBehavior = "none"

    return () => {
      body.style.overflow = previousBodyOverflow
      html.style.overflow = previousHtmlOverflow
      body.style.height = previousBodyHeight
      html.style.height = previousHtmlHeight
      body.style.overscrollBehavior = previousBodyOverscroll
      html.style.overscrollBehavior = previousHtmlOverscroll
    }
  }, [])

  const toggleSetting = async (field: "enabled" | "visible") => {
    setToggling(true)
    const nextValue = field === "enabled" ? !chatEnabled : !chatVisible

    if (field === "enabled") setChatEnabled(nextValue)
    else setChatVisible(nextValue)

    try {
      await fetch("/api/admin/chat-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextValue }),
      })
    } catch {
      if (field === "enabled") setChatEnabled(!nextValue)
      else setChatVisible(!nextValue)
    } finally {
      setToggling(false)
    }
  }

  const selectChat = async (id: string) => {
    setActiveId(id)
    setAdminReply("")
    setSuggestion("")
    setLoadingMsgs(true)

    try {
      const r = await fetch(`/api/chat?conversation_id=${id}`, { cache: "no-store" })
      const d = await r.json()
      setMessages(d.messages || [])
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }

    const conv = convs.find((c) => c.id === id)
    if (conv && conv.status !== "resolved") {
      setLoadingSuggestion(true)
      try {
        const r = await fetch(`/api/admin/chats/suggest?conversation_id=${id}`, {
          cache: "no-store",
        })
        const d = await r.json()
        if (d.suggestion) setSuggestion(d.suggestion)
      } catch {
      } finally {
        setLoadingSuggestion(false)
      }
    }
  }

  const sendReply = async (text?: string) => {
    const msg = (text || adminReply).trim()
    if (!msg || sending || !activeId) return

    setSending(true)

    try {
      const r = await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeId,
          message: msg,
        }),
      })

      if (r.ok) {
        setAdminReply("")
        setSuggestion("")
        await selectChat(activeId)
        await loadConvs()
      }
    } catch {
    } finally {
      setSending(false)
    }
  }

  const resolveChat = async () => {
    if (!activeId) return

    await fetch("/api/admin/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: activeId,
        action: "resolve",
      }),
    })

    setActiveId(null)
    setMessages([])
    setSuggestion("")
    loadConvs()
  }

  const rewriteAI = async () => {
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
    } catch {
    } finally {
      setRewriting(false)
    }
  }

  const deleteConv = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!confirm("Delete this conversation?")) return

    await fetch(`/api/admin/chats?id=${id}`, { method: "DELETE" })

    if (activeId === id) {
      setActiveId(null)
      setMessages([])
      setSuggestion("")
    }

    loadConvs()
  }

  const activeConv = convs.find((c) => c.id === activeId)

  const filteredConvs = search
    ? convs.filter((c) =>
        [c.visitor_name, c.visitor_email, c.last_message]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : convs

  return (
    <main className="fixed inset-0 z-50 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#F7F5EF]">
      <div
        className="flex flex-none items-center justify-between px-4 py-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-lg font-semibold text-white">
              <MessageCircle className="h-5 w-5 flex-shrink-0" />
              Chats
            </h1>
            <p className="truncate text-xs text-white/70">
              {stats.total_conversations} total · {stats.today} today
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSetting("visible")}
            disabled={toggling}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              chatVisible ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
            }`}
          >
            {chatVisible ? (
              <>
                <Eye className="mr-1 inline h-3 w-3" />
                Visible
              </>
            ) : (
              <>
                <EyeOff className="mr-1 inline h-3 w-3" />
                Hidden
              </>
            )}
          </button>

          <button
            onClick={() => toggleSetting("enabled")}
            disabled={toggling}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              chatEnabled ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
            }`}
          >
            <Power className="mr-1 inline h-3 w-3" />
            {chatEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside className="flex h-full w-80 flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="flex flex-none border-b border-gray-100 text-xs">
            {[
              { v: "all", l: "All", c: counts.all },
              { v: "escalated", l: "Escalated", c: counts.escalated },
              { v: "active", l: "Active", c: counts.active },
              { v: "resolved", l: "Resolved", c: counts.resolved },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={`flex-1 py-2.5 font-medium ${
                  filter === f.v
                    ? "border-b-2 border-[#0B7C79] text-[#0B7C79]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.l}
                {f.c > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                      f.v === "escalated" && f.c > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {f.c}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-none p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">No conversations</p>
            ) : (
              filteredConvs.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectChat(c.id)}
                  className={`flex cursor-pointer items-start gap-2.5 border-b border-gray-50 px-3 py-3 hover:bg-gray-50 ${
                    activeId === c.id ? "border-l-2 border-l-[#0B7C79] bg-emerald-50" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      c.status === "escalated"
                        ? "bg-amber-500"
                        : c.status === "resolved"
                        ? "bg-gray-400"
                        : "bg-[#0B7C79]"
                    }`}
                  >
                    {(c.visitor_name || "A")[0].toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">
                        {c.visitor_name || "Anonymous"}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-gray-400">
                        {timeAgo(c.updated_at)}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {c.last_message || "No messages"}
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                      <StatusDot status={c.status} />
                      <span className="text-[10px] text-gray-400">{c.message_count} msgs</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteConv(c.id, e)}
                    className="mt-1 flex-shrink-0 text-gray-300 hover:text-red-500"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50">
          {!activeId ? (
            <div className="flex min-h-0 flex-1 items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm">Select a conversation to start chatting</p>
                {counts.escalated > 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ {counts.escalated} customer{counts.escalated > 1 ? "s" : ""} waiting
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-none items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${
                      activeConv?.status === "escalated" ? "bg-amber-500" : "bg-[#0B7C79]"
                    }`}
                  >
                    {(activeConv?.visitor_name || "A")[0].toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-gray-900">
                      {activeConv?.visitor_name || "Anonymous"}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {activeConv?.visitor_email && (
                        <span className="flex items-center gap-0.5 break-all">
                          <Mail className="h-3 w-3" />
                          {activeConv.visitor_email}
                        </span>
                      )}

                      {activeConv?.visitor_phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {activeConv.visitor_phone}
                        </span>
                      )}

                      <StatusBadge status={activeConv?.status || ""} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={resolveChat}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  Resolve
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="mx-auto flex min-h-full max-w-2xl flex-col">
                    <div className="space-y-3">
                      {messages.map((m, i) => (
                        <div
                          key={m.id || i}
                          className={`flex gap-2.5 ${
                            m.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {m.role !== "user" && (
                            <div
                              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                                m.role === "admin" ? "bg-blue-100" : "bg-emerald-50"
                              }`}
                            >
                              {m.role === "admin" ? (
                                <User className="h-3.5 w-3.5 text-blue-600" />
                              ) : (
                                <Bot className="h-3.5 w-3.5 text-[#0B7C79]" />
                              )}
                            </div>
                          )}

                          <div
                            className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                              m.role === "user"
                                ? "bg-[#0B7C79] text-white"
                                : m.role === "admin"
                                ? "border border-blue-100 bg-blue-50 text-gray-800"
                                : "border border-gray-200 bg-white text-gray-800 shadow-sm"
                            }`}
                          >
                            {m.role === "admin" && (
                              <p className="mb-0.5 text-[10px] font-semibold text-blue-600">
                                Pharmacy Team
                              </p>
                            )}

                            {m.role === "assistant" && (
                              <p className="mb-0.5 text-[10px] font-semibold text-emerald-600">
                                AI Bot
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words">{m.content}</p>

                            <p className="mt-1 text-[10px] opacity-50">
                              {new Date(m.created_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div ref={msgEndRef} className="h-px" />
                  </div>
                )}
              </div>

              {activeConv?.status !== "resolved" && (suggestion || loadingSuggestion) && (
                <div className="flex-none border-t border-purple-100 bg-purple-50 px-4 py-2.5">
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-purple-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Suggested Reply
                  </p>

                  {loadingSuggestion ? (
                    <div className="flex items-center gap-2 text-xs text-purple-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating...
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm text-purple-900">{suggestion}</p>

                      <div className="flex flex-shrink-0 gap-1.5">
                        <button
                          onClick={() => sendReply(suggestion)}
                          disabled={sending}
                          className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-purple-700"
                        >
                          Send
                        </button>

                        <button
                          onClick={() => {
                            setAdminReply(suggestion)
                            setSuggestion("")
                          }}
                          className="rounded-lg border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeConv?.status !== "resolved" ? (
                <div className="flex-none border-t border-gray-200 bg-white px-4 py-3">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <div className="flex-1">
                      <textarea
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            sendReply()
                          }
                        }}
                        placeholder="Type a reply... (Enter to send)"
                        rows={1}
                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        style={{ minHeight: "42px", maxHeight: "120px" }}
                        onInput={(e) => {
                          const t = e.target as HTMLTextAreaElement
                          t.style.height = "42px"
                          t.style.height = `${t.scrollHeight}px`
                        }}
                      />

                      <button
                        onClick={rewriteAI}
                        disabled={rewriting || !adminReply.trim()}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-40"
                      >
                        {rewriting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        Rewrite with AI
                      </button>
                    </div>

                    <button
                      onClick={() => sendReply()}
                      disabled={sending || !adminReply.trim()}
                      className="mb-5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#0B7C79] text-white hover:bg-[#0a6b68] disabled:opacity-40"
                      aria-label="Send reply"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-none border-t border-gray-200 bg-white px-4 py-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conversation resolved
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === "escalated") {
    return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
  }

  if (status === "resolved") {
    return <span className="h-2 w-2 rounded-full bg-gray-400" />
  }

  return <span className="h-2 w-2 rounded-full bg-emerald-500" />
}

function StatusBadge({ status }: { status: string }) {
  if (status === "escalated") {
    return (
      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        Escalated
      </span>
    )
  }

  if (status === "resolved") {
    return (
      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
        Resolved
      </span>
    )
  }

  return (
    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
      Active
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`

  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`

  return `${Math.floor(hrs / 24)}d`
}
