import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendCustomEmail } from "@/lib/send-custom-email"

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

const monthLabel = (ym: string) => {
  const [y, m] = String(ym || "").split(":")[0].split("-")
  if (!y || !m) return ym || ""
  return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// GET /api/admin/mail → merged outbound email history.
// Combines email_log (custom + form confirmations) with statement_email_log
// (statement + past-due reminders) so every Resend send shows in one place.
export async function GET() {
  const sb = admin()
  const items: any[] = []

  try {
    const { data } = await sb.from("email_log").select("*").order("created_at", { ascending: false }).limit(300)
    for (const r of data || []) {
      items.push({
        id: `el_${r.id}`, to: r.to_email, subject: r.subject || "(no subject)",
        category: r.category || "other", status: r.status || "sent",
        date: r.created_at, error: r.error, sent_by: r.sent_by || null,
      })
    }
  } catch { /* email_log not migrated yet */ }

  try {
    const { data } = await sb.from("statement_email_log")
      .select("id, billing_period, email_to, status, error_message, sent_at")
      .order("sent_at", { ascending: false }).limit(300)
    for (const r of data || []) {
      const isOverdue = String(r.billing_period || "").includes(":overdue")
      items.push({
        id: `sl_${r.id}`, to: r.email_to,
        subject: isOverdue ? `Past-due reminder — ${monthLabel(r.billing_period)}` : `Statement ready — ${monthLabel(r.billing_period)}`,
        category: isOverdue ? "overdue" : "statement", status: r.status || "sent",
        date: r.sent_at, error: r.error_message, sent_by: null,
      })
    }
  } catch { /* ignore */ }

  items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
  return NextResponse.json({ items: items.slice(0, 500) })
}

// POST /api/admin/mail → send a custom email to anyone now (branded + logged).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const to = String(b.to || "").trim()
  const subject = String(b.subject || "").trim()
  const message = String(b.message || "").trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 })
  if (!subject) return NextResponse.json({ error: "Enter a subject." }, { status: 400 })
  if (!message) return NextResponse.json({ error: "Enter a message." }, { status: 400 })

  const r = await sendCustomEmail({ to, subject, message, sentBy: b.sentBy || null })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  return NextResponse.json({ ok: true, id: r.id })
}
