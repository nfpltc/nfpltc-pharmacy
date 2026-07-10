import { createClient } from "@supabase/supabase-js"
import { sendCustomEmail } from "./send-custom-email"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Next occurrence for a recurring schedule, rolled forward past any missed runs.
export function nextSendAt(current: Date, repeat: string): Date | null {
  if (!["daily", "weekly", "monthly"].includes(repeat)) return null
  const bump = (d: Date) => {
    if (repeat === "daily") d.setDate(d.getDate() + 1)
    else if (repeat === "weekly") d.setDate(d.getDate() + 7)
    else {
      // monthly: clamp the day so Jan 31 -> Feb 28 (never skip a month).
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(day, last))
    }
  }
  const d = new Date(current)
  bump(d)
  let guard = 0
  while (d.getTime() <= Date.now() && guard++ < 100000) bump(d)
  // Never hand back a past time — the runner would immediately re-send it.
  return d.getTime() > Date.now() ? d : null
}

// Sends every scheduled email whose send_at has passed. Reschedules recurring
// ones; marks one-offs sent/failed. Claims each row first so overlapping cron
// runs can't double-send.
export async function processEmailOutbox(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = admin()
  let sent = 0, failed = 0
  try {
    // Reap rows stuck in 'sending' from a crashed/timed-out run. A resend_id
    // means the email already went out -> mark sent; otherwise it never sent
    // -> return it to 'scheduled' so it retries (no double-send either way).
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: stale } = await sb.from("email_outbox")
      .select("id, resend_id").eq("status", "sending").lt("updated_at", staleBefore)
    for (const s of stale || []) {
      await sb.from("email_outbox")
        .update({ status: s.resend_id ? "sent" : "scheduled", updated_at: new Date().toISOString() })
        .eq("id", s.id).eq("status", "sending")
    }

    const { data } = await sb.from("email_outbox")
      .select("*")
      .eq("status", "scheduled")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(50)
    const rows = data || []

    for (const row of rows) {
      // Claim: only proceed if we flip it from scheduled -> sending.
      const { data: claimed } = await sb.from("email_outbox")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "scheduled").select("id").maybeSingle()
      if (!claimed) continue

      const r = await sendCustomEmail({ to: row.to_email, subject: row.subject || "", message: row.message || "", sentBy: row.sent_by })
      if (r.ok) sent++; else failed++

      const next = r.ok ? nextSendAt(new Date(row.send_at), row.repeat || "none") : null
      if (next) {
        await sb.from("email_outbox").update({
          status: "scheduled", send_at: next.toISOString(), resend_id: r.id || null, error: null,
          sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", row.id)
      } else {
        await sb.from("email_outbox").update({
          status: r.ok ? "sent" : "failed",
          sent_at: r.ok ? new Date().toISOString() : null,
          resend_id: r.id || null, error: r.ok ? null : (r.error || "send failed"),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id)
      }
      await new Promise((res) => setTimeout(res, 400))
    }
    return { processed: rows.length, sent, failed }
  } catch {
    return { processed: 0, sent, failed }
  }
}
