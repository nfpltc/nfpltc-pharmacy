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

// GET /api/medication-task/complete?token=XXX
// Public (token-protected). Returns the task details for the completion page.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")?.trim()
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const sb = admin()
    const { data: rec } = await sb
      .from("medication_task_recipients")
      .select("id, task_id, name, email")
      .eq("token", token)
      .maybeSingle()
    if (!rec) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 })

    const { data: task } = await sb
      .from("medication_tasks")
      .select("id, patient_name, patient_account, medication, instructions, priority, status, completed_at, completed_by")
      .eq("id", rec.task_id)
      .maybeSingle()
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 })

    return NextResponse.json({ task, recipient: { name: rec.name, email: rec.email } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// POST /api/medication-task/complete  Body: { token }
// Marks the task completed and records which recipient clicked.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body.token || "").trim()
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const sb = admin()
    const { data: rec } = await sb
      .from("medication_task_recipients")
      .select("id, task_id, name, email")
      .eq("token", token)
      .maybeSingle()
    if (!rec) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 })

    // Record that this recipient clicked
    await sb.from("medication_task_recipients")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", rec.id)

    // Fetch task to check current status
    const { data: task } = await sb
      .from("medication_tasks")
      .select("id, status")
      .eq("id", rec.task_id)
      .maybeSingle()
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 })

    if (task.status === "completed") {
      return NextResponse.json({ success: true, already: true })
    }
    if (task.status === "cancelled") {
      return NextResponse.json({ error: "This task was cancelled." }, { status: 400 })
    }

    const who = rec.name || rec.email
    const { error } = await sb
      .from("medication_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: who,
        completed_via: "link",
      })
      .eq("id", rec.task_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
