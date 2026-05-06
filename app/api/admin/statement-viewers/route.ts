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

// GET /api/admin/statement-viewers
// Returns the audit log of everyone who passed the statement gate.
// Supports ?q=search for name/email filtering, paginated to 500 newest by default.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim() || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 1000)

    const sb = admin()
    let query = sb
      .from("statement_viewer_log")
      .select("id, name, email, ip_address, accessed_at, account_number_attempted, statement_viewed, searched_at")
      .order("accessed_at", { ascending: false })
      .limit(limit)

    if (q) {
      // Search across name and account number (email no longer collected)
      query = query.or(`name.ilike.%${q}%,account_number_attempted.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ entries: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// DELETE /api/admin/statement-viewers
// Body: { id: string }
// Lets admin remove a specific entry (e.g. test entries, accidental submissions).
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = body.id
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const sb = admin()
    const { error } = await sb.from("statement_viewer_log").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
