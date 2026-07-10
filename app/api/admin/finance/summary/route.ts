import { NextResponse } from "next/server"
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

const n = (v: any) => (v == null ? 0 : Number(v) || 0)

// GET /api/admin/finance/summary
// Aggregates the per-customer financials (bulk-indexed months) into a monthly
// money view: revenue (charges), collected (payments), outstanding (balance),
// aging buckets + overdue counts, plus overdue-by-facility for the latest month
// and any recorded expenses.
export async function GET() {
  const sb = admin()

  // Pull only rows that carry financials (bulk-indexed statements).
  const rows: any[] = []
  const PAGE = 1000
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await sb
      .from("customer_statements")
      .select("billing_period, charges, payments, balance, over_30, over_60, over_90, over_120, facility")
      .not("charges", "is", null)
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  // Aggregate by month.
  const byMonth: Record<string, any> = {}
  for (const r of rows) {
    const m = r.billing_period || "?"
    const b = (byMonth[m] ||= {
      month_ym: m, revenue: 0, collected: 0, outstanding: 0,
      over_30: 0, over_60: 0, over_90: 0, over_120: 0, overdue_count: 0, customers: 0,
    })
    b.revenue += n(r.charges); b.collected += n(r.payments); b.outstanding += n(r.balance)
    b.over_30 += n(r.over_30); b.over_60 += n(r.over_60); b.over_90 += n(r.over_90); b.over_120 += n(r.over_120)
    b.customers++
    if (n(r.over_30) + n(r.over_60) + n(r.over_90) + n(r.over_120) > 0) b.overdue_count++
  }
  const months = Object.values(byMonth).sort((a: any, b: any) => String(b.month_ym).localeCompare(String(a.month_ym)))
  const latest = (months[0] as any)?.month_ym || null

  // Overdue by facility, per month (so the dashboard can show the selected month).
  const facByMonth: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    const od = n(r.over_30) + n(r.over_60) + n(r.over_90) + n(r.over_120)
    if (od <= 0) continue
    const m = r.billing_period || "?"
    const key = r.facility || "—"
    ;(facByMonth[m] ||= {})[key] = (facByMonth[m][key] || 0) + od
  }
  const facilities_by_month: Record<string, { facility: string; overdue: number }[]> = {}
  for (const [m, map] of Object.entries(facByMonth)) {
    facilities_by_month[m] = Object.entries(map)
      .map(([facility, overdue]) => ({ facility, overdue }))
      .sort((a, b) => b.overdue - a.overdue)
  }
  const facilities = facilities_by_month[latest || ""] || []  // latest month (kept for compat)

  // Expenses (optional).
  const { data: exp } = await sb.from("pharmacy_expenses").select("id, month_ym, category, label, amount").order("month_ym", { ascending: false })
  const expByMonth: Record<string, number> = {}
  for (const e of exp || []) expByMonth[e.month_ym] = (expByMonth[e.month_ym] || 0) + n(e.amount)
  for (const m of months as any[]) m.expenses = expByMonth[m.month_ym] || 0

  return NextResponse.json({ months, facilities, facilities_by_month, latest_month: latest, expenses: exp || [] })
}
