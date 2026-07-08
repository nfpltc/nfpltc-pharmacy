import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { renderOverdueEmail, formatBillingPeriodLabel, signUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
const num = (v: any) => (v == null ? 0 : Number(v) || 0)

// POST /api/admin/finance/overdue/send
//   { month: 'YYYY-MM', bucket?: 'all'|'30'|'60'|'90'|'120', account_number?: string }
// Emails a past-due reminder (with the statement link) to overdue customers who
// have an email and aren't opted out. Deduped to ONE reminder per account per
// month via statement_email_log (billing_period = 'YYYY-MM:overdue'), so a
// customer can't be dunned twice in a month across different bucket campaigns
// or the per-customer button. When account_number is given, sends to just that
// one customer (bucket ignored) — used by the button on the admin customer page.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const month = String(b.month || "")
  const account = typeof b.account_number === "string" && b.account_number.trim() ? b.account_number.trim() : null
  // Single-customer sends ignore the bucket (send if they have any past-due).
  // The dedupe key is bucket-independent (below), so no double-dunning.
  const bucket = account ? "all" : (["30", "60", "90", "120"].includes(b.bucket) ? b.bucket : "all")
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Pick a month" }, { status: 400 })

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return NextResponse.json({ error: "Email is not configured (RESEND_API_KEY)." }, { status: 500 })
  const from = process.env.STATEMENT_FROM_EMAIL || process.env.FROM_EMAIL
  if (!from) return NextResponse.json({ error: "No sender email configured (STATEMENT_FROM_EMAIL)." }, { status: 500 })
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nfpltc.com").replace(/\/+$/, "")
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sb = admin()
  const resend = new Resend(RESEND_API_KEY)

  // Overdue statement rows for the month (scoped to one account when single-send).
  const rows: any[] = []
  const PAGE = 1000
  for (let f = 0; f < 100_000; f += PAGE) {
    let q = sb.from("customer_statements")
      .select("first_name, last_name, account_number, over_30, over_60, over_90, over_120")
      .eq("billing_period", month)
      .or("over_30.gt.0,over_60.gt.0,over_90.gt.0,over_120.gt.0")
      .order("account_number", { ascending: true })
    if (account) q = q.eq("account_number", account)
    const { data, error } = await q.range(f, f + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  // Email map — just the one customer for single-send, else the whole table.
  const emails: Record<string, { email: string | null; opted_out: boolean }> = {}
  if (account) {
    const { data } = await sb.from("customers")
      .select("account_number, email, email_opt_in").eq("account_number", account).maybeSingle()
    if (data) emails[data.account_number] = { email: data.email || null, opted_out: data.email_opt_in === false }
  } else {
    for (let f = 0; f < 100_000; f += PAGE) {
      const { data } = await sb.from("customers").select("account_number, email, email_opt_in")
        .order("account_number", { ascending: true }).range(f, f + PAGE - 1)
      if (!data?.length) break
      for (const c of data) emails[c.account_number] = { email: c.email || null, opted_out: c.email_opt_in === false }
      if (data.length < PAGE) break
    }
  }

  const bucketKey = ({ "30": "over_30", "60": "over_60", "90": "over_90", "120": "over_120" } as any)[bucket]
  const recipients = rows
    .filter((r) => (bucketKey ? num(r[bucketKey]) > 0 : true))
    .map((r) => ({ ...r, ...(emails[r.account_number] || { email: null, opted_out: false }) }))
    .filter((r) => r.email && !r.opted_out)
    // one email per account (a customer may have >1 statement row)
    .filter((r, i, a) => a.findIndex((x) => x.account_number === r.account_number) === i)

  // Bucket-independent dedupe key: one overdue reminder per account per month,
  // no matter which bucket campaign or the per-customer button triggered it.
  const logPeriod = `${month}:overdue`
  const label = formatBillingPeriodLabel(month)
  let sent = 0, failed = 0, skipped = 0

  const send = async (r: any) => {
    // Dedupe: insert a queued log row; a duplicate (same account+logPeriod) is skipped.
    const { data: logRow, error: logErr } = await sb.from("statement_email_log")
      .insert({ account_number: r.account_number, billing_period: logPeriod, email_to: r.email, status: "queued" })
      .select("id").single()
    if (logErr) { skipped++; return }
    const unsub = `${base}/unsubscribe?t=${signUnsubscribeToken(r.account_number, secret)}`
    const { subject, html, text } = renderOverdueEmail({
      firstName: r.first_name, lastName: r.last_name, billingPeriodLabel: label,
      statementsUrl: `${base}/forms/statements`, unsubscribeUrl: unsub,
    })
    try {
      const res: any = await resend.emails.send({
        from, to: r.email, subject, html, text,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      })
      if (res?.error) throw new Error(res.error.message || "send failed")
      await sb.from("statement_email_log").update({ status: "sent", resend_message_id: res?.data?.id || null, sent_at: new Date().toISOString() }).eq("id", logRow.id)
      sent++
    } catch (e: any) {
      await sb.from("statement_email_log").update({ status: "failed", error_message: String(e.message || e).slice(0, 300) }).eq("id", logRow.id)
      failed++
    }
  }

  // Concurrency 5.
  for (let i = 0; i < recipients.length; i += 5) {
    await Promise.all(recipients.slice(i, i + 5).map(send))
  }

  return NextResponse.json({ ok: true, month, bucket, label, sent, failed, skipped, recipients: recipients.length })
}
