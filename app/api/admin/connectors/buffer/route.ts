import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/social/db"
import { getChannels } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// GET /api/admin/connectors/buffer → { hasToken, channels?, error? }
// Confirms whether a token is saved and, if so, which channels it can see.
export async function GET() {
  const { data } = await supabaseAdmin()
    .from("connectors")
    .select("bearer_token")
    .eq("id", "buffer")
    .maybeSingle()
  const hasToken = !!data?.bearer_token
  if (!hasToken) return NextResponse.json({ hasToken: false, channels: [] })
  const { channels, error } = await getChannels()
  return NextResponse.json({ hasToken: true, channels, error })
}

// POST /api/admin/connectors/buffer  { token } → save/replace the Buffer token.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const token = String(b.token || "").trim()
  if (!token) return NextResponse.json({ error: "Paste your Buffer access token." }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from("connectors")
    .upsert({ id: "buffer", bearer_token: token, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Immediately verify the token by listing channels.
  const { channels, error: chErr } = await getChannels(token)
  if (chErr) return NextResponse.json({ ok: true, hasToken: true, channels: [], warning: chErr })
  return NextResponse.json({ ok: true, hasToken: true, channels })
}

// DELETE /api/admin/connectors/buffer → disconnect (clear the token).
export async function DELETE() {
  const { error } = await supabaseAdmin().from("connectors").delete().eq("id", "buffer")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
