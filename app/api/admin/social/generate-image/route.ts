import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { renderHealthTemplate, type HealthTemplate } from "@/lib/social/health-image-templates"
import { renderHtmlToImage, hctiConfigured } from "@/lib/social/render-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"
const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_AI_API_KEY

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/social/generate-image
//   { mode: "template", template, topic?, data? }   -> hcti HTML render
//   { mode: "ai", prompt }                           -> fal.ai Flux
// Returns { image_url } (re-hosted in the Supabase `images` bucket).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode === "ai" ? "ai" : "template"

    // 1) Get an image URL from the chosen provider.
    let providerUrl: string | null = null
    if (mode === "ai") {
      const r = await generateAiImage(String(body.prompt || "").trim())
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 500 })
      providerUrl = r.url
    } else {
      const template = (["tip_card", "food_as_medicine", "quote_card"].includes(body.template)
        ? body.template
        : "tip_card") as HealthTemplate

      // Use provided data, or ask Groq to build it from a topic.
      let data = body.data
      if (!data) {
        const topic = String(body.topic || "").trim()
        if (!topic) return NextResponse.json({ error: "Give a topic or data for the image." }, { status: 400 })
        const built = await buildTemplateData(template, topic)
        if ("error" in built) return NextResponse.json({ error: built.error }, { status: 500 })
        data = built.data
      }

      if (!hctiConfigured()) {
        return NextResponse.json({ error: "HTML renderer not configured. Set HCTI_USER_ID and HCTI_API_KEY." }, { status: 500 })
      }
      const html = renderHealthTemplate(template, data)
      const rendered = await renderHtmlToImage(html) // 1080x1350
      if (!rendered.url) return NextResponse.json({ error: rendered.error || "Render failed" }, { status: 500 })
      providerUrl = rendered.url
    }

    // 2) Re-host the PNG in Supabase storage so the URL is permanent.
    const stored = await rehostToSupabase(providerUrl!)
    if ("error" in stored) {
      // Storage failed — fall back to the provider URL so the user still gets an image.
      return NextResponse.json({ image_url: providerUrl, warning: stored.error })
    }
    return NextResponse.json({ image_url: stored.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// ── fal.ai Flux (photorealistic) ────────────────────────────────────────────
async function generateAiImage(prompt: string): Promise<{ url: string } | { error: string }> {
  if (!prompt) return { error: "Enter an image prompt." }
  if (!FAL_API_KEY) return { error: "FAL_API_KEY not configured (AI image engine)." }
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${prompt}. Clean, professional, health and wellness style, high quality.`,
      image_size: "portrait_4_3",
      num_images: 1,
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
  })
  if (!res.ok) return { error: `FAL API error: ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}` }
  const data = await res.json()
  const url = data?.images?.[0]?.url
  return url ? { url } : { error: "FAL returned no image." }
}

// ── Groq: topic -> structured template data ─────────────────────────────────
async function buildTemplateData(template: HealthTemplate, topic: string): Promise<{ data: any } | { error: string }> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return { error: "GROQ_API_KEY not configured." }

  const shape = {
    tip_card: `{"headline":"short punchy headline (<= 6 words)","tips":[{"emoji":"one emoji","label":"short tip (<= 6 words)"}]}  — exactly 4 tips`,
    food_as_medicine: `{"title":"FOOD AS MEDICINE or similar (<= 4 words)","items":[{"emoji":"one food emoji","food":"food name","benefit":"short benefit (<= 4 words)"}]}  — exactly 4 items`,
    quote_card: `{"quote":"a warm 1-2 sentence wellness message","attribution":"North Falmouth Pharmacy"}`,
  }[template]

  const system = `You create content for North Falmouth Pharmacy social graphics. Return ONLY valid JSON matching this shape, no markdown, no code fences:
${shape}
Keep text short enough to fit a graphic. Health-positive, no medical claims, no drug names, no prices, no dosages. Do not use em dashes.`

  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Topic: ${topic}` },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  })
  if (!resp.ok) {
    if (resp.status === 429) return { error: "AI is busy — wait a moment and try again." }
    return { error: "Could not generate image content." }
  }
  const j = await resp.json()
  const parsed = parseJson(j?.choices?.[0]?.message?.content || "")
  if (!parsed) return { error: "AI returned unparseable content — try again." }
  return { data: parsed }
}

// ── Download a remote image and upload it to the Supabase `images` bucket ────
async function rehostToSupabase(url: string): Promise<{ url: string } | { error: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" } })
    if (!res.ok) return { error: `Could not fetch rendered image (${res.status})` }
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get("content-type") || "image/png"
    const ext = contentType.includes("jpeg") ? "jpg" : "png"
    const safeName = `social/${Date.now()}-${Math.round(Number(String(buffer.length).slice(-4)) || 0)}.${ext}`
    const sb = admin()
    const { error: upErr } = await sb.storage.from("images").upload(safeName, buffer, { contentType })
    if (upErr) return { error: `Storage upload failed: ${upErr.message}` }
    const { data } = sb.storage.from("images").getPublicUrl(safeName)
    return { url: data.publicUrl }
  } catch (e: any) {
    return { error: e.message || "Re-host failed" }
  }
}

// Tolerant JSON parser (same approach as customers/polish-email).
function parseJson(raw: string): any {
  let s = String(raw).trim()
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  const a = s.indexOf("{")
  const b = s.lastIndexOf("}")
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try { return JSON.parse(s) } catch { /* fall through */ }
  try {
    return JSON.parse(s.replace(/[\n\r\t]/g, (m) => ({ "\n": "\\n", "\r": "\\r", "\t": "\\t" }[m] || m)))
  } catch { return null }
}
