import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

// POST /api/admin/jobs/rewrite
// Body: { field, content, job_title, department?, type? }
// Returns: { result: string }
export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const field     = String(body.field     || "").trim()  // description | responsibilities | requirements | benefits
    const content   = String(body.content   || "").trim()
    const jobTitle  = String(body.job_title || "").trim()
    const dept      = String(body.department || "Pharmacy").trim()
    const jobType   = String(body.type      || "Full-time").trim()

    if (!content) return NextResponse.json({ error: "Type something first" }, { status: 400 })

    // Build a field-specific prompt
    const fieldInstructions: Record<string, string> = {
      description: `Rewrite this job description for a "${jobTitle}" role in the ${dept} department (${jobType}). 
Make it clear, professional, and appealing to qualified candidates. 
Keep it 2-4 sentences. Focus on the role's purpose and impact.
Return ONLY the rewritten text, no labels or preamble.`,

      responsibilities: `Rewrite these responsibilities for a "${jobTitle}" at a long-term care pharmacy.
Format as clear, action-oriented bullet points (one per line, no bullet symbols — just plain text lines).
Each line should start with an action verb. Aim for 4-6 concise bullet points.
Return ONLY the bullet lines, one per line, no preamble.`,

      requirements: `Rewrite these requirements for a "${jobTitle}" at North Falmouth Pharmacy, a long-term care pharmacy on Cape Cod.
Format as clear, scannable bullet points (one per line, no bullet symbols — just plain text lines).
Include any relevant certifications, experience, or skills mentioned. Aim for 4-6 points.
Return ONLY the bullet lines, one per line, no preamble.`,

      benefits: `Rewrite these benefits for a "${jobTitle}" job posting.
Format as appealing bullet points (one per line, no bullet symbols — just plain text lines).
Make them sound attractive to candidates. Aim for 4-6 points.
Return ONLY the benefit lines, one per line, no preamble.`,
    }

    const instruction = fieldInstructions[field] || `Rewrite the following text for a "${jobTitle}" job posting professionally. Return only the rewritten text.`

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: `You are a professional HR copywriter for North Falmouth Pharmacy, a long-term care pharmacy serving elderly patients on Cape Cod, MA. 
Write clear, professional, and welcoming job content. 
Always return ONLY the requested content — no introductions, no explanations, no labels, no markdown headers.`,
          },
          {
            role: "user",
            content: `${instruction}\n\nAdmin's draft:\n${content}`,
          },
        ],
      }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return NextResponse.json({ error: err.error?.message || "AI error" }, { status: 500 })
    }

    const data = await resp.json()
    const result = data.choices?.[0]?.message?.content?.trim() || ""
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
