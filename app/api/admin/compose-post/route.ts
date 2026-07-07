import { NextRequest, NextResponse } from "next/server"
import { groqChat, parseJson } from "@/lib/social/groq"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/admin/compose-post
// Body: { topic, audience?, goal?, tone?, voice? }
// Returns: { linkedin, x, instagram, image_query, image_prompt }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const topic = String(b.topic || "").trim()
  if (!topic) return NextResponse.json({ error: "Enter a topic." }, { status: 400 })

  const extras = [
    b.audience && `Audience: ${b.audience}.`,
    b.goal && `Goal: ${b.goal}.`,
    b.tone && `Tone: ${b.tone}.`,
    b.voice && `Voice hint: ${b.voice}.`,
  ].filter(Boolean).join(" ")

  const system = `You are a senior social media strategist for North Falmouth Pharmacy, a Cape Cod community and long-term-care pharmacy. Write THREE completely different, platform-native posts about the topic. Do NOT reformat one post into three — each must feel genuinely different in angle and voice.

Return ONLY strict JSON, no markdown and no code fences:
{"linkedin":"...","x":"...","instagram":"...","image_query":"...","image_prompt":"..."}

Platform rules:
- linkedin: max 3000 chars. A hook line under 120 chars, then 3 to 5 short paragraphs, then a question CTA, then 3 to 5 hashtags. Professional thought leadership.
- x: max 270 chars. ONE sharp thought, zero or one hashtag, no threads.
- instagram: max 2000 chars. A story opener, an insight, a question CTA, 2 to 3 emojis, then 8 to 12 hashtags on the LAST line. Personal and warm.
- image_query: 2 to 4 plain words for an Unsplash search.
- image_prompt: 40 to 80 words describing a photorealistic image for AI generation.

NEVER use markdown formatting (no ** or _), plain text only. No medical claims, no drug names, no prices, no dosages. Do not use em dashes.`

  const r = await groqChat(system, `Topic: ${topic}. ${extras}`.trim(), { temperature: 0.9, max_tokens: 2000 })
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status || 500 })

  const parsed = parseJson(r.text)
  if (!parsed || !parsed.linkedin || !parsed.x || !parsed.instagram) {
    return NextResponse.json({ error: "AI returned unparseable content — try again." }, { status: 500 })
  }
  return NextResponse.json({
    linkedin: String(parsed.linkedin),
    x: String(parsed.x),
    instagram: String(parsed.instagram),
    image_query: String(parsed.image_query || topic),
    image_prompt: String(parsed.image_prompt || ""),
  })
}
