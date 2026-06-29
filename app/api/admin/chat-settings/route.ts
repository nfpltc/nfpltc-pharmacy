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

// GET /api/admin/chat-settings
export async function GET() {
  try {
    const sb = admin()
    const { data } = await sb.from("chat_settings").select("*").eq("id", 1).maybeSingle()
    const settings = data || { enabled: true }

    // Chat stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

    const [{ count: totalConvs }, { count: todayConvs }, { count: weekConvs }, { count: escalated }, { count: totalMsgs }] = await Promise.all([
      sb.from("chat_conversations").select("id", { count: "exact", head: true }),
      sb.from("chat_conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      sb.from("chat_conversations").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      sb.from("chat_conversations").select("id", { count: "exact", head: true }).eq("status", "escalated"),
      sb.from("chat_messages").select("id", { count: "exact", head: true }),
    ])

    return NextResponse.json({
      settings,
      stats: {
        total_conversations: totalConvs ?? 0,
        today: todayConvs ?? 0,
        this_week: weekConvs ?? 0,
        escalated: escalated ?? 0,
        total_messages: totalMsgs ?? 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/chat-settings  Body: { enabled?, visible? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if ("enabled" in body) updates.enabled = Boolean(body.enabled)
    if ("visible" in body) updates.visible = Boolean(body.visible)

    const sb = admin()
    const { data, error } = await sb
      .from("chat_settings")
      .upsert({ id: 1, ...updates }, { onConflict: "id" })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
