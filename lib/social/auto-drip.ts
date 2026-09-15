// Auto-drip: picks the oldest unused image from the saved library, generates
// per-platform captions via Groq vision AI, and queues posts for every
// connected Buffer channel. Called once per day by the social-queue cron.

import { supabaseAdmin } from "./db"
import { getChannels } from "./buffer"
import { parseJson } from "./groq"
import { toVisionDataUrl } from "./image-fetch"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

const VISION_MODELS: string[] = Array.from(
  new Set(
    [process.env.GROQ_VISION_MODEL, "qwen/qwen3.6-27b"].filter(Boolean) as string[],
  ),
)

function systemPrompt(tone: string) {
  return (
    "You are a senior social media strategist for North Falmouth Pharmacy, " +
    "a Cape Cod community and long-term-care pharmacy. You are shown an IMAGE. " +
    "Write FOUR completely different, platform-native posts INSPIRED BY what is " +
    "actually in the image. Reference what is visually present where it makes " +
    "sense; if the image is a flyer or has text, take inspiration from its theme " +
    "rather than transcribing it. Do NOT reformat one post into four, each must " +
    `feel genuinely different in angle and voice. Tone: ${tone}.\n\n` +
    'Return ONLY strict JSON, no markdown and no code fences:\n' +
    '{"linkedin":"...","x":"...","instagram":"...","facebook":"..."}\n\n' +
    "Platform rules:\n" +
    "- linkedin: max 3000 chars. A hook line under 120 chars, then 3 to 5 short paragraphs, then a question CTA, then 3 to 5 hashtags.\n" +
    "- x: max 270 chars. ONE sharp thought, zero or one hashtag, no threads.\n" +
    "- instagram: max 2000 chars. A story opener, an insight, a question CTA, 2 to 3 emojis, then 8 to 12 hashtags on the LAST line.\n" +
    "- facebook: max 500 chars. Conversational, warm, like talking to a neighbor. A question to spark comments. 2 to 3 hashtags.\n\n" +
    "NEVER use markdown formatting (no ** or _), plain text only. No medical claims, no drug names, no prices, no dosages. Do not use em dashes."
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Captions = { linkedin: string; x: string; instagram: string; facebook: string }
type CaptionResult = Captions | { error: string }

async function generateCaptions(imageUrl: string, tone: string): Promise<CaptionResult> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { error: "GROQ_API_KEY not configured" }

  let imageContent: string
  try {
    imageContent = await toVisionDataUrl(imageUrl)
  } catch (e: any) {
    return { error: `Could not process image: ${e.message}` }
  }

  for (const model of VISION_MODELS) {
    try {
      const body: any = {
        model,
        temperature: 0.6,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemPrompt(tone) },
          {
            role: "user",
            content: [
              { type: "text", text: "Write the four posts based on this image. Output the JSON object only." },
              { type: "image_url", image_url: { url: imageContent } },
            ],
          },
        ],
      }

      let r = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })

      if (!r.ok && r.status === 400) {
        delete body.response_format
        r = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        })
      }

      if (!r.ok) {
        const detail = await r.text().catch(() => "")
        if (r.status === 404 || /model_not_found|does not exist/i.test(detail)) continue
        if (r.status === 429) {
          const retryAfter = Number(r.headers.get("retry-after") || 5)
          if (retryAfter <= 30) {
            await sleep((retryAfter + 1) * 1000)
            r = await fetch(GROQ_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body: JSON.stringify(body),
            })
            if (!r.ok) return { error: "Groq rate limit — will retry next cron run" }
          } else {
            return { error: "Groq rate limit — will retry next cron run" }
          }
        } else {
          return { error: `Groq error ${r.status}` }
        }
      }

      const d = await r.json()
      const text = String(d?.choices?.[0]?.message?.content || "")
      const parsed = parseJson(text)

      if (parsed?.linkedin && parsed?.instagram) {
        return {
          linkedin: String(parsed.linkedin),
          x: String(parsed.x || ""),
          instagram: String(parsed.instagram),
          facebook: String(parsed.facebook || parsed.linkedin),
        }
      }
    } catch (e: any) {
      console.error(`Auto-drip vision error (${model}):`, e.message)
      continue
    }
  }

  return { error: "No vision model produced valid captions" }
}

