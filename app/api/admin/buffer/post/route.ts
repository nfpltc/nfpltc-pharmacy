import { NextRequest, NextResponse } from "next/server"
import { createPost, type BufferMode } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// GET /api/admin/buffer/post?channelId=&text=&mode=&image=1
// DIAGNOSTIC dry-run: returns the exact input createPost would send to Buffer,
// WITHOUT posting. Confirms which build is live and that required fields
// (schedulingType, assets) are present. Remove with the introspect endpoint.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const mode = (["shareNow", "addToQueue", "shareNext", "customScheduled"].includes(sp.get("mode") || "")
    ? sp.get("mode") : "shareNow") as BufferMode
  const r = await createPost({
    channelId: sp.get("channelId") || "DRY_RUN",
    text: sp.get("text") || "dry run",
    imageUrl: sp.get("image") ? "https://example.com/i.jpg" : undefined,
    mode,
    dryRun: true,
  })
  return NextResponse.json({ dryRun: true, input: r.input })
}

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
  if (!r.ok) {
    // Echo the shape we sent (never the text/token) so a Buffer rejection can be
    // told apart from a genuinely empty input on our side.
    return NextResponse.json({
      error: r.error,
      sent: { channelId, textLength: text.length, mode, hasImage: Boolean(b.imageUrl) },
    }, { status: 502 })
  }
  return NextResponse.json({ ok: true, id: r.id })
}
