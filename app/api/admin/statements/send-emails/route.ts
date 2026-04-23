import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import {
  renderStatementEmail,
  formatBillingPeriodLabel,
  signUnsubscribeToken,
} from "@/lib/statement-email"

export const runtime = "nodejs"
export const maxDuration = 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Base URL for the public statements link
function publicBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, "")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host  = req.headers.get("host") || "www.nfpltc.com"
  return `${proto}://${host}`
}

// Secret for unsubscribe tokens: reuse service role key (already secret, deploy-scoped)
function unsubSecret() {
  return (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string
}

// =============================================================================
// GET: preview counts for a given billing period
// Query:
//   ?period=2026-03                 -> preview (no sending)
//   &include_missing_statement=1    -> include customers with no stmt for that period
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get("period") || "").trim()
    const includeMissing = searchParams.get("include_missing_statement") === "1"
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period must be YYYY-MM (e.g. 2026-03)" }, { status: 400 })
    }

    const sb = admin()

    // 1) All customers (paginated past 1000-row cap)
    const customers = await fetchAll(sb, "customers", "account_number, first_name, last_name, email, email_opt_in")

    // 2) Statements that exist for the period (just the account_numbers)
    const stmts = await fetchAll(sb, "customer_statements", "account_number", q => q.eq("billing_period", period))
    const acctsWithStatement = new Set<string>((stmts as any[]).map(s => s.account_number))

    // 3) Already-sent log for that period
    const sentLog = await fetchAll(
      sb, "statement_email_log",
      "account_number, status",
      q => q.eq("billing_period", period).in("status", ["queued", "sent", "delivered"])
    )
    const alreadySent = new Set<string>((sentLog as any[]).map(l => l.account_number))

    // Bucket each customer
    let no_email = 0, opted_out = 0, already_sent = 0, missing_statement = 0, will_send = 0
    const eligible: any[] = []
    for (const c of customers as any[]) {
      if (!c.email || !c.email.trim())           { no_email++; continue }
      if (c.email_opt_in === false)              { opted_out++; continue }
      if (alreadySent.has(c.account_number))     { already_sent++; continue }
      if (!acctsWithStatement.has(c.account_number)) {
        missing_statement++
        if (!includeMissing) continue
      }
      will_send++
      eligible.push({
        account_number: c.account_number,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        has_statement: acctsWithStatement.has(c.account_number),
      })
    }

    return NextResponse.json({
      period,
      period_label: formatBillingPeriodLabel(period),
      totals: {
        total_customers:   customers.length,
        statements_in_period: acctsWithStatement.size,
        no_email, opted_out, already_sent, missing_statement, will_send,
      },
      eligible_sample: eligible.slice(0, 5),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// =============================================================================
// POST: actually send emails. Two modes:
//   { mode: "bulk",   period: "2026-03", include_missing_statement: boolean }
//   { mode: "single", period: "2026-03", account_number: "123456" }
//
// Synchronous send (no background queue) — fine for <= a few hundred. For
// very large batches Resend's rate limits will slow us naturally.
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mode = body.mode as "bulk" | "single"
    const period = String(body.period || "").trim()
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 })
    }
    if (mode !== "bulk" && mode !== "single") {
      return NextResponse.json({ error: "mode must be 'bulk' or 'single'" }, { status: 400 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL     = process.env.FROM_EMAIL
    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return NextResponse.json({ error: "RESEND_API_KEY or FROM_EMAIL not configured" }, { status: 500 })
    }

    const sb = admin()
    const resend = new Resend(RESEND_API_KEY)

    // Build recipient list
    let recipients: any[] = []

    if (mode === "single") {
      const acct = String(body.account_number || "").trim()
      if (!acct) return NextResponse.json({ error: "account_number required for single mode" }, { status: 400 })

      const { data: c, error } = await sb.from("customers")
        .select("account_number, first_name, last_name, email, email_opt_in")
        .eq("account_number", acct).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
      if (!c.email)                return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 })
      if (c.email_opt_in === false) return NextResponse.json({ error: "Customer has opted out" }, { status: 400 })

      recipients = [c]
    } else {
      // Bulk
      const includeMissing = body.include_missing_statement === true

      const customers = await fetchAll(sb, "customers", "account_number, first_name, last_name, email, email_opt_in")
      const stmts = await fetchAll(sb, "customer_statements", "account_number", q => q.eq("billing_period", period))
      const acctsWithStatement = new Set<string>((stmts as any[]).map(s => s.account_number))
      const sentLog = await fetchAll(
        sb, "statement_email_log",
        "account_number",
        q => q.eq("billing_period", period).in("status", ["queued", "sent", "delivered"])
      )
      const alreadySent = new Set<string>((sentLog as any[]).map(l => l.account_number))

      for (const c of customers as any[]) {
        if (!c.email) continue
        if (c.email_opt_in === false) continue
        if (alreadySent.has(c.account_number)) continue
        if (!acctsWithStatement.has(c.account_number) && !includeMissing) continue
        recipients.push(c)
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, failures: [], message: "No eligible recipients" })
    }

    // Send (with small concurrency to stay within Resend's rate limits)
    const base = publicBaseUrl(req)
    const statementsUrl = `${base}/forms/statements`
    const label = formatBillingPeriodLabel(period)
    const secret = unsubSecret()

    let sent = 0
    const failures: Array<{ account: string; email: string; error: string }> = []
    const CONCURRENCY = 5

    async function sendOne(c: any) {
      const unsubscribeUrl = `${base}/unsubscribe?t=${signUnsubscribeToken(c.account_number, secret)}`
      const { subject, html, text } = renderStatementEmail({
        firstName: c.first_name,
        lastName: c.last_name,
        billingPeriodLabel: label,
        statementsUrl,
        unsubscribeUrl,
      })

      // First: insert a "queued" log row so we have a record even if send fails.
      // Uses UNIQUE constraint on (account, period, active-status) to skip dups.
      const { data: logRow, error: logErr } = await sb.from("statement_email_log").insert({
        account_number: c.account_number,
        billing_period: period,
        email_to: c.email,
        status: "queued",
      }).select("id").single()

      if (logErr) {
        // 23505 = unique violation = already sent, skip silently
        if ((logErr as any).code !== "23505") {
          failures.push({ account: c.account_number, email: c.email, error: `log insert: ${logErr.message}` })
        }
        return
      }

      // Send via Resend
      try {
        const r = await resend.emails.send({
          from: FROM_EMAIL!,
          to: c.email,
          subject,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })
        if ((r as any).error) throw new Error((r as any).error.message || "resend error")
        const messageId = (r as any).data?.id || null

        await sb.from("statement_email_log").update({
          status: "sent",
          resend_message_id: messageId,
          sent_at: new Date().toISOString(),
        }).eq("id", logRow.id)
        sent++
      } catch (e: any) {
        await sb.from("statement_email_log").update({
          status: "failed",
          error_message: e.message?.slice(0, 500) || "unknown error",
        }).eq("id", logRow.id)
        failures.push({ account: c.account_number, email: c.email, error: e.message || "unknown error" })
      }
    }

    // Run with a small concurrency window
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const slice = recipients.slice(i, i + CONCURRENCY)
      await Promise.all(slice.map(sendOne))
    }

    return NextResponse.json({
      sent, failed: failures.length, failures: failures.slice(0, 50),
      total_attempted: recipients.length, period, period_label: label,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---- helper: paginate past 1000-row cap on a table ----
async function fetchAll(
  sb: ReturnType<typeof admin>, table: string, columns: string,
  filter?: (q: any) => any
) {
  const PAGE = 1000
  const out: any[] = []
  let from = 0
  while (from < 200_000) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}
