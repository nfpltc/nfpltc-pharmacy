// Catalog of Groq models we know about: what they can do and what they cost.
//
// Groq retires model ids over time (llama-4-scout was decommissioned
// 2026-07-17), which used to break the Social editor until someone changed the
// code. The admin now picks the model in the UI, so a retirement is a dropdown
// change instead of a deploy. This table only supplies the labels/pricing —
// the live list of ids always comes from the account's /v1/models.

export type ModelInfo = {
  id: string
  label: string
  vision: boolean          // can accept image input
  inPer1M: number | null   // USD per 1M input tokens
  outPer1M: number | null  // USD per 1M output tokens
  note?: string
}

// Prices from groq.com/pricing. Update alongside Groq's pricing page.
export const MODEL_CATALOG: ModelInfo[] = [
  { id: "qwen/qwen3.6-27b",        label: "Qwen 3.6 27B",       vision: true,  inPer1M: 0.60,  outPer1M: 3.00, note: "Multimodal — required for image posts" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",      vision: false, inPer1M: 0.59,  outPer1M: 0.79, note: "Text only" },
  { id: "openai/gpt-oss-120b",     label: "GPT-OSS 120B",       vision: false, inPer1M: 0.15,  outPer1M: 0.60, note: "Text only" },
  { id: "openai/gpt-oss-20b",      label: "GPT-OSS 20B",        vision: false, inPer1M: 0.075, outPer1M: 0.30, note: "Text only" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",       vision: false, inPer1M: 0.05,  outPer1M: 0.08, note: "Text only — cheapest" },
]

export const findModel = (id: string): ModelInfo | undefined =>
  MODEL_CATALOG.find(m => m.id === id)

// Heuristic for ids we don't have catalogued yet, so a brand-new Groq vision
// model still shows up as usable for image posts. Deliberately permissive:
// offering a model that turns out to be text-only just shows an error the admin
// can recover from, whereas hiding a working vision model leaves them stuck —
// which is the exact failure this picker exists to prevent.
export function looksLikeVision(id: string): boolean {
  return /vision|multimodal|qwen|llava|scout|maverick|[-/]vl[-\d]?|omni|gemma-?3/i.test(id)
}

// "$0.60 / $3.00 per 1M" — compact enough to sit next to a dropdown option.
export function priceLabel(m: { inPer1M: number | null; outPer1M: number | null }): string {
  if (m.inPer1M == null || m.outPer1M == null) return "price n/a"
  return `$${m.inPer1M}/$${m.outPer1M} per 1M`
}

// Rough cost of one "Post from image" call so the admin can see the impact of
// their choice. An image plus prompt is ~1.5k input tokens; we cap output at
// 1800. Deliberately approximate — it is a guide, not a bill.
export function estimateCallCost(m: { inPer1M: number | null; outPer1M: number | null }): string {
  if (m.inPer1M == null || m.outPer1M == null) return ""
  const cost = (1500 / 1_000_000) * m.inPer1M + (1800 / 1_000_000) * m.outPer1M
  return `~$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}/post`
}
