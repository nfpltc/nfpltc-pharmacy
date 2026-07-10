import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

// POST { themes:[{label,count}], questions:[{text,count}] }
// → { takeaways: string[] }  — short recommendations for improving the chatbot.
export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: "AI is not configured (GROQ_API_KEY)." }, { status: 500 })
  const b = await req.json().catch(() => ({}))
  const themes = (b.themes || []).slice(0, 10)
  const questions = (b.questions || []).slice(0, 20)
  if (!questions.length && !themes.length) return NextResponse.json({ takeaways: [] })

  const themeLines = themes.map((t: any) => `- ${t.label}: ${t.count}`).join("\n")
  const qLines = questions.map((q: any) => `- "${String(q.text).slice(0, 160)}" (${q.count}×)`).join("\n")

  const prompt = `You are helping a community pharmacy improve its website chatbot. Below are the most common customer questions and question categories over the past 6 months.

Question categories (count):
${themeLines || "(none)"}

Top questions asked (times asked):
${qLines || "(none)"}

Give 4-6 short, concrete takeaways the pharmacy can act on: what canned answers or FAQ entries to add to the bot, what the customers most want, and any staffing/hours/process signals. Each takeaway one sentence, plain English, no preamble. Return ONLY a JSON array of strings.`

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!r.ok) return NextResponse.json({ error: `AI error ${r.status}` }, { status: 502 })
    const d = await r.json()
    const raw = d?.choices?.[0]?.message?.content || "[]"
    let takeaways: string[] = []
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      takeaways = JSON.parse(match ? match[0] : raw)
    } catch {
      // Fallback: split lines / bullets if the model didn't return clean JSON.
      takeaways = String(raw).split("\n").map((l: string) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean)
    }
    return NextResponse.json({ takeaways: (takeaways || []).filter((t) => typeof t === "string" && t.trim()).slice(0, 8) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI request failed" }, { status: 502 })
  }
}
