import { NextRequest, NextResponse } from "next/server"
import { generateImage } from "@/lib/social/images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/admin/social/image
// Body: { prompt?, query?, provider? }  provider: "auto" | "fal" | "unsplash"
// Returns: { url, provider, credit?, creditLink? }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const provider = ["auto", "fal", "unsplash"].includes(b.provider) ? b.provider : "auto"
  const r = await generateImage({ prompt: b.prompt, query: b.query, provider })
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json(r)
}
