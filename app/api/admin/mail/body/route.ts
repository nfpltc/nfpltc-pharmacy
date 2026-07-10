import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { renderStatementEmail, renderOverdueEmail, formatBillingPeriodLabel, signUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Live fetch from Resend by message id (fallback — Resend doesn't always keep the body).
async function fetchResendEmail(resendId: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || !resendId) return null
  try {
    const r = await fetch(`https://api.resend.com/emails/${resendId}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" })
    if (!r.ok) return null
    const d = await r.json()
    return { subject: d?.subject || null, html: d?.html || null, text: d?.text || null, to: Array.isArray(d?.to) ? d.to.join(", ") : d?.to || null, date: d?.created_at || null }
  } catch { return null }
}

const NOT_AVAILABLE = { available: false, error: "This email's body isn't available for this message." }

// GET /api/admin/mail/body?id=el_<uuid> | sl_<uuid>
export async function GET(req: NextRequest) {
  const sb = admin()
  const raw = new URL(req.url).searchParams.get("id") || ""
  const us = raw.indexOf("_")
  const prefix = us > 0 ? raw.slice(0, us) : ""
  const id = us > 0 ? raw.slice(us + 1) : ""
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  // email_log rows: prefer the body we stored (meta.html), else Resend.
  if (prefix === "el") {
    const { data } = await sb.from("email_log").select("resend_id, subject, to_email, meta, created_at").eq("id", id).maybeSingle()
    const stored = (data?.meta && typeof data.meta === "object") ? (data.meta as any).html : null
    if (stored) return NextResponse.json({ available: true, subject: data?.subject, html: stored, to: data?.to_email, date: data?.created_at, source: "stored" })
    const remote = await fetchResendEmail(data?.resend_id || "")
    if (remote && (remote.html || remote.text)) return NextResponse.json({ available: true, ...remote })
    return NextResponse.json(NOT_AVAILABLE)
  }

  // statement / past-due rows: re-render from the exact template (always available).
  if (prefix === "sl") {
    const { data } = await sb.from("statement_email_log")
      .select("account_number, billing_period, email_to, resend_message_id, sent_at").eq("id", id).maybeSingle()
    if (data) {
      try {
        const period = String(data.billing_period || "")
        const isOverdue = period.includes(":overdue")
        const monthPeriod = period.split(":")[0]
        const { data: cust } = await sb.from("customers").select("first_name, last_name").eq("account_number", data.account_number).maybeSingle()
        const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nfpltc.com").replace(/\/+$/, "")
        const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
        const params = {
          firstName: cust?.first_name || "", lastName: cust?.last_name || "",
          billingPeriodLabel: formatBillingPeriodLabel(monthPeriod),
          statementsUrl: `${base}/forms/statements`,
          unsubscribeUrl: `${base}/unsubscribe?t=${signUnsubscribeToken(String(data.account_number || ""), secret)}`,
        }
        const rendered = isOverdue ? renderOverdueEmail(params) : renderStatementEmail(params)
        return NextResponse.json({ available: true, subject: rendered.subject, html: rendered.html, to: data.email_to, date: data.sent_at, source: "rerendered" })
      } catch { /* fall back to Resend */ }
      const remote = await fetchResendEmail(data.resend_message_id || "")
      if (remote && (remote.html || remote.text)) return NextResponse.json({ available: true, ...remote })
    }
    return NextResponse.json(NOT_AVAILABLE)
  }

  return NextResponse.json(NOT_AVAILABLE)
}
