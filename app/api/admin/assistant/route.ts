import { NextRequest, NextResponse } from "next/server"
import { TOOL_SCHEMAS, executeTool } from "@/lib/admin-ai-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
// 8b-instant has ~30,000 TPM on the free tier (vs 12,000 for 70b-versatile),
// which prevents the rate-limit errors. It's plenty capable for choosing
// which read-only database tool to call.
const GROQ_MODEL = "llama-3.1-8b-instant"

const SYSTEM_PROMPT = `You are an internal admin assistant for North Falmouth Pharmacy. You answer questions about customers, statements, and form submissions by calling the available read-only tools.

Rules:
- You can only READ via tools — never modify data.
- Tool results show records to the admin in cards; you get only brief summaries. Don't invent details not in the summary — refer to the card.
- Be concise. Never give medical advice.`

// POST /api/admin/assistant
// Body: { messages: [{role, content}] }  (conversation history)
// Returns: { message: string, cards: [{type, data}] }
//
// PHI protection: tool results sent back to Groq contain only non-PHI
// summaries (ai_summary). The actual data (display) is collected separately
// and returned to the UI as cards — it never goes to Groq.
export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: "AI is not configured (missing GROQ_API_KEY)" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const userMessages = Array.isArray(body.messages) ? body.messages : []
    if (userMessages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 })
    }

    // Build the conversation. Only role + content from the client (we ignore
    // any cards the client may echo back — those stay in the UI only).
    // Keep only the last 6 messages to limit tokens-per-minute usage on
    // Groq's free tier (12,000 TPM).
    const recentMessages = userMessages.slice(-6)
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentMessages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ]

    const cards: any[] = []
    let finalText = ""

    // Helper: call Groq with one automatic retry on a 429 rate limit.
    const callGroq = async (msgs: any[]): Promise<Response> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: msgs,
            tools: TOOL_SCHEMAS,
            tool_choice: "auto",
            temperature: 0.3,
            max_tokens: 600,
          }),
        })
        if (r.status === 429 && attempt === 0) {
          // brief backoff then retry once
          await new Promise(res => setTimeout(res, 2500))
          continue
        }
        return r
      }
      // unreachable, but satisfies types
      return fetch(GROQ_URL, { method: "POST" })
    }

    // Function-calling loop — up to 5 rounds of tool calls
    for (let round = 0; round < 5; round++) {
      const resp = await callGroq(messages)

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "")
        // Groq free tier has a tokens-per-minute limit. Surface a friendly,
        // actionable message instead of the raw error.
        if (resp.status === 429) {
          return NextResponse.json({
            error: "The AI is busy right now (rate limit). Please wait about 30 seconds and try again.",
          }, { status: 429 })
        }
        return NextResponse.json({ error: `AI service error: ${txt.slice(0, 200)}` }, { status: 500 })
      }

      const data = await resp.json()
      const choice = data?.choices?.[0]
      const msg = choice?.message
      if (!msg) {
        return NextResponse.json({ error: "AI returned no response" }, { status: 500 })
      }

      // If the model wants to call tools, execute them
      const toolCalls = msg.tool_calls
      if (toolCalls && toolCalls.length > 0) {
        // Append the assistant's tool-call message
        messages.push({
          role: "assistant",
          content: msg.content || "",
          tool_calls: toolCalls,
        })

        // Execute each tool and append its NON-PHI summary back to the convo
        for (const tc of toolCalls) {
          let args: any = {}
          try { args = JSON.parse(tc.function.arguments || "{}") } catch { args = {} }

          const result = await executeTool(tc.function.name, args)

          // Collect PHI display data for the UI (NOT sent to Groq)
          if (result.display) cards.push(result.display)

          // Send only the safe summary back to Groq
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result.ai_summary,
          })
        }
        // Loop again so the model can read the tool results and respond
        continue
      }

      // No tool calls — this is the final text answer
      finalText = msg.content || ""
      break
    }

    if (!finalText) {
      finalText = cards.length > 0
        ? "Here's what I found:"
        : "I wasn't able to find an answer to that. Try rephrasing or asking about customers, statements, or form submissions."
    }

    return NextResponse.json({ message: finalText, cards })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
