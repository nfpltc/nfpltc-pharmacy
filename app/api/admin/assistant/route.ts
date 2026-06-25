import { NextRequest, NextResponse } from "next/server"
import { TOOL_SCHEMAS, executeTool } from "@/lib/admin-ai-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

const SYSTEM_PROMPT = `You are an internal admin assistant for North Falmouth Pharmacy's website dashboard.
You help staff look up information about customers, statements, and form submissions by calling the available tools.

IMPORTANT RULES:
- You can ONLY read data through the provided tools. You cannot modify, delete, or create anything.
- When a tool returns data, the actual records are shown to the admin in cards below your message. You only receive a brief summary (counts, whether something was found). Do NOT make up specific patient details you weren't given — refer the admin to the card.
- Be concise and professional. This is an internal tool for pharmacy staff.
- If a question can't be answered with the available tools, say so plainly.
- For questions about specific people, use search_customer. For "how many" questions, use the count tools.
- Never guess at medical information, dosages, or give medical advice.
- You handle Protected Health Information — keep responses factual and professional.`

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
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...userMessages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ]

    const cards: any[] = []
    let finalText = ""

    // Function-calling loop — up to 5 rounds of tool calls
    for (let round = 0; round < 5; round++) {
      const resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          tools: TOOL_SCHEMAS,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 1024,
        }),
      })

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "")
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
