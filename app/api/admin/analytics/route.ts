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

// All tables we track on the dashboard. Each has a created_at column we can
// bucket by. For statements we use billing_period instead since that's the
// month the statement is FOR, not when it was uploaded.
type SourceConfig = {
  key: string
  table: string
  dateColumn: string  // 'created_at' for most; 'billing_period' for statements
}

const SOURCES: SourceConfig[] = [
  { key: "enrollments",  table: "enrollment_submissions",  dateColumn: "created_at" },
  { key: "vaccines",     table: "vaccine_submissions",     dateColumn: "created_at" },
  { key: "credit_cards", table: "credit_card_submissions", dateColumn: "created_at" },
  { key: "contacts",     table: "contact_submissions",     dateColumn: "created_at" },
  { key: "statements",   table: "customer_statements",     dateColumn: "billing_period" },
]

// Paginate past the 1000-row Supabase cap to fetch all timestamps for one source
async function fetchAllDates(sb: any, table: string, column: string): Promise<string[]> {
  const PAGE = 1000
  const out: string[] = []
  let from = 0
  while (from < 200_000) {
    const { data, error } = await sb
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const row of data) {
      const v = (row as any)[column]
      if (v) out.push(String(v))
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// Convert a date or YYYY-MM string into "YYYY-MM" bucket key
function toMonthKey(value: string): string {
  // billing_period is already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(value)) return value
  // Otherwise treat as ISO timestamp
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// Same idea but daily bucket (YYYY-MM-DD)
function toDayKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

// Generate the last N month keys ending at current month
function lastNMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return out
}

export async function GET(_req: NextRequest) {
  try {
    const sb = admin()

    const today = new Date()
    const todayKey = today.toISOString().slice(0, 10)
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)  // last 7 days inclusive
    const weekStartKey = weekStart.toISOString().slice(0, 10)
    const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`
    const thisYear = String(today.getFullYear())

    // Fetch all dates per source in parallel (paginated past 1000-row cap)
    const datesPerSource: Record<string, string[]> = {}
    await Promise.all(SOURCES.map(async (src) => {
      try {
        datesPerSource[src.key] = await fetchAllDates(sb, src.table, src.dateColumn)
      } catch (e) {
        console.error(`analytics: failed to fetch ${src.table}.${src.dateColumn}`, e)
        datesPerSource[src.key] = []
      }
    }))

    // Per-source summary stats (total / today / this_week / this_month / last_month / this_year)
    const summary: Record<string, any> = {}
    for (const src of SOURCES) {
      const dates = datesPerSource[src.key] || []
      const isStatement = src.dateColumn === "billing_period"

      let total = dates.length
      let today_ = 0, thisWeek = 0, thisMonth = 0, lastMonth_ = 0, thisYear_ = 0

      for (const v of dates) {
        if (isStatement) {
          // Statements only have YYYY-MM granularity; daily/weekly counts not meaningful.
          // We only do this_month / last_month / this_year for them.
          if (v === thisMonthKey) thisMonth++
          if (v === lastMonthKey) lastMonth_++
          if (v.startsWith(thisYear)) thisYear_++
        } else {
          const day = toDayKey(v)
          const month = toMonthKey(v)
          if (day === todayKey) today_++
          if (day >= weekStartKey && day <= todayKey) thisWeek++
          if (month === thisMonthKey) thisMonth++
          if (month === lastMonthKey) lastMonth_++
          if (month.startsWith(thisYear)) thisYear_++
        }
      }

      summary[src.key] = {
        total,
        today: isStatement ? null : today_,
        this_week: isStatement ? null : thisWeek,
        this_month: thisMonth,
        last_month: lastMonth_,
        this_year: thisYear_,
        // Month-over-month change for headline cards
        delta_pct: lastMonth_ > 0
          ? Math.round(((thisMonth - lastMonth_) / lastMonth_) * 100)
          : (thisMonth > 0 ? 100 : 0),
      }
    }

    // Last 12 months series for the chart
    const months = lastNMonths(12)
    const monthlySeries: Array<Record<string, any>> = months.map(m => ({
      month: m,
      // Pretty label like "Mar 2026"
      label: new Date(parseInt(m.split("-")[0]), parseInt(m.split("-")[1]) - 1, 1)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    }))

    for (const src of SOURCES) {
      const dates = datesPerSource[src.key] || []
      const counts: Record<string, number> = {}
      for (const v of dates) {
        const m = toMonthKey(v)
        if (!m) continue
        counts[m] = (counts[m] || 0) + 1
      }
      for (const row of monthlySeries) {
        row[src.key] = counts[row.month] || 0
      }
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      summary,
      monthly_series: monthlySeries,
      sources: SOURCES.map(s => s.key),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
