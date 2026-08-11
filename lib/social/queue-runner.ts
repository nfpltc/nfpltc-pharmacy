// Local queue runner — fires pending social_queue items via Buffer shareNow.
// Used by /api/admin/social/queue (post-now, process-due) and the cron endpoint.
import { supabaseAdmin } from "./db"
import { createPost } from "./buffer"

export interface QueueRow {
  id: string
  text: string
  platform: string
  channel_id: string
  channel_name?: string | null
  image_url?: string | null
  instagram_type?: string | null
  due_at: string
  status: string
}

// Post a single queue row now and record the outcome on the row.
export async function fireQueueItem(row: QueueRow): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAdmin()
  const r = await createPost({
    channelId: row.channel_id,
    text: row.text,
    imageUrl: row.image_url || undefined,
    mode: "shareNow",
    instagramType: row.platform === "instagram"
      ? ((["post", "story", "reel"].includes(String(row.instagram_type)) ? row.instagram_type : "post") as "post" | "story" | "reel")
      : undefined,
    facebookType: row.platform === "facebook" ? "post" : undefined,
  })
  if (r.ok) {
    await sb.from("social_queue").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", row.id)
    return { ok: true }
  }
  await sb.from("social_queue").update({ status: "failed", error: r.error || "Buffer error" }).eq("id", row.id)
  return { ok: false, error: r.error }
}

// Fire all pending items whose due_at has passed, 1 second apart.
export async function processDue(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from("social_queue")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(25)
  const rows: QueueRow[] = data || []
  let sent = 0
  let failed = 0
  for (let i = 0; i < rows.length; i++) {
    const r = await fireQueueItem(rows[i])
    if (r.ok) sent++
    else failed++
    if (i < rows.length - 1) await new Promise((res) => setTimeout(res, 1000)) // rate limit
  }
  return { processed: rows.length, sent, failed }
}
