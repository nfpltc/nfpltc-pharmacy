import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const firstName = searchParams.get("first_name")?.trim()
    const lastName = searchParams.get("last_name")?.trim()
    const account = searchParams.get("account")?.trim()
    const period = searchParams.get("period")

    if (!firstName || !lastName || !account) {
      // Allow fetching just periods without name search
      const periodsOnly = searchParams.get("periods_only")
      if (periodsOnly) {
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )
        // Paginate to get ALL periods — Supabase caps each call at 1000 rows.
        const periodsSet = new Set<string>()
        const PAGE_SIZE = 1000
        let pFrom = 0
        while (pFrom < 200_000) {
          const { data: pageP } = await sb
            .from("customer_statements")
            .select("billing_period")
            .order("billing_period", { ascending: false })
            .range(pFrom, pFrom + PAGE_SIZE - 1)
          if (!pageP || pageP.length === 0) break
          for (const row of pageP) if (row.billing_period) periodsSet.add(row.billing_period)
          if (pageP.length < PAGE_SIZE) break
          pFrom += PAGE_SIZE
        }
        const uniquePeriods = Array.from(periodsSet).sort().reverse()
        return NextResponse.json({ statements: [], periods: uniquePeriods })
      }
      return NextResponse.json({ error: "First name, last name, and account number are required" }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Build query — case-insensitive search
    let query = sb.from("customer_statements")
      .select("id, first_name, last_name, account_number, billing_period, file_path, file_name, bill_date, amount_due")
      .order("billing_period", { ascending: false })

    if (lastName) query = query.ilike("last_name", `%${lastName}%`)
    if (firstName) query = query.ilike("first_name", `%${firstName}%`)
    if (account) query = query.eq("account_number", account)
    if (period && period !== "all") query = query.eq("billing_period", period)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: "Search failed" }, { status: 500 })

    // Generate signed URLs for PDF viewing/download
    const results = await Promise.all(
      (data || []).map(async (s: any) => {
        if (s.file_path) {
          try {
            const { data: signed } = await sb.storage
              .from("customer-statements")
              .createSignedUrl(s.file_path, 3600)
            s.file_url = signed?.signedUrl || null
          } catch { s.file_url = null }
        }
        return s
      })
    )

    // Get available periods for the dropdown (paginated to get ALL months, not just newest 1000 rows)
    const periodsSet = new Set<string>()
    const P_SIZE = 1000
    let pFrom2 = 0
    while (pFrom2 < 200_000) {
      const { data: pageP } = await sb
        .from("customer_statements")
        .select("billing_period")
        .order("billing_period", { ascending: false })
        .range(pFrom2, pFrom2 + P_SIZE - 1)
      if (!pageP || pageP.length === 0) break
      for (const row of pageP) if (row.billing_period) periodsSet.add(row.billing_period)
      if (pageP.length < P_SIZE) break
      pFrom2 += P_SIZE
    }
    const uniquePeriods = Array.from(periodsSet).sort().reverse()

    return NextResponse.json({ statements: results, periods: uniquePeriods })
  } catch (err: any) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
