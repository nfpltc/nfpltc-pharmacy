import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateAdminSuggestion } from "@/lib/chat-ai"
import type { ChatMessage } from "@/lib/chat-ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/chats/suggest?conversation_id=X
// Returns an AI-suggested reply based on the conversation history
export async function GET(req: NextRequest) {
  try {
    const convId = new URL(req.url).searchParams.get("conversation_id")?.trim()
    if (!convId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 })

    const sb = admin()
    const { data: messages } = await sb
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })

    if (!messages || messages.length === 0) {
      return NextResponse.json({ suggestion: "" })
    }

    const history: ChatMessage[] = messages.map(m => ({
      role: m.role as "user" | "assistant" | "admin",
      content: m.content,
    }))

    const suggestion = await generateAdminSuggestion(history)
    return NextResponse.json({ suggestion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/chats/suggest — rewrite/polish a draft
// Body: { draft, conversation_id }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const draft = String(body.draft || "").trim()
    if (!draft) return NextResponse.json({ error: "draft required" }, { status: 400 })

    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a professional pharmacy assistant. Rewrite the following customer reply to be warm, professional, concise, and helpful. Keep the same meaning but improve the tone and clarity. Return ONLY the rewritten message, nothing else." },
          { role: "user", content: draft },
        ],
        temperature: 0.4,
        max_tokens: 200,
      }),
    })

    if (!resp.ok) return NextResponse.json({ error: "AI error" }, { status: 500 })
    const data = await resp.json()
    const rewritten = data?.choices?.[0]?.message?.content?.trim() || draft

    return NextResponse.json({ rewritten })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
