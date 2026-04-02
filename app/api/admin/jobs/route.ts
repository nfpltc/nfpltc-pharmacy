import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET() {
  try {
    const { data, error } = await admin()
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ jobs: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, department, location, type, description, responsibilities, requirements, benefits, salary_range, status } = body
    if (!title || !description) return NextResponse.json({ error: "Title and description required" }, { status: 400 })

    const { data, error } = await admin().from("jobs").insert({
      title,
      department: department || "Pharmacy",
      location: location || "North Falmouth, MA",
      type: type || "Full-time",
      description,
      responsibilities: responsibilities || [],
      requirements: requirements || [],
      benefits: benefits || [],
      salary_range: salary_range || "",
      status: status || "active",
      is_active: status !== "closed",
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ job: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "Job ID required" }, { status: 400 })

    if (updates.status) updates.is_active = updates.status !== "closed"
    updates.updated_at = new Date().toISOString()

    const { data, error } = await admin().from("jobs").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ job: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Job ID required" }, { status: 400 })

    const { error } = await admin().from("jobs").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
