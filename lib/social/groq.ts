// Thin Groq chat helper (REST, no SDK) + a tolerant JSON parser.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

export async function groqChat(
  system: string,
  user: string,
  opts: { temperature?: number; max_tokens?: number } = {},
): Promise<{ text: string } | { error: string; status?: number }> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { error: "GROQ_API_KEY not configured." }
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.max_tokens ?? 1500,
      }),
    })
    if (!r.ok) {
      if (r.status === 429) return { error: "AI is busy — try again in a moment.", status: 429 }
      return { error: `Groq error ${r.status}`, status: r.status }
    }
    const d = await r.json()
    return { text: String(d?.choices?.[0]?.message?.content || "") }
  } catch (e: any) {
    return { error: e.message || "Groq request failed" }
  }
}

// Strips code fences and grabs the outermost JSON object.
export function parseJson(raw: string): any {
  let s = String(raw).trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  const a = s.indexOf("{")
  const b = s.lastIndexOf("}")
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try { return JSON.parse(s) } catch { /* try again */ }
  try {
    return JSON.parse(s.replace(/[\n\r\t]/g, (m) => ({ "\n": "\\n", "\r": "\\r", "\t": "\\t" }[m] || m)))
  } catch { return null }
}
