import { NextRequest, NextResponse } from "next/server"
import { groqChat } from "@/lib/social/groq"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const LIMITS: Record<string, number> = { linkedin: 3000, x: 270, instagram: 2000 }

// POST /api/admin/social-rewrite
// Body: { text, instruction, platform? } → { text }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const text = String(b.text || "").trim()
  const instruction = String(b.instruction || "").trim()
  const platform = String(b.platform || "").toLowerCase()
  if (!text) return NextResponse.json({ error: "Nothing to rewrite yet." }, { status: 400 })
  if (!instruction) return NextResponse.json({ error: "Pick a rewrite action." }, { status: 400 })

  const limit = LIMITS[platform]
  const system = `You rewrite social media copy for North Falmouth Pharmacy. Apply the instruction faithfully.${
    limit ? ` Keep it under ${limit} characters.` : ""
  } Keep it platform-native and plain text (no markdown). No medical claims, no drug names, no prices, no em dashes. Return ONLY the rewritten text — no preamble, no quotes, no labels.`

  const r = await groqChat(system, `Instruction: ${instruction}\n\nText:\n${text}`, { temperature: 0.8, max_tokens: 1200 })
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status || 500 })

  let out = r.text.trim().replace(/^["']|["']$/g, "")
  if (limit && out.length > limit) out = out.slice(0, limit)
  if (!out) return NextResponse.json({ error: "Empty response — try again." }, { status: 500 })
  return NextResponse.json({ text: out })
}
