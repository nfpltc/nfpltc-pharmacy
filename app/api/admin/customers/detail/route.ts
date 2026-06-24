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

    // 2) Statements (all periods for this account)
    const { data: statements, error: sErr } = await sb
      .from("customer_statements")
      .select("id, billing_period, file_name, bill_date, amount_due, created_at")
      .eq("account_number", account)
      .order("billing_period", { ascending: false })
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
