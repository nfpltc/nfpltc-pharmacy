import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

// GET /api/admin/finance/overdue?month=YYYY-MM&bucket=all|30|60|90|120
// Overdue customers for a month (optionally one aging bucket), joined with their
// email + opt-out status so we know who can be emailed.
export async function GET(req: NextRequest) {
  const sb = admin()
  const sp = new URL(req.url).searchParams
  let month = sp.get("month") || ""
  const bucket = sp.get("bucket") || "all"

  // Default to the latest month that has financials.
  if (!month) {
    const { data } = await sb.from("customer_statements")
      .select("billing_period").not("over_30", "is", null)
      .order("billing_period", { ascending: false }).limit(1)
    month = data?.[0]?.billing_period || ""
  }
  if (!month) return NextResponse.json({ month: null, customers: [], summary: {} })

  // Overdue statement rows for the month.
  const rows: any[] = []
  const PAGE = 1000
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await sb.from("customer_statements")
      .select("id, first_name, last_name, account_number, facility, over_30, over_60, over_90, over_120, balance")
      .eq("billing_period", month)
      .or("over_30.gt.0,over_60.gt.0,over_90.gt.0,over_120.gt.0")
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  // Email map from the customers table (keyed by account_number).
  const emails: Record<string, { email: string | null; opted_out: boolean }> = {}
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data } = await sb.from("customers").select("account_number, email, email_opt_in").range(from, from + PAGE - 1)
    if (!data?.length) break
    for (const c of data) emails[c.account_number] = { email: c.email || null, opted_out: c.email_opt_in === false }
    if (data.length < PAGE) break
  }

  const bucketKey = ({ "30": "over_30", "60": "over_60", "90": "over_90", "120": "over_120" } as any)[bucket]
  let list = rows.map((r) => {
    const total = num(r.over_30) + num(r.over_60) + num(r.over_90) + num(r.over_120)
    const e = emails[r.account_number] || { email: null, opted_out: false }
    return {
      id: r.id, first_name: r.first_name, last_name: r.last_name, account_number: r.account_number,
      facility: r.facility, over_30: num(r.over_30), over_60: num(r.over_60), over_90: num(r.over_90), over_120: num(r.over_120),
      total_overdue: total, balance: r.balance != null ? Number(r.balance) : null, email: e.email, opted_out: e.opted_out,
    }
  })
  if (bucketKey) list = list.filter((r: any) => r[bucketKey] > 0)
  list.sort((a, b) => b.total_overdue - a.total_overdue)

  const emailable = list.filter((r) => r.email && !r.opted_out)
  return NextResponse.json({
    month,
    customers: list,
    summary: {
      total: list.length,
      emailable: emailable.length,
      no_email: list.filter((r) => !r.email).length,
      opted_out: list.filter((r) => r.email && r.opted_out).length,
      total_overdue: list.reduce((s, r) => s + r.total_overdue, 0),
    },
  })
}
