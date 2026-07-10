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
const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)

// GET → pending drafts / scheduled / failed emails (not yet sent).
export async function GET() {
  const sb = admin()
  const { data, error } = await sb.from("email_outbox")
    .select("id, to_email, to_name, subject, message, status, send_at, repeat, error, updated_at")
    .in("status", ["draft", "scheduled", "sending", "failed"])
    .order("updated_at", { ascending: false }).limit(200)
  if (error) return NextResponse.json({ items: [], error: error.message })
  return NextResponse.json({ items: data || [] })
}

// POST { action: 'save' | 'schedule' | 'send' | 'delete', ... }
export async function POST(req: NextRequest) {
  const sb = admin()
  const b = await req.json().catch(() => ({}))
  const action = b.action

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const { error } = await sb.from("email_outbox").delete().eq("id", b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === "send") {
    // Atomically claim (only one caller can flip it) so a double-click or a
    // race with the cron can't send the same email twice.
    const { data: row } = await sb.from("email_outbox")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", b.id).in("status", ["draft", "scheduled", "failed"]).select("*").maybeSingle()
    if (!row) return NextResponse.json({ error: "This email is already sending or sent." }, { status: 409 })
    const r = await sendCustomEmail({ to: row.to_email, subject: row.subject || "", message: row.message || "", sentBy: b.sentBy })
    await sb.from("email_outbox").update({
      status: r.ok ? "sent" : "failed", sent_at: r.ok ? new Date().toISOString() : null,
      resend_id: r.id || null, error: r.ok ? null : (r.error || "send failed"), updated_at: new Date().toISOString(),
    }).eq("id", row.id)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true })
  }

  if (action === "save" || action === "schedule") {
    const to = String(b.to || "").trim()
    const subject = String(b.subject || "").trim()
    const message = String(b.message || "").trim()
    if (!emailOk(to)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 })
    const repeat = ["daily", "weekly", "monthly"].includes(b.repeat) ? b.repeat : "none"
    const send_at = b.send_at ? new Date(b.send_at) : null
    if (action === "schedule") {
      if (!send_at || isNaN(send_at.getTime())) return NextResponse.json({ error: "Pick a date & time." }, { status: 400 })
      if (send_at.getTime() <= Date.now() - 60_000) return NextResponse.json({ error: "Scheduled time must be in the future." }, { status: 400 })
    }
    const row: any = {
      to_email: to, to_name: b.to_name || null, subject, message,
      status: action === "schedule" ? "scheduled" : "draft",
      repeat: action === "schedule" ? repeat : "none",
      send_at: action === "schedule" ? send_at!.toISOString() : null,
      error: null, updated_at: new Date().toISOString(),
    }
    if (b.id) {
      const { data, error } = await sb.from("email_outbox").update(row).eq("id", b.id).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ error: "This email no longer exists — it may have been sent or deleted. Reload and try again." }, { status: 409 })
      return NextResponse.json({ ok: true, item: data })
    }
    const { data, error } = await sb.from("email_outbox").insert(row).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
