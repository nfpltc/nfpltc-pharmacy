import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const firstName = searchParams.get("first_name")?.trim()
    const lastName = searchParams.get("last_name")?.trim()
    const account = searchParams.get("account")?.trim()
    const period = searchParams.get("period")
    const periodsOnly = searchParams.get("periods_only")

    const sb = admin()

    // ──────────────────────────────────────────────────────────────────────
    // Gate enforcement: every request to this endpoint requires a valid
    // stmt_viewer cookie (set after the visitor passes the name+email gate).
    // ──────────────────────────────────────────────────────────────────────
    const viewerLogId = req.cookies.get("stmt_viewer")?.value
    if (!viewerLogId) {
      return NextResponse.json(
        { error: "Please enter your name and email to view statements", needs_gate: true },
        { status: 401 }
      )
    }

    // Helper to fetch all distinct billing_periods (paginated past 1000-row cap)
    const fetchAllPeriods = async (): Promise<string[]> => {
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
      return Array.from(periodsSet).sort().reverse()
    }

    // periods_only mode (used to populate dropdown before searching)
    if (periodsOnly) {
      const periods = await fetchAllPeriods()
      return NextResponse.json({ statements: [], periods })
    }

    if (!firstName || !lastName || !account) {
      return NextResponse.json(
        { error: "First name, last name, and account number are required" },
        { status: 400 }
      )
    }

    // Build query — case-insensitive search
    let query = sb.from("customer_statements")
      .select("id, first_name, last_name, account_number, billing_period, file_path, file_name, bill_date, amount_due")
      .order("billing_period", { ascending: false })

    if (lastName)  query = query.ilike("last_name", `%${lastName}%`)
    if (firstName) query = query.ilike("first_name", `%${firstName}%`)
    if (account)   query = query.eq("account_number", account)
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

    // Update the audit log row with what they searched for and whether they
    // found results. Best-effort — failure to log doesn't block the user.
    try {
      await sb.from("statement_viewer_log").update({
        account_number_attempted: account,
        statement_viewed: results.length > 0,
        searched_at: new Date().toISOString(),
      }).eq("id", viewerLogId)
    } catch (e) {
      console.error("statement viewer log update failed (non-fatal):", e)
    }

    const uniquePeriods = await fetchAllPeriods()
    return NextResponse.json({ statements: results, periods: uniquePeriods })
  } catch (err: any) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
