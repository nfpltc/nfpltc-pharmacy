import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET — return recent email log entries; supports filtering by period & status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period")
    const status = searchParams.get("status")   // "sent" | "failed" | "bounced" | "delivered"
    const account = searchParams.get("account_number")
    const sb = admin()

    const PAGE = 1000
    const out: any[] = []
    let from = 0
    while (from < 200_000) {
      let q = sb.from("statement_email_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1)
      if (period)  q = q.eq("billing_period", period)
      if (status)  q = q.eq("status", status)
      if (account) q = q.eq("account_number", account)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      out.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }

    // Summary by status
    const byStatus: Record<string, number> = {}
    for (const r of out) byStatus[r.status] = (byStatus[r.status] || 0) + 1

    return NextResponse.json({ log: out, summary: byStatus, total: out.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
