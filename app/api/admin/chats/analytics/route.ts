import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Keyword themes tuned for a community/LTC pharmacy. First matching theme wins.
const THEMES: { key: string; label: string; kw: string[] }[] = [
  { key: "hours", label: "Hours & availability", kw: ["open", "hours", "close", "closing", "what time", "holiday", "weekend"] },
  { key: "transfer", label: "Prescription transfer", kw: ["transfer", "switch pharmac", "move my prescription"] },
  { key: "refill", label: "Refills & renewals", kw: ["refill", "renew", "reorder", "out of my", "need more", "run out"] },
  { key: "statement", label: "Statements & billing", kw: ["statement", "invoice", "bill", "itemized", "amount due", "balance", "payment", "pay my", "receipt"] },
  { key: "insurance", label: "Insurance & cost", kw: ["insurance", "copay", "co-pay", "coverage", "how much", "cost", "price", "discount"] },
  { key: "delivery", label: "Delivery & pickup", kw: ["deliver", "pick up", "pickup", "mail", "ship", "curbside"] },
  { key: "vaccine", label: "Vaccines & shots", kw: ["vaccine", "vaccinat", "flu shot", "covid", "shingles", "immuniz", "booster"] },
  { key: "status", label: "Prescription status", kw: ["ready", "status", "when will", "is my prescription", "track"] },
  { key: "medication", label: "Medication questions", kw: ["side effect", "dosage", "interaction", "take with", "how to take", " mg"] },
  { key: "location", label: "Location & contact", kw: ["where are you", "address", "location", "directions", "phone number", "fax", "contact"] },
]

function themeOf(q: string): { key: string; label: string } {
  const s = q.toLowerCase()
  for (const t of THEMES) if (t.kw.some((k) => s.includes(k))) return { key: t.key, label: t.label }
  return { key: "other", label: "Other / uncategorized" }
}
const normalize = (q: string) => q.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)

type Q = { content: string; created_at: string }

function windowStats(questions: Q[], startMs: number) {
  const inWin = questions.filter((q) => new Date(q.created_at).getTime() >= startMs)
  const themeMap = new Map<string, { key: string; label: string; count: number }>()
  const normMap = new Map<string, { text: string; count: number }>()
  for (const q of inWin) {
    const t = themeOf(q.content)
    const tm = themeMap.get(t.key) || { key: t.key, label: t.label, count: 0 }
    tm.count++; themeMap.set(t.key, tm)
    const n = normalize(q.content)
    if (n) {
      const nm = normMap.get(n) || { text: q.content.trim().slice(0, 160), count: 0 }
      nm.count++; normMap.set(n, nm)
    }
  }
  const total = inWin.length
  return {
    total,
    themes: [...themeMap.values()].sort((a, b) => b.count - a.count)
      .map((t) => ({ ...t, pct: total ? Math.round((t.count / total) * 100) : 0 })),
    topQuestions: [...normMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
  }
}

// GET /api/admin/chats/analytics → top customer questions & themes by window.
export async function GET() {
  const sb = admin()
  const now = Date.now()
  const d = new Date(now)
  const y = d.getFullYear(), m = d.getMonth()
  const monthStart = new Date(y, m, 1).getTime()
  const yearStart = new Date(y, 0, 1).getTime()
  const halfStart = now - 182 * 86400000
  const since = Math.min(monthStart, yearStart, halfStart)

  // All customer (role=user) messages since the earliest window start, oldest first.
  const msgs: any[] = []
  const PAGE = 1000
  for (let f = 0; f < 200_000; f += PAGE) {
    const { data, error } = await sb.from("chat_messages")
      .select("conversation_id, content, created_at")
      .eq("role", "user")
      .gte("created_at", new Date(since).toISOString())
      .order("created_at", { ascending: true })
      .range(f, f + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    msgs.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  // One "question" per conversation = its first user message.
  const firstByConv = new Map<string, Q>()
  for (const r of msgs) {
    if (r.content && r.conversation_id && !firstByConv.has(r.conversation_id)) {
      firstByConv.set(r.conversation_id, { content: r.content, created_at: r.created_at })
    }
  }
  const questions = [...firstByConv.values()]

  // Conversation status mix (all-time), for context.
  const status: Record<string, number> = {}
  for (const st of ["active", "escalated", "resolved"]) {
    const { count } = await sb.from("chat_conversations").select("id", { count: "exact", head: true }).eq("status", st)
    status[st] = count || 0
  }

  return NextResponse.json({
    windows: {
      month: { label: "This month", ...windowStats(questions, monthStart) },
      half_year: { label: "Last 6 months", ...windowStats(questions, halfStart) },
      year: { label: `This year (${y})`, ...windowStats(questions, yearStart) },
    },
    status,
  })
}
