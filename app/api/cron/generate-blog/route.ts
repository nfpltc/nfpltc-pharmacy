import { NextRequest, NextResponse } from "next/server"
import { generateOneBlogPost, shouldGenerateNow } from "@/lib/blog-automation"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// Vercel Cron adds "Authorization: Bearer <CRON_SECRET>" automatically when
// CRON_SECRET is set and the schedule is in vercel.json.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get("authorization") || ""
  return h === `Bearer ${secret}`
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const isTest = url.searchParams.get("test") === "1"
  const force = url.searchParams.get("force") === "1"   // bypass schedule gate
  if (!isTest && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const gate = await shouldGenerateNow()

    if (!force && !gate.should) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const result = await generateOneBlogPost(gate.autoPublish)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "generation failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      auto_published: result.status === "published",
      title: result.title,
      slug: result.slug,
      blog_id: result.blog_id,
      status: result.status,
      topic_category: result.topic_category,
    })
  } catch (err: any) {
    console.error("cron generate-blog error:", err)
    return NextResponse.json({ error: err.message || "generation failed" }, { status: 500 })
  }
}
