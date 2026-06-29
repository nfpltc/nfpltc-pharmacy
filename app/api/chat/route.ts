import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateChatResponse, generateAdminSuggestion } from "@/lib/chat-ai"
import type { ChatMessage } from "@/lib/chat-ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// GET /api/chat?conversation_id=X
// Returns all messages for a conversation (used for polling when escalated)
export async function GET(req: NextRequest) {
  try {
    const convId = new URL(req.url).searchParams.get("conversation_id")?.trim()
    if (!convId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 })

    const client = sb()
    const { data: conv } = await client
      .from("chat_conversations")
      .select("id, status, visitor_name")
      .eq("id", convId)
      .maybeSingle()
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: messages } = await client
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })

    return NextResponse.json({ status: conv.status, messages: messages || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/chat
// Body: { conversation_id?, message }
// Creates a conversation if needed, saves the message, generates AI reply.
// If conversation is escalated, saves message but doesn't generate AI reply
// (admin will reply via Telegram).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message || "").trim()
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 })

    const client = sb()
    let convId = body.conversation_id ? String(body.conversation_id).trim() : null

    // Create conversation if new
    if (!convId) {
      const { data: conv, error } = await client
        .from("chat_conversations")
        .insert({ status: "active" })
        .select("id")
        .single()
      if (error || !conv) return NextResponse.json({ error: "Could not start conversation" }, { status: 500 })
      convId = conv.id
    }

    // Check conversation status
    const { data: conv } = await client
      .from("chat_conversations")
      .select("status")
      .eq("id", convId)
      .maybeSingle()
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

    // Save user message
    await client.from("chat_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    })
    await client.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId)

    // If escalated, don't generate AI reply — admin handles it
    if (conv.status === "escalated") {
      // Forward this new message to Telegram so admin sees it
      await forwardToTelegram(convId, message, client)
      return NextResponse.json({ conversation_id: convId, status: "escalated", reply: null })
    }

    // Get conversation history for AI context
    const { data: history } = await client
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })

    const chatHistory: ChatMessage[] = (history || []).map(m => ({
      role: m.role as "user" | "assistant" | "admin",
      content: m.content,
    }))

    // Generate AI response
    const { response, shouldEscalate } = await generateChatResponse(chatHistory)

    // Save AI reply
    if (response) {
      await client.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: response,
      })
    }

    return NextResponse.json({
      conversation_id: convId,
      status: conv.status,
      reply: response,
      should_escalate: shouldEscalate,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Forward a message to the Telegram group (when customer sends during escalation)
async function forwardToTelegram(convId: string, message: string, client: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const groupId = process.env.TELEGRAM_GROUP_ID
  if (!token || !groupId) return

  const { data: conv } = await client
    .from("chat_conversations")
    .select("telegram_msg_id, visitor_name")
    .eq("id", convId)
    .maybeSingle()
  if (!conv?.telegram_msg_id) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupId,
        text: `💬 ${conv.visitor_name || "Customer"}: ${message}`,
        reply_to_message_id: conv.telegram_msg_id,
      }),
    })
  } catch { /* non-fatal */ }
}