export interface DripResult {
  ok: boolean
  skipped?: string
  posted?: number
  image?: string
  error?: string
}

export async function runAutoDrip(): Promise<DripResult> {
  const sb = supabaseAdmin()

  // 1. Check if auto-drip is enabled
  let config: any = { enabled: true, tone: "Warm & friendly" }
  try {
    const { data } = await sb
      .from("social_drip_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
    if (data) config = data
  } catch {
    // Table not migrated — default to enabled
  }
  if (!config.enabled) return { ok: true, skipped: "Auto-drip is disabled" }

  // 2. Check if we already auto-posted today
  const today = new Date().toISOString().slice(0, 10)
  try {
    const { data: todayPosts } = await sb
      .from("social_queue")
      .select("id")
      .eq("source", "auto_drip")
      .gte("created_at", today + "T00:00:00Z")
      .limit(1)
    if (todayPosts?.length) return { ok: true, skipped: "Already auto-posted today" }
  } catch {
    // source column doesn't exist — fall back to checking drip_used_at
    try {
      const { data: usedToday } = await sb
        .from("social_images")
        .select("id")
        .gte("drip_used_at", today + "T00:00:00Z")
        .limit(1)
      if (usedToday?.length) return { ok: true, skipped: "Already auto-posted today" }
    } catch {
      // drip_used_at column missing — migration needed
      return { ok: false, error: "Run supabase/social_drip.sql to enable auto-posting" }
    }
  }

  // 3. Pick the next unused image (oldest first)
  let image: any = null
  try {
    const { data } = await sb
      .from("social_images")
      .select("*")
      .is("drip_used_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    image = data
  } catch {
    return { ok: false, error: "Run supabase/social_drip.sql to enable auto-posting" }
  }
  if (!image) return { ok: true, skipped: "No unused images in library" }

  // 4. Generate captions via Groq vision
  console.log(`🤖 Auto-drip: generating captions for image ${image.id}`)
  const captions = await generateCaptions(image.url, config.tone || "Warm & friendly")
  if ("error" in captions) return { ok: false, error: captions.error }

  // 5. Get connected Buffer channels
  const { channels, error: chErr } = await getChannels()
  if (!channels.length) return { ok: false, error: chErr || "No Buffer channels connected" }

  // 6. Queue a post for each channel
  const platformText: Record<string, string> = {
    linkedin: captions.linkedin,
    x: captions.x,
    instagram: captions.instagram,
    facebook: captions.facebook,
  }

  const items = channels
    .filter((ch) => platformText[ch.platform])
    .map((ch) => ({
      text: platformText[ch.platform] || captions.linkedin,
      platform: ch.platform,
      channel_id: ch.id,
      channel_name: ch.name,
      image_url: image.url,
      due_at: new Date().toISOString(),
      source: "auto_drip",
      instagram_type: ch.platform === "instagram" ? "post" : null,
      status: "pending",
    }))

  if (!items.length) return { ok: false, error: "No matching channels for generated captions" }

  // Insert — strip unknown columns if migration hasn't been run
  let ins = await sb.from("social_queue").insert(items).select("id")
  if (ins.error) {
    const cleaned = items.map(({ source, instagram_type, ...rest }: any) => rest)
    ins = await sb.from("social_queue").insert(cleaned).select("id")
  }
  if (ins.error) return { ok: false, error: `Queue insert: ${ins.error.message}` }

  // 7. Mark the image as used
  await sb
    .from("social_images")
    .update({ drip_used_at: new Date().toISOString() })
    .eq("id", image.id)

  console.log(`✅ Auto-drip: queued ${items.length} posts from image ${image.id}`)
  return { ok: true, posted: items.length, image: image.url }
}
