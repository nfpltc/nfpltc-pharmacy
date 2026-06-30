import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/chat/telegram-webhook
// Receives updates from Telegram: callback_query (button taps) and messages (admin replies).
export async function POST(req: NextRequest) {
  try {
    const update = await req.json().catch(() => ({}))
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return NextResponse.json({ ok: true })

    // Handle callback query (admin tapped "Send Suggested Reply" or "I'll write my own")
    if (update.callback_query) {
      const cb = update.callback_query
      const data = cb.data || ""
      const callbackId = cb.id

      // Acknowledge the button tap
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId }),
      })

      if (data.startsWith("send_")) {
        // Admin chose to send the AI suggestion
        const convId = data.replace("send_", "")
        const client = sb()
        const { data: conv } = await client
          .from("chat_conversations")
          .select("ai_suggestion, visitor_name")
          .eq("id", convId)
          .maybeSingle()

        if (conv?.ai_suggestion) {
          const adminName = cb.from?.first_name || "Pharmacy team"
          const reply = conv.visitor_name
            ? `Hi ${conv.visitor_name}, ${conv.ai_suggestion}`
            : conv.ai_suggestion

          // Save as admin message in the chat
          await client.from("chat_messages").insert({
            conversation_id: convId,
            role: "admin",
            content: reply,
          })
          await client.from("chat_conversations").update({


            updated_at: new Date().toISOString(),
          }).eq("id", convId)

          // Confirm in Telegram
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cb.message?.chat?.id,
              text: `✅ Reply sent by ${adminName}:\n"${reply.slice(0, 200)}"`,
              reply_to_message_id: cb.message?.message_id,
            }),
          })
        }
      } else if (data.startsWith("own_")) {
        // Admin chose to write their own reply
        const convId = data.replace("own_", "")
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cb.message?.chat?.id,
            text: `✏️ Reply to this message with your response for the customer.`,
            reply_to_message_id: cb.message?.message_id,
          }),
        })
      }

      return NextResponse.json({ ok: true })
    }

    // Handle regular message (admin replied to a bot message in the group)
    if (update.message) {
      const msg = update.message
      // Only process replies to bot messages in the group
      if (!msg.reply_to_message || msg.from?.is_bot) {
        return NextResponse.json({ ok: true })
      }

      const replyToMsgId = msg.reply_to_message.message_id
      const adminText = msg.text || ""
      const adminName = msg.from?.first_name || "Pharmacy team"

      if (!adminText.trim()) return NextResponse.json({ ok: true })

      // Find the conversation by telegram_msg_id
      const client = sb()
      const { data: conv } = await client
        .from("chat_conversations")
        .select("id, visitor_name, status")
        .eq("telegram_msg_id", replyToMsgId)
        .maybeSingle()

      if (!conv) {
        // Maybe they replied to a forwarded message — check recent escalated conversations
        // with the same chat group. Skip if not found.
        return NextResponse.json({ ok: true })
      }

      // Save the admin's reply
      await client.from("chat_messages").insert({
        conversation_id: conv.id,
        role: "admin",
        content: adminText,
      })

      // Mark as resolved (admin can keep replying if needed — new messages reopen it)
      await client.from("chat_conversations").update({


        updated_at: new Date().toISOString(),
      }).eq("id", conv.id)

      // Confirm in Telegram
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: `✅ Reply sent to ${conv.visitor_name || "the customer"} by ${adminName}.`,
          reply_to_message_id: msg.message_id,
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Telegram webhook error:", err)
    return NextResponse.json({ ok: true }) // always return 200 to Telegram
  }
}
