import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateAdminSuggestion } from "@/lib/chat-ai"
import type { ChatMessage } from "@/lib/chat-ai"
import { Resend } from "resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/chat/escalate
// Body: { conversation_id, name?, email?, phone?, reason? }
// Marks conversation as escalated, sends Telegram notification with AI suggestion.
// Also sends email alert as backup.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const convId = String(body.conversation_id || "").trim()
    if (!convId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 })

    const client = sb()

    // Update conversation with visitor info
    const updates: Record<string, any> = {
      status: "escalated",
      escalated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (body.name) updates.visitor_name = String(body.name).trim()
    if (body.email) updates.visitor_email = String(body.email).trim()
    if (body.phone) updates.visitor_phone = String(body.phone).trim()

    await client.from("chat_conversations").update(updates).eq("id", convId)

    // Get conversation history
    const { data: messages } = await client
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })

    const chatHistory: ChatMessage[] = (messages || []).map(m => ({
      role: m.role as "user" | "assistant" | "admin",
      content: m.content,
    }))

    // Generate AI suggestion for admin
    const suggestion = await generateAdminSuggestion(chatHistory)
    if (suggestion) {
      await client.from("chat_conversations")
        .update({ ai_suggestion: suggestion })
        .eq("id", convId)
    }

    // Build conversation summary
    const visitorName = body.name || "Anonymous visitor"
    const lastUserMsg = chatHistory.filter(m => m.role === "user").slice(-1)[0]?.content || ""
    const contact = [body.email, body.phone].filter(Boolean).join(" · ") || "No contact info"
    const reason = body.reason ? String(body.reason).trim() : ""

    // Send to Telegram
    let telegramSent = false
    const token = process.env.TELEGRAM_BOT_TOKEN
    const groupId = process.env.TELEGRAM_GROUP_ID

    if (token && groupId) {
      const chatSummary = chatHistory.slice(-4).map(m =>
        `${m.role === "user" ? "👤" : "🤖"} ${m.content}`
      ).join("\n")

      let text = `🔔 *New chat request*\n\n`
      text += `👤 *${escTg(visitorName)}*\n`
      text += `📞 ${escTg(contact)}\n`
      if (reason) text += `💬 ${escTg(reason)}\n`
      text += `\n📝 *Recent chat:*\n${escTg(chatSummary)}\n`
      if (suggestion) {
        text += `\n💡 *Suggested reply:*\n${escTg(suggestion)}`
      }

      try {
        const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: groupId,
            text,
            parse_mode: "Markdown",
            reply_markup: suggestion ? {
              inline_keyboard: [[
                { text: "✅ Send Suggested Reply", callback_data: `send_${convId}` },
                { text: "✏️ I'll write my own", callback_data: `own_${convId}` },
              ]]
            } : undefined,
          }),
        })

        const tgData = await tgResp.json()
        if (tgData.ok && tgData.result?.message_id) {
          await client.from("chat_conversations")
            .update({ telegram_msg_id: tgData.result.message_id })
            .eq("id", convId)
          telegramSent = true
        }
      } catch (e) {
        console.error("Telegram send failed:", e)
      }
    }

    // Also send email as backup
    let emailSent = false
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    const TO_EMAIL = process.env.TO_EMAIL

    if (RESEND_API_KEY && FROM_EMAIL && TO_EMAIL) {
      try {
        const resend = new Resend(RESEND_API_KEY)
        const chatLines = chatHistory.slice(-6).map(m =>
          `<p style="margin:4px 0;color:${m.role === "user" ? "#111827" : "#6B7280"}"><strong>${m.role === "user" ? "Customer" : "Bot"}:</strong> ${escHtml(m.content)}</p>`
        ).join("")

        await resend.emails.send({
          from: FROM_EMAIL,
          to: TO_EMAIL,
          subject: `🔔 Chat request from ${visitorName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <h2 style="color:#0B7C79">New Chat Request</h2>
            <p><strong>Customer:</strong> ${escHtml(visitorName)}</p>
            <p><strong>Contact:</strong> ${escHtml(contact)}</p>
            ${reason ? `<p><strong>About:</strong> ${escHtml(reason)}</p>` : ""}
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0">
            <h3 style="color:#6B7280;font-size:14px">Chat History</h3>
            ${chatLines}
            ${suggestion ? `<hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0"><h3 style="color:#0B7C79;font-size:14px">💡 Suggested Reply</h3><p style="background:#F0FDF9;padding:12px;border-radius:8px">${escHtml(suggestion)}</p>` : ""}
            <p style="margin-top:20px"><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.nfpltc.com"}/admin/chats" style="background:#0B7C79;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">View in Admin →</a></p>
          </div>`,
          text: `Chat request from ${visitorName}\nContact: ${contact}\n\n${chatHistory.map(m => `${m.role}: ${m.content}`).join("\n")}`,
        })
        emailSent = true
      } catch (e) {
        console.error("Escalation email failed:", e)
      }
    }

    return NextResponse.json({
      success: true,
      telegram: telegramSent,
      email: emailSent,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function escTg(s: string): string {
  return String(s || "").replace(/[_*\[\]()~`>#+=|{}.!-]/g, "\\$&")
}
function escHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
