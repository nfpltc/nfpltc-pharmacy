import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { logEmail } from "@/lib/email-log"

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

// POST /api/admin/mail → send a custom email to anyone via Resend, and log it.
export async function POST(req: NextRequest) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  if (!key) return NextResponse.json({ error: "Email is not configured (RESEND_API_KEY)." }, { status: 500 })
  if (!from) return NextResponse.json({ error: "No sender email configured (FROM_EMAIL)." }, { status: 500 })

  const b = await req.json().catch(() => ({}))
  const to = String(b.to || "").trim()
  const subject = String(b.subject || "").trim()
  const message = String(b.message || "").trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 })
  if (!subject) return NextResponse.json({ error: "Enter a subject." }, { status: 400 })
  if (!message) return NextResponse.json({ error: "Enter a message." }, { status: 400 })

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#0EA171,#0B7C79);padding:18px 24px;color:#ffffff;border-radius:10px 10px 0 0;">
    <div style="font-size:18px;font-weight:700;">North Falmouth Pharmacy</div>
  </div>
  <div style="border:1px solid #eee;border-top:none;border-radius:0 0 10px 10px;padding:22px 24px;font-size:15px;line-height:1.6;white-space:pre-line;">${esc(message)}</div>
  <p style="font-size:12px;color:#9ca3af;margin-top:10px;text-align:center;">North Falmouth Pharmacy &middot; (508) 564-4459</p>
</div>`

  const resend = new Resend(key)
  try {
    const res: any = await resend.emails.send({ from, to, subject, html, text: message })
    if (res?.error) {
      await logEmail({ to, subject, category: "custom", status: "failed", error: res.error.message, sentBy: b.sentBy || null })
      return NextResponse.json({ error: res.error.message || "Send failed" }, { status: 502 })
    }
    await logEmail({ to, subject, category: "custom", status: "sent", resendId: res?.data?.id, sentBy: b.sentBy || null })
    return NextResponse.json({ ok: true, id: res?.data?.id || null })
  } catch (e: any) {
    await logEmail({ to, subject, category: "custom", status: "failed", error: e?.message })
    return NextResponse.json({ error: e?.message || "Send failed" }, { status: 502 })
  }
}
