"use client"
import { useState, useRef, useEffect } from "react"
import { Send, Loader2, Bot, User, Mail, MapPin, FileText, Phone } from "lucide-react"

// Admin AI assistant chat. The AI orchestrates lookups; actual records (PHI)
// are rendered here as cards from data that never passed through Groq.

interface Card { type: string; data: any }
interface Msg { role: "user" | "assistant"; content: string; cards?: Card[] }

const SUGGESTIONS = [
  "How many customers have no email?",
  "Show me how many statements per month",
  "How many enrollment forms this month?",
  "Look up customer ACOSTA",
]

export default function AdminAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setError("")
    setInput("")

    const newMessages: Msg[] = [...messages, { role: "user", content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Send only role + content to the server (cards stay client-side)
      const payload = newMessages.map(m => ({ role: m.role, content: m.content }))
      const r = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Something went wrong"); return }
      setMessages(prev => [...prev, { role: "assistant", content: d.message, cards: d.cards || [] }])
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <Bot className="h-6 w-6 text-[#0B7C79]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Admin Assistant</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Ask about customers, statements, and form submissions. I can only read data — I can't change anything.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-[#0B7C79] hover:text-[#0B7C79]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <Bot className="h-4 w-4 text-[#0B7C79]" />
              </div>
            )}
            <div className={`max-w-[80%] ${m.role === "user" ? "order-1" : ""}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-[#0B7C79] text-white"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {m.content}
              </div>
              {/* PHI cards rendered from local data */}
              {m.cards && m.cards.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.cards.map((card, ci) => <CardRenderer key={ci} card={card} />)}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
              <Bot className="h-4 w-4 text-[#0B7C79]" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {error && <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send() }}
            placeholder="Ask about customers, statements, or forms…"
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-[#0B7C79] p-2.5 text-white hover:bg-[#0a6b68] disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-center text-xs text-gray-400">
          Read-only · This assistant cannot modify any data
        </p>
      </div>
    </div>
  )
}

// ── Card renderers ───────────────────────────────────────────────────────
function CardRenderer({ card }: { card: Card }) {
  switch (card.type) {
    case "customer_list":
      return <>{card.data.map((c: any, i: number) => <CustomerCard key={i} c={c} />)}</>
    case "statement_list":
      return <StatementListCard rows={card.data} />
    case "submission_list":
      return <SubmissionListCard formType={card.data.form_type} rows={card.data.rows} />
    case "period_counts":
      return <PeriodCountsCard rows={card.data} />
    default:
      return null
  }
}

function CustomerCard({ c }: { c: any }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="font-semibold text-gray-900">{c.last_name?.toUpperCase()}, {c.first_name}</div>
      <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-gray-600">
        <span>Account: <span className="font-mono">{c.account_number}</span></span>
        {c.email
          ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email} {c.email_opt_in ? "" : "(opted out)"}</span>
          : <span className="flex items-center gap-1 text-gray-400"><Mail className="h-3 w-3" /> No email</span>}
        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
        {(c.address || c.city) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {[c.address, c.city, c.state, c.zip].filter(Boolean).join(", ")}
          </span>
        )}
        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c.statement_count ?? 0} statements on file</span>
      </div>
    </div>
  )
}

function StatementListCard({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="mb-2 font-semibold text-gray-900">
        {rows[0]?.last_name?.toUpperCase()}, {rows[0]?.first_name} — {rows.length} statements
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {rows.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs">
            <span>{formatPeriod(s.billing_period)}</span>
            <a
              href={`/api/admin/statements/sign?id=${s.id}`}
              onClick={async (e) => {
                e.preventDefault()
                const r = await fetch(`/api/admin/statements/sign?id=${s.id}`)
                const d = await r.json()
                if (d.url) window.open(d.url, "_blank", "noopener,noreferrer")
              }}
              className="text-[#0B7C79] hover:underline"
            >View</a>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubmissionListCard({ formType, rows }: { formType: string; rows: any[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="mb-2 font-semibold capitalize text-gray-900">{formType} submissions ({rows.length})</div>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {rows.map((s: any, i: number) => (
          <div key={s.id || i} className="rounded bg-gray-50 px-2 py-1.5 text-xs">
            <div className="font-medium text-gray-800">
              {s.first_name || s.name || s.patient_name || s.full_name || "Submission"} {s.last_name || ""}
            </div>
            <div className="text-gray-500">
              {s.email && <span>{s.email} · </span>}
              {s.created_at && <span>{formatDate(s.created_at)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PeriodCountsCard({ rows }: { rows: any[] }) {
  const max = Math.max(...rows.map(r => r.count), 1)
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="mb-2 font-semibold text-gray-900">Statements per period</div>
      <div className="space-y-1">
        {rows.map((r: any) => (
          <div key={r.period} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-gray-600">{formatPeriod(r.period)}</span>
            <div className="h-3 flex-1 rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-[#0B7C79]" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="w-12 text-right font-medium text-gray-700">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatPeriod(p: string): string {
  if (!p) return "—"
  const [y, m] = p.split("-")
  if (!y || !m) return p
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { year: "numeric", month: "short" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
