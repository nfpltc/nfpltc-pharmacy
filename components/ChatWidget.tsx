"use client"
import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Loader2, User, Bot, Phone } from "lucide-react"

interface Msg { role: "user" | "assistant" | "admin"; content: string }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null)
  const [chatVisible, setChatVisible] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [status, setStatus] = useState<"active" | "escalated" | "resolved">("active")
  const [showEscForm, setShowEscForm] = useState(false)
  const [escName, setEscName] = useState("")
  const [escContact, setEscContact] = useState("")
  const [escReason, setEscReason] = useState("")
  const [escalating, setEscalating] = useState(false)
  const [pollTimer, setPollTimer] = useState<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Check if chat is enabled by admin
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/chat/status")
        const d = await r.json()
        setChatEnabled(d.enabled !== false)
        setChatVisible(d.visible !== false)
      } catch {
        setChatEnabled(true)
        setChatVisible(true)
      }
    })()
  }, [])

  // Restore conversation from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nfpltc_chat_conv")
    if (saved) {
      try {
        const s = JSON.parse(saved)
        if (s.id && Date.now() - s.ts < 3600000) { // 1 hour max session
          setConvId(s.id)
          setStatus(s.status || "active")
          fetchMessages(s.id)
        } else {
          localStorage.removeItem("nfpltc_chat_conv")
        }
      } catch { localStorage.removeItem("nfpltc_chat_conv") }
    }
  }, [])

  // Poll for new messages when escalated (admin might reply)
  useEffect(() => {
    if (status === "escalated" && convId && open) {
      const timer = setInterval(() => fetchMessages(convId), 4000)
      setPollTimer(timer)
      return () => clearInterval(timer)
    }
    if (pollTimer) { clearInterval(pollTimer); setPollTimer(null) }
  }, [status, convId, open]) // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const saveConv = (id: string, st: string) => {
    localStorage.setItem("nfpltc_chat_conv", JSON.stringify({ id, status: st, ts: Date.now() }))
  }

  const fetchMessages = async (id: string) => {
    try {
      const r = await fetch(`/api/chat?conversation_id=${id}`)
      const d = await r.json()
      if (r.ok) {
        setMessages(d.messages?.map((m: any) => ({ role: m.role, content: m.content })) || [])
        if (d.status && d.status !== status) {
          setStatus(d.status)
          saveConv(id, d.status)
        }
      }
    } catch {}
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, message: text }),
      })
      const d = await r.json()
      if (d.conversation_id && !convId) {
        setConvId(d.conversation_id)
        saveConv(d.conversation_id, d.status || "active")
      }
      if (d.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: d.reply }])
      }
      if (d.status) setStatus(d.status)
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble. Please call us at (508) 564-4459." }])
    } finally {
      setLoading(false)
    }
  }

  const handleEscalate = async () => {
    if (!convId) return
    setEscalating(true)
    try {
      const r = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convId,
          name: escName || undefined,
          email: escContact.includes("@") ? escContact : undefined,
          phone: !escContact.includes("@") ? escContact : undefined,
          reason: escReason || undefined,
        }),
      })
      if (r.ok) {
        setStatus("escalated")
        setShowEscForm(false)
        saveConv(convId, "escalated")
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Thank you${escName ? `, ${escName}` : ""}! I've notified our pharmacy team. Someone will respond shortly${isBusinessHours() ? "" : " when we open (Mon–Fri 8:30 AM – 4:30 PM EST)"}. You can keep this chat open — their reply will appear here.`,
        }])
      }
    } catch {}
    finally { setEscalating(false) }
  }

  const startNewChat = () => {
    localStorage.removeItem("nfpltc_chat_conv")
    setConvId(null)
    setMessages([])
    setStatus("active")
    setShowEscForm(false)
  }

  // Hidden = bubble doesn't appear at all
  if (chatVisible === null || chatVisible === false) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg hover:scale-105 transition-transform"
        style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ height: "min(520px, calc(100vh - 48px))" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div>
          <h3 className="text-sm font-semibold text-white">North Falmouth Pharmacy</h3>
          <p className="text-xs text-white/80">
            {status === "escalated" ? "Connected — waiting for reply" : status === "resolved" ? "Chat ended" : "Ask us anything"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={startNewChat} className="text-xs text-white/70 hover:text-white">New chat</button>
          )}
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!chatEnabled ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <MessageCircle className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">We're currently offline</h3>
            <p className="mt-1 max-w-xs text-sm text-gray-500">
              Our chat is unavailable right now. Please call us at <a href="tel:5085644459" className="text-[#0B7C79] font-medium">(508) 564-4459</a> or email <a href="mailto:wecare@nfpltc.com" className="text-[#0B7C79] font-medium">wecare@nfpltc.com</a>.
            </p>
            <p className="mt-2 text-xs text-gray-400">Mon–Fri 8:30 AM – 4:30 PM EST</p>
          </div>
        ) : (
        <>
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 text-4xl animate-bounce">👋</div>
            <h3 className="text-base font-semibold text-gray-800">{getGreeting()}</h3>
            <p className="mt-1 text-sm text-gray-500">I'm your pharmacy helper. Ask me anything about our services!</p>

            <div className="mt-4 w-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Quick questions</p>
              {[
                { emoji: "🕐", text: "Are you open right now?" },
                { emoji: "💊", text: "How do I refill my prescription?" },
                { emoji: "🚗", text: "Do you deliver medications?" },
                { emoji: "💉", text: "What vaccinations do you offer?" },
                { emoji: "📋", text: "How do I transfer a prescription?" },
              ].map(q => (
                <button key={q.text} onClick={() => sendMessage(q.text)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left text-sm text-gray-700 shadow-sm transition-all hover:border-[#0B7C79] hover:bg-emerald-50 hover:shadow-md">
                  <span className="text-base">{q.emoji}</span>
                  <span>{q.text}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`h-2 w-2 rounded-full ${isBusinessHours() ? "bg-emerald-400" : "bg-gray-300"}`}></span>
              {isBusinessHours() ? "We're open now · Mon–Fri 8:30–4:30" : "Currently closed · Mon–Fri 8:30–4:30"}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role !== "user" && (
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${m.role === "admin" ? "bg-blue-100" : "bg-emerald-50"}`}>
                {m.role === "admin" ? <User className="h-3.5 w-3.5 text-blue-600" /> : <Bot className="h-3.5 w-3.5 text-[#0B7C79]" />}
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-[#0B7C79] text-white"
                : m.role === "admin"
                  ? "bg-blue-50 text-gray-800 border border-blue-100"
                  : "bg-gray-100 text-gray-800"
            }`}>
              {m.role === "admin" && <p className="mb-0.5 text-[10px] font-medium text-blue-600">Pharmacy Team</p>}
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
              <Bot className="h-3.5 w-3.5 text-[#0B7C79]" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Typing…
            </div>
          </div>
        )}

        {status === "escalated" && !loading && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for a team member to respond…
          </div>
        )}
        </>
        )}
      </div>

      {/* Escalation form — only when enabled */}
      {chatEnabled && showEscForm && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-gray-700">How can we reach you?</p>
          <input value={escName} onChange={e => setEscName(e.target.value)} placeholder="Your name" className="mb-1.5 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
          <input value={escContact} onChange={e => setEscContact(e.target.value)} placeholder="Phone or email" className="mb-1.5 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
          <input value={escReason} onChange={e => setEscReason(e.target.value)} placeholder="What's this about? (optional)" className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowEscForm(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Cancel</button>
            <button onClick={handleEscalate} disabled={escalating} className="flex-1 rounded-lg bg-[#0B7C79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60">
              {escalating ? "Sending…" : "Send Message"}
            </button>
          </div>
        </div>
      )}

      {/* Input bar — only when enabled */}
      {chatEnabled && !showEscForm && (
        <div className="border-t border-gray-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMessage() }}
              placeholder={status === "escalated" ? "Type a message…" : "Ask a question…"}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="rounded-lg bg-[#0B7C79] p-2 text-white disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
          {status === "active" && messages.length > 0 && (
            <button onClick={() => setShowEscForm(true)} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              <Phone className="h-3.5 w-3.5" /> Talk to a person
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function isBusinessHours(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day = et.getDay()
  const hour = et.getHours()
  const min = et.getMinutes()
  return day >= 1 && day <= 5 && ((hour > 8 || (hour === 8 && min >= 30)) && hour < 16) || (hour === 16 && min <= 30)
}

function getGreeting(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  if (hour < 12) return "Good morning! ☀️"
  if (hour < 17) return "Good afternoon! 🌤️"
  return "Good evening! 🌙"
}
