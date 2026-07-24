import { NextResponse } from "next/server"
import { MODEL_CATALOG, findModel, looksLikeVision, priceLabel, estimateCallCost } from "@/lib/social/models"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"

// GET /api/admin/social/models
// Lists the models this Groq account can actually use, annotated with what we
// know about them (vision support + price). Live ids come from Groq so a
// retired model disappears from the dropdown on its own.
export async function GET() {
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: "AI is not configured (GROQ_API_KEY).", models: [] }, { status: 500 })

  let liveIds: string[] = []
  let liveError = ""
  try {
    const r = await fetch(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" })
    if (r.ok) {
      const d = await r.json()
      liveIds = (d?.data || [])
        .map((m: any) => String(m?.id || ""))
        .filter(Boolean)
        // Groq also lists audio/guard models that can't do chat completions.
        .filter((id: string) => !/whisper|tts|guard|embed/i.test(id))
    } else {
      liveError = `Groq /models returned ${r.status}`
    }
  } catch (e: any) {
    liveError = e?.message || "Could not reach Groq"
  }

  // Prefer the live list; fall back to the catalog if Groq is unreachable so
  // the dropdown is never empty.
  const ids = liveIds.length ? liveIds : MODEL_CATALOG.map(m => m.id)

  const models = ids.map(id => {
    const known = findModel(id)
    const vision = known ? known.vision : looksLikeVision(id)
    const info = known || { id, label: id, vision, inPer1M: null, outPer1M: null }
    return {
      id,
      label: known?.label || id,
      vision,
      note: known?.note || (vision ? "Multimodal" : ""),
      inPer1M: info.inPer1M,
      outPer1M: info.outPer1M,
      price: priceLabel(info),
      perPost: estimateCallCost(info),
      known: !!known,
    }
  })
  // Vision models first (only those work for "Post from image"), then by price.
  models.sort((a, b) =>
    (a.vision === b.vision ? 0 : a.vision ? -1 : 1) ||
    ((a.inPer1M ?? 999) - (b.inPer1M ?? 999))
  )

  return NextResponse.json({ models, source: liveIds.length ? "groq" : "catalog", liveError })
}
