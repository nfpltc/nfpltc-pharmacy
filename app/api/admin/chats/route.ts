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

// GET /api/admin/chats?status=all|active|escalated|resolved
export async function GET(req: NextRequest) {
  try {
    const sb = admin()
    const status = new URL(req.url).searchParams.get("status") || "all"

    let q = sb.from("chat_conversations").select("*").order("updated_at", { ascending: false }).limit(100)
    if (status !== "all") q = q.eq("status", status)
    const { data: convs, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Attach last message + message count for each conversation
    const ids = (convs || []).map(c => c.id)
    let allMessages: any[] = []
    if (ids.length > 0) {
      const { data } = await sb
        .from("chat_messages")
        .select("conversation_id, role, content, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
      allMessages = data || []
    }

    const enriched = (convs || []).map(c => {
      const msgs = allMessages.filter(m => m.conversation_id === c.id)
      const lastUser = msgs.find(m => m.role === "user")
      return {
        ...c,
        message_count: msgs.length,
        last_message: lastUser?.content?.slice(0, 100) || "",
      }
    })

    // Counts
    const counts = { all: (convs || []).length, active: 0, escalated: 0, resolved: 0 }
    for (const c of (convs || [])) {
      if (c.status in counts) (counts as any)[c.status]++
    }

    return NextResponse.json({ conversations: enriched, counts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/chats — admin sends a reply or resolves
// Body: { conversation_id, message } or { conversation_id, action: "resolve" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const convId = String(body.conversation_id || "").trim()
    if (!convId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 })

    const sbc = admin()

    // Resolve action
    if (body.action === "resolve") {
      await sbc.from("chat_conversations").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", convId)
      return NextResponse.json({ success: true, status: "resolved" })
    }

    // Send reply
    const message = String(body.message || "").trim()
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 })

    await sbc.from("chat_messages").insert({
      conversation_id: convId,
      role: "admin",
      content: message,
    })

    // Keep conversation active (don't resolve — admin can keep chatting)
    await sbc.from("chat_conversations").update({
      updated_at: new Date().toISOString(),
    }).eq("id", convId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/admin/chats/suggest?conversation_id=X — AI-generated reply suggestion
// (called separately so it doesn't block the chat view)

// DELETE /api/admin/chats?id=XXX
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const sbc = admin()
    await sbc.from("chat_messages").delete().eq("conversation_id", id)
    await sbc.from("chat_conversations").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
