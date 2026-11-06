import { NextResponse } from "next/server"
import { getPortalUser } from "@/lib/portal-auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getPortalUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const sb = supabaseAdmin()
    const acct = user.account_number

    // Fetch customer info
    const { data: customer } = await sb
      .from("customers")
      .select("first_name, last_name, email, phone")
      .eq("account_number", acct)
      .maybeSingle()

    // Fetch all statements for this account (newest first)
    const { data: statements } = await sb
      .from("customer_statements")
      .select("id, billing_period, amount_due, balance, previous_balance, charges, payments, over_30, over_60, over_90, over_120, facility, file_path, file_name, bill_date")
      .eq("account_number", acct)
      .order("billing_period", { ascending: false })

    const rows = statements || []

    // Latest statement = current state
    const latest = rows[0] || null
    const currentBalance = latest?.balance ?? latest?.amount_due ?? 0
    const overdue = (latest?.over_30 ?? 0) + (latest?.over_60 ?? 0) + (latest?.over_90 ?? 0) + (latest?.over_120 ?? 0)

    // Monthly trend (last 12 months) for chart
    const trend = rows.slice(0, 12).reverse().map(s => ({
      period: s.billing_period,
      balance: s.balance ?? s.amount_due ?? 0,
      charges: s.charges ?? 0,
      payments: s.payments ?? 0,
    }))

    // Aging breakdown for the latest period
    const aging = latest ? {
      current: Math.max(0, (latest.balance ?? 0) - (latest.over_30 ?? 0) - (latest.over_60 ?? 0) - (latest.over_90 ?? 0) - (latest.over_120 ?? 0)),
      over_30: latest.over_30 ?? 0,
      over_60: latest.over_60 ?? 0,
      over_90: latest.over_90 ?? 0,
      over_120: latest.over_120 ?? 0,
    } : null

    // Generate signed URLs for the most recent 12 statements
    const recentStatements = await Promise.all(
      rows.slice(0, 12).map(async (s) => {
        let file_url: string | null = null
        if (s.file_path) {
          try {
            const { data: signed } = await sb.storage
              .from("customer-statements")
              .createSignedUrl(s.file_path, 3600)
            file_url = signed?.signedUrl || null
          } catch { /* ignore */ }
        }
        return {
          id: s.id,
          billing_period: s.billing_period,
          amount_due: s.amount_due ?? 0,
          balance: s.balance ?? 0,
          charges: s.charges ?? 0,
          payments: s.payments ?? 0,
          bill_date: s.bill_date,
          file_url,
        }
      })
    )

    // Total paid all time
    const totalPaid = rows.reduce((sum, s) => sum + (s.payments ?? 0), 0)
    const totalCharged = rows.reduce((sum, s) => sum + (s.charges ?? 0), 0)

    return NextResponse.json({
      customer: {
        first_name: customer?.first_name || "",
        last_name: customer?.last_name || "",
        account_number: acct,
      },
      summary: {
        current_balance: currentBalance,
        overdue_amount: overdue,
        total_paid: totalPaid,
        total_charged: totalCharged,
        statement_count: rows.length,
      },
      aging,
      trend,
      statements: recentStatements,
    })
  } catch (e: any) {
    console.error("Dashboard error:", e)
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 })
  }
}
