import { NextRequest, NextResponse } from "next/server"
import { parseJson } from "@/lib/social/groq"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
// Multimodal model on Groq. Override with GROQ_VISION_MODEL if the id changes.
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"

// POST /api/admin/social/caption-from-image
// Body: { imageUrl, tone? } → { linkedin, x, instagram }
// Looks at the image and writes three platform-native posts inspired by it.
export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: "AI is not configured (GROQ_API_KEY)." }, { status: 500 })
  const b = await req.json().catch(() => ({}))
  const imageUrl = String(b.imageUrl || "").trim()
  const tone = String(b.tone || "Warm & friendly")
  if (!/^https?:\/\//.test(imageUrl)) return NextResponse.json({ error: "Pick or upload an image first." }, { status: 400 })

  const system = `You are a senior social media strategist for North Falmouth Pharmacy, a Cape Cod community and long-term-care pharmacy. You are shown an IMAGE. Write THREE completely different, platform-native posts INSPIRED BY what is actually in the image. Reference what is visually present where it makes sense. Do NOT reformat one post into three — each must feel genuinely different in angle and voice. Tone: ${tone}.

Return ONLY strict JSON, no markdown and no code fences:
{"linkedin":"...","x":"...","instagram":"...","alt":"..."}

Platform rules:
- linkedin: max 3000 chars. A hook line under 120 chars, then 3 to 5 short paragraphs, then a question CTA, then 3 to 5 hashtags. Professional thought leadership.
- x: max 270 chars. ONE sharp thought, zero or one hashtag, no threads.
- instagram: max 2000 chars. A story opener, an insight, a question CTA, 2 to 3 emojis, then 8 to 12 hashtags on the LAST line. Personal and warm.
- alt: one short sentence describing the image for accessibility.

NEVER use markdown formatting (no ** or _), plain text only. No medical claims, no drug names, no prices, no dosages. Do not use em dashes.`

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.9,
        max_tokens: 2000,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Write the three posts based on this image." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    })
    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 200)
      if (r.status === 429) return NextResponse.json({ error: "AI is busy — try again in a moment." }, { status: 429 })
      return NextResponse.json({ error: `Vision AI error ${r.status}. ${detail}` }, { status: r.status })
    }
    const d = await r.json()
    const parsed = parseJson(String(d?.choices?.[0]?.message?.content || ""))
    if (!parsed || !parsed.linkedin || !parsed.x || !parsed.instagram) {
      return NextResponse.json({ error: "AI couldn't read that image — try another one." }, { status: 500 })
    }
    return NextResponse.json({
      linkedin: String(parsed.linkedin),
      x: String(parsed.x),
      instagram: String(parsed.instagram),
      alt: String(parsed.alt || ""),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Vision request failed" }, { status: 500 })
  }
}
