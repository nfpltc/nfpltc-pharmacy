import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

// POST /api/admin/social/generate
// Body: { prompt: string, platform?: "instagram" | "facebook" | "linkedin" }
// Returns: { caption: string }
//
// Drafts a social caption in North Falmouth Pharmacy's voice from a short
// topic/instruction. No PHI is sent — only the admin's topic text.
export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: "AI is not configured" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const prompt = String(body.prompt || "").trim()
    const platform = ["instagram", "facebook", "linkedin"].includes(body.platform)
      ? body.platform
      : "instagram"

    if (!prompt) {
      return NextResponse.json({ error: "Tell me what the post is about first" }, { status: 400 })
    }

    // Platform-specific shaping — LinkedIn is more professional, IG/FB more warm.
    const platformNote =
      platform === "linkedin"
        ? "This is for LinkedIn — professional and community-minded, 2-4 short paragraphs, 3-5 hashtags."
        : "This is for Instagram/Facebook — warm and friendly, a strong first line, a few short lines, 5-8 hashtags."

    const system = `You write social media captions for North Falmouth Pharmacy, a family-owned long-term-care and community pharmacy serving Cape Cod since 2013.

Guidelines:
- Tone: warm, trustworthy, community-focused, easy to read.
- ${platformNote}
- Use relevant, tasteful hashtags (e.g. #CapeCod #NorthFalmouth #CommunityPharmacy #Wellness).
- NO medical advice, no specific drug claims, no prices, no invented facts or dates.
- Do not use em dashes.
- Return ONLY the caption text — no quotes, no markdown, no "Caption:" label.`

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Write a ${platform} caption about: ${prompt}` },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    })

    if (!resp.ok) {
      if (resp.status === 429) {
        return NextResponse.json({ error: "AI is busy — wait a moment and try again." }, { status: 429 })
      }
      const t = await resp.text().catch(() => "")
      console.error("social/generate groq error:", resp.status, t.slice(0, 300))
      return NextResponse.json({ error: "Could not generate. Try again." }, { status: 500 })
    }

    const data = await resp.json()
    const caption = String(data?.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/^["']|["']$/g, "") // strip stray wrapping quotes

    if (!caption) {
      return NextResponse.json({ error: "Empty response — try again." }, { status: 500 })
    }
    return NextResponse.json({ caption })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
