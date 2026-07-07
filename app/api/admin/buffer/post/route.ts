import { NextRequest, NextResponse } from "next/server"
import { createPost, type BufferMode } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/admin/buffer/post → post directly to Buffer.
// Body: { channelId, text, imageUrl?, mode?, dueAt? }  (default mode shareNow)
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const channelId = String(b.channelId || "")
  const text = String(b.text || "")
  if (!channelId || !text.trim()) {
    return NextResponse.json({ error: "channelId and text are required" }, { status: 400 })
  }
  const mode = (["shareNow", "addToQueue", "shareNext", "customScheduled"].includes(b.mode) ? b.mode : "shareNow") as BufferMode
  const r = await createPost({ channelId, text, imageUrl: b.imageUrl || undefined, mode, dueAt: b.dueAt })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  return NextResponse.json({ ok: true, id: r.id })
}
