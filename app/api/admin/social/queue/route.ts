import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/social/db"
import { fireQueueItem, processDue, type QueueRow } from "@/lib/social/queue-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/admin/social/queue → all queued posts, soonest first.
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("social_queue")
    .select("*")
    .order("due_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

// POST /api/admin/social/queue → { action, ... }
//   add          { items: [{ text, platform, channel_id, channel_name?, image_url?, due_at }] }
//   delete       { id }
//   post-now     { id }
//   process-due  {}
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const action = b.action
  const sb = supabaseAdmin()
  try {
    if (action === "add") {
      const items = (b.items || [])
        .filter((it: any) => it?.text && it?.channel_id && it?.due_at)
        .map((it: any) => ({
          text: String(it.text),
          platform: String(it.platform || ""),
          channel_id: String(it.channel_id),
          channel_name: it.channel_name || null,
          image_url: it.image_url || null,
          due_at: it.due_at,
          status: "pending",
        }))
      if (!items.length) return NextResponse.json({ error: "No valid items to queue." }, { status: 400 })
      const { data, error } = await sb.from("social_queue").insert(items).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, items: data })
    }

    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const { error } = await sb.from("social_queue").delete().eq("id", b.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === "post-now") {
      const { data: row } = await sb.from("social_queue").select("*").eq("id", b.id).maybeSingle()
      if (!row) return NextResponse.json({ error: "Queue item not found." }, { status: 404 })
      const r = await fireQueueItem(row as QueueRow)
      return NextResponse.json({ ok: r.ok, error: r.error }, { status: r.ok ? 200 : 502 })
    }

    if (action === "process-due") {
      const res = await processDue()
      return NextResponse.json({ ok: true, ...res })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Queue error" }, { status: 500 })
  }
}
