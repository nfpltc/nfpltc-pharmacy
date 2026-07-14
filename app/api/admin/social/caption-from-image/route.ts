import { NextRequest, NextResponse } from "next/server"
import { parseJson } from "@/lib/social/groq"
import { toVisionDataUrl } from "@/lib/social/image-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
// Multimodal model on Groq. Override with GROQ_VISION_MODEL if the id changes.
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"

function system(tone: string) {
  return `You are a senior social media strategist for North Falmouth Pharmacy, a Cape Cod community and long-term-care pharmacy. You are shown an IMAGE. Write THREE completely different, platform-native posts INSPIRED BY what is actually in the image. Reference what is visually present where it makes sense; if the image is a flyer or has text, take inspiration from its theme rather than transcribing it. Do NOT reformat one post into three, each must feel genuinely different in angle and voice. Tone: ${tone}.

Return ONLY strict JSON, no markdown and no code fences:
{"linkedin":"...","x":"...","instagram":"...","alt":"..."}

Platform rules:
- linkedin: max 3000 chars. A hook line under 120 chars, then 3 to 5 short paragraphs, then a question CTA, then 3 to 5 hashtags. Professional thought leadership.
- x: max 270 chars. ONE sharp thought, zero or one hashtag, no threads.
- instagram: max 2000 chars. A story opener, an insight, a question CTA, 2 to 3 emojis, then 8 to 12 hashtags on the LAST line. Personal and warm.
- alt: one short sentence describing the image for accessibility.

NEVER use markdown formatting (no ** or _), plain text only. No medical claims, no drug names, no prices, no dosages. Do not use em dashes.`
}

type VisionResult = { text: string } | { error: string; status: number }

// One Groq vision call. Asks for JSON mode; if this model/date rejects
// response_format we retry the same call without it (still tolerant-parsed).
async function callVision(key: string, imageContent: string, tone: string, strict: boolean): Promise<VisionResult> {
  const body: any = {
    model: VISION_MODEL,
    temperature: strict ? 0.35 : 0.6,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system(tone) + (strict ? "\n\nIMPORTANT: respond with the JSON object ONLY, no text before or after." : "") },
      {
        role: "user",
        content: [
          { type: "text", text: "Write the three posts based on this image. Output the JSON object only." },
          { type: "image_url", image_url: { url: imageContent } },
        ],
      },
    ],
  }

  const send = () => fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })

  let r = await send()
  // Some model/date combos don't accept JSON mode alongside an image — drop it and retry.
  if (!r.ok && r.status === 400) {
    delete body.response_format
    r = await send()
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200)
    if (r.status === 429) return { error: "AI is busy — try again in a moment.", status: 429 }
    return { error: `Vision AI error ${r.status}. ${detail}`, status: r.status }
  }
  const d = await r.json()
  return { text: String(d?.choices?.[0]?.message?.content || "") }
}

const isComplete = (p: any) => p && p.linkedin && p.x && p.instagram

// POST /api/admin/social/caption-from-image
// Body: { imageUrl, tone? } → { linkedin, x, instagram, alt }
// Looks at the image and writes three platform-native posts inspired by it.
export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: "AI is not configured (GROQ_API_KEY)." }, { status: 500 })

  const b = await req.json().catch(() => ({}))
  const rawUrl = String(b.imageUrl || "").trim()
  const tone = String(b.tone || "Warm & friendly")
  if (!/^(https?:|data:)/i.test(rawUrl)) {
    return NextResponse.json({ error: "Pick or upload an image first." }, { status: 400 })
  }

  // Normalise to an inline JPEG so ANY format / size / host works. If that fails
  // for an http(s) source we fall back to the original URL (still works for
  // public images); a data: URL we can't process has no URL fallback.
  let imageContent = rawUrl
  let normalised = false
  try {
    imageContent = await toVisionDataUrl(rawUrl)
    normalised = true
  } catch {
    if (/^data:/i.test(rawUrl)) {
      return NextResponse.json({ error: "That image could not be processed. Try a JPG or PNG." }, { status: 400 })
    }
    // keep the original http(s) URL as a best-effort fallback
  }

  try {
    // First pass (creative). Then, if the JSON didn't come back clean, one
    // stricter low-temperature retry before giving up.
    let last = await callVision(key, imageContent, tone, false)
    if ("error" in last) return NextResponse.json({ error: last.error }, { status: last.status })

    let parsed = parseJson(last.text)
    if (!isComplete(parsed)) {
      const retry = await callVision(key, imageContent, tone, true)
      if ("error" in retry) {
        // A transient failure (rate limit / upstream 5xx) on the retry should
        // surface as itself, not get masked as a generic "couldn't read" 502.
        return NextResponse.json({ error: retry.error }, { status: retry.status })
      }
      last = retry
      const p2 = parseJson(retry.text)
      if (isComplete(p2)) parsed = p2
    }

    if (!isComplete(parsed)) {
      // Surface what the model actually said so failures are diagnosable
      // instead of a blanket "try another one".
      const said = String(("text" in last && last.text) || "").replace(/\s+/g, " ").trim().slice(0, 160)
      const hint = normalised ? "" : "(used original image) "
      return NextResponse.json(
        { error: said ? `AI couldn't turn that image into posts. ${hint}Model said: ${said}` : "AI couldn't turn that image into posts. Try another one." },
        { status: 502 },
      )
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
