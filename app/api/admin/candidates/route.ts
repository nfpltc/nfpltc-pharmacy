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
    const sb = admin()
    const { data, error } = await sb
      .from("job_applications")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Generate signed URLs for resumes
    const candidates = await Promise.all(
      (data || []).map(async (c: any) => {
        if (c.resume_url) {
          try {
            const { data: signedData } = await sb.storage
              .from("resumes")
              .createSignedUrl(c.resume_url, 3600) // 1 hour expiry
            c.resume_signed_url = signedData?.signedUrl || null
          } catch {
            c.resume_signed_url = null
          }
        } else {
          c.resume_signed_url = null
        }
        return c
      })
    )

    return NextResponse.json({ candidates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    updates.updated_at = new Date().toISOString()
    const { data, error } = await admin().from("job_applications").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ candidate: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    // Get the candidate first to find resume path
    const sb = admin()
    const { data: candidate } = await sb.from("job_applications").select("resume_url").eq("id", id).single()

    // Delete resume from storage if it exists
    if (candidate?.resume_url) {
      await sb.storage.from("resumes").remove([candidate.resume_url])
    }

    // Delete the record
    const { error } = await sb.from("job_applications").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
