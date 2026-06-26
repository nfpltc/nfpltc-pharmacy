import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

// POST /api/admin/customers/polish-email
// Body: { draft: string, mode: "polish" | "write", subject?: string }
//   - mode "polish": clean up / professionalize the admin's rough draft
//   - mode "write":  generate a draft from a short instruction
// Returns: { subject: string, body: string }
//
// No PHI is sent — only the admin's own draft text. The customer's name/email
// is merged later when the email is actually sent (server-side), not here.
export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: "AI is not configured" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const draft = String(body.draft || "").trim()
    const mode = body.mode === "write" ? "write" : "polish"
    const currentSubject = String(body.subject || "").trim()

    if (!draft) {
      return NextResponse.json({ error: "Please type something first" }, { status: 400 })
    }

    const system = `You write professional, warm emails on behalf of North Falmouth Pharmacy, a long-term-care pharmacy serving elderly customers on Cape Cod.

Guidelines:
- Tone: warm, clear, respectful, professional. Easy to read for an older audience.
- Keep it concise — a few short paragraphs at most.
- Do NOT include a greeting like "Dear [name]" — that is added automatically.
- Do NOT include a signature/footer — that is added automatically.
- Do NOT invent specific facts (prices, dates, medications, account details). If the draft lacks a detail, keep it general.
- No medical advice.
- Return ONLY a JSON object: {"subject": "...", "body": "..."} with no markdown, no code fences, no extra text.`

    const userPrompt = mode === "write"
      ? `Write a professional pharmacy email based on this instruction:\n\n"${draft}"\n\n${currentSubject ? `Suggested subject context: "${currentSubject}"\n\n` : ""}Return JSON with a fitting "subject" and the "body".`
      : `Polish and professionalize this email draft. Fix grammar, improve clarity and warmth, but keep the original meaning and any specific details the writer included. Do not add new facts.\n\nDraft:\n"${draft}"\n\n${currentSubject ? `Current subject: "${currentSubject}" (improve it if helpful)\n\n` : ""}Return JSON with "subject" and "body".`

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 700,
      }),
    })

    if (!resp.ok) {
      if (resp.status === 429) {
        return NextResponse.json({ error: "AI is busy — wait a moment and try again." }, { status: 429 })
      }
      const t = await resp.text().catch(() => "")
      console.error("polish-email groq error:", resp.status, t.slice(0, 300))
      return NextResponse.json({ error: "Could not generate. Try again." }, { status: 500 })
    }

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content || ""

    // Parse the JSON the model returned (strip fences if present)
    const parsed = parseJson(content)
    if (!parsed || !parsed.body) {
      // Fallback: if parsing failed, return the raw content as the body
      return NextResponse.json({
        subject: currentSubject || "A message from North Falmouth Pharmacy",
        body: content.trim(),
      })
    }

    return NextResponse.json({
      subject: String(parsed.subject || currentSubject || "A message from North Falmouth Pharmacy"),
      body: String(parsed.body),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// Tolerant JSON parser — strips markdown fences and grabs the outermost object
function parseJson(raw: string): any {
  let s = String(raw).trim()
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  const a = s.indexOf("{")
  const b = s.lastIndexOf("}")
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try { return JSON.parse(s) } catch { /* fall through */ }
  // Try escaping raw newlines inside strings
  try {
    return JSON.parse(s.replace(/[\n\r\t]/g, (m) => ({ "\n": "\\n", "\r": "\\r", "\t": "\\t" }[m] || m)))
  } catch { return null }
}
