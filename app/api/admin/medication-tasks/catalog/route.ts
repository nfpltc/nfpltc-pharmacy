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

// GET — list all active catalog medications (for the search/select dropdown)
// Optional ?search=term for filtering
export async function GET(req: NextRequest) {
  try {
    const sb = admin()
    const search = new URL(req.url).searchParams.get("search")?.trim()
    let q = sb.from("medication_catalog").select("*").eq("active", true).order("name")
    if (search) q = q.ilike("name", `%${search}%`)
    const { data, error } = await q.limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ medications: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — add a medication to the catalog. Body: { name, default_dose?, instructions? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Medication name is required" }, { status: 400 })
    const sb = admin()
    const { data, error } = await sb.from("medication_catalog").insert({
      name,
      default_dose: body.default_dose ? String(body.default_dose).trim() : null,
      instructions: body.instructions ? String(body.instructions).trim() : null,
      active: true,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, medication: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove from catalog. Query: ?id=XXX
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const sb = admin()
    const { error } = await sb.from("medication_catalog").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
