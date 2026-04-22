import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET(_req: NextRequest) {
  try {
    const sb = admin()
    // Paginate past 1000 row cap
    const PAGE_SIZE = 1000
    const all: any[] = []
    let from = 0
    while (from < 200_000) {
      const { data, error } = await sb.from("customers")
        .select("*")
        .order("last_name").order("first_name")
        .range(from, from + PAGE_SIZE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    const headers = ["account_number", "first_name", "last_name", "email", "phone",
                     "email_opt_in", "unsubscribed_at", "notes", "created_at", "updated_at"]
    const lines = [headers.join(",")]
    for (const c of all) {
      lines.push(headers.map(h => csvEscape(c[h])).join(","))
    }
    const csv = lines.join("\n")

    const filename = `nfpltc-customers-${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
