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

// GET /api/admin/medication-tasks/batches — list recent import batches
export async function GET() {
  try {
    const sb = admin()
    const { data: batches, error } = await sb
      .from("medication_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get live counts per batch (in case some tasks were deleted individually since import)
    const ids = (batches || []).map(b => b.id)
    let liveCounts: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: tasks } = await sb.from("medication_tasks").select("import_batch_id").in("import_batch_id", ids)
      for (const t of tasks || []) {
        liveCounts[t.import_batch_id] = (liveCounts[t.import_batch_id] || 0) + 1
      }
    }

    const enriched = (batches || []).map(b => ({ ...b, live_count: liveCounts[b.id] || 0 }))
    return NextResponse.json({ batches: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/medication-tasks/batches?id=XXX
// Deletes ALL tasks belonging to this import batch, then the batch record itself.
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const sb = admin()

    // Find task ids in this batch (to also clean up recipients)
    const { data: tasks } = await sb.from("medication_tasks").select("id").eq("import_batch_id", id)
    const taskIds = (tasks || []).map(t => t.id)

    if (taskIds.length > 0) {
      await sb.from("medication_task_recipients").delete().in("task_id", taskIds)
      await sb.from("medication_tasks").delete().in("id", taskIds)
    }
    await sb.from("medication_import_batches").delete().eq("id", id)

    return NextResponse.json({ success: true, deleted: taskIds.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
