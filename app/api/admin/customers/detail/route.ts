import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/customers/detail?account_number=XXXX
// Returns everything we know about one customer:
//   - profile (full customer row)
//   - statements (all their statement rows, newest first)
//   - email_history (all statement emails sent to them)
// Used by the CRM expandable row in the admin customers page.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get("account_number")?.trim()
    if (!account) {
      return NextResponse.json({ error: "account_number is required" }, { status: 400 })
    }

    const sb = admin()

    // 1) Profile
    const { data: profile, error: pErr } = await sb
      .from("customers")
      .select("*")
      .eq("account_number", account)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    // 2) Statements (all periods for this account). Try to include the aging /
    //    financial columns; if this env hasn't run the financials migration,
    //    fall back to the base columns so the panel still loads.
    const BASE_COLS = "id, billing_period, file_name, bill_date, amount_due, created_at"
    const FIN_COLS = "facility, over_30, over_60, over_90, over_120, balance, previous_balance, charges, payments"
    let statements: any[] = []
    {
      const withFin = await sb
        .from("customer_statements")
        .select(`${BASE_COLS}, ${FIN_COLS}`)
        .eq("account_number", account)
        .order("billing_period", { ascending: false })
      if (withFin.error) {
        const base = await sb
          .from("customer_statements")
          .select(BASE_COLS)
          .eq("account_number", account)
          .order("billing_period", { ascending: false })
        if (base.error) return NextResponse.json({ error: base.error.message }, { status: 500 })
        statements = base.data || []
      } else {
        statements = withFin.data || []
      }
    }

    // Overdue summary — aggregate this account's most recent statement month
    // that carries financials. A single account can have >1 row for a month
    // (one per facility), and the Money/Overdue pages sum across them, so we do
    // too. Older split-file months may carry no financials at all.
    const num = (v: any) => (v == null ? 0 : Number(v) || 0)
    const hasFin = (s: any) => [s.over_30, s.over_60, s.over_90, s.over_120, s.balance].some((v) => v != null)
    const finRows = statements.filter(hasFin) // newest-first (statements are billing_period desc)
    let overdue: any = null
    if (finRows.length) {
      const period = finRows[0].billing_period
      const monthRows = finRows.filter((s) => s.billing_period === period)
      const sum = (k: string) => monthRows.reduce((a, s) => a + num(s[k]), 0)
      const o30 = sum("over_30"), o60 = sum("over_60"), o90 = sum("over_90"), o120 = sum("over_120")
      const total = o30 + o60 + o90 + o120
      const facilities = Array.from(new Set(monthRows.map((s) => s.facility).filter(Boolean)))
      const hasBalance = monthRows.some((s) => s.balance != null)
      overdue = {
        period,
        facility: facilities.length ? facilities.join(", ") : null,
        over_30: o30, over_60: o60, over_90: o90, over_120: o120,
        total_overdue: total,
        balance: hasBalance ? monthRows.reduce((a, s) => a + num(s.balance), 0) : null,
        is_overdue: total > 0,
      }
    }

    // 3) Email history — statement emails sent to this account
    let emailHistory: any[] = []
    try {
      const { data: emails } = await sb
        .from("statement_email_log")
        .select("id, billing_period, email_to, status, error_message, sent_at, resend_message_id")
        .eq("account_number", account)
        .order("sent_at", { ascending: false })
      emailHistory = emails || []
    } catch {
      emailHistory = []  // table may not exist in some envs; non-fatal
    }

    return NextResponse.json({
      profile: profile || null,
      statements: statements || [],
      email_history: emailHistory,
      overdue,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
