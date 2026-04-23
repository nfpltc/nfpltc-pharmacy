import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generatePost, pickNextTopic } from "@/lib/blog-generator"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Vercel Cron adds "Authorization: Bearer <CRON_SECRET>" for us automatically
// when CRON_SECRET is set as an env var and the schedule is in vercel.json.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get("authorization") || ""
  return h === `Bearer ${secret}`
}

// Default: auto-publish. Set BLOG_AUTO_PUBLISH=false to force drafts.
function shouldAutoPublish(): boolean {
  return process.env.BLOG_AUTO_PUBLISH !== "false"
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const isTest = url.searchParams.get("test") === "1"
  if (!isTest && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sb = admin()

    // 1) Look at the 35 most recent AI-generated posts so we don't repeat a
    //    topic too soon. Topics map to stable IDs via our topic bank.
    const { data: recentRows } = await sb
      .from("blog_posts")
      .select("generated_topic_id, created_at")
      .not("generated_topic_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(35)
    const recentIds: string[] = (recentRows || [])
      .map((r: any) => r.generated_topic_id)
      .filter(Boolean)

    // 2) Pick a topic and generate the post (Groq + Unsplash)
    const topic = pickNextTopic(recentIds)
    const post = await generatePost(topic)

    // 3) Ensure slug uniqueness
    let slug = post.slug
    const { data: clash } = await sb
      .from("blog_posts").select("id").eq("slug", slug).maybeSingle()
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`

    // 4) Map to the actual columns of your blog_posts table:
    //    id, title, slug, excerpt, content, category, author, status,
    //    featured_image, read_time, created_at, updated_at, published_at,
    //    + the new ones from the migration: generated_topic_id, generated_at, image_credit
    const autoPublish = shouldAutoPublish()
    const row: Record<string, any> = {
      title:              post.title,
      slug,
      excerpt:            post.excerpt,
      content:            post.content,
      category:           topic.category,                  // Services / Education / Caregivers / Seasonal / Community
      author:             "North Falmouth Pharmacy Team",
      status:             autoPublish ? "published" : "draft",
      featured_image:     post.main_image_url,             // main image column on this schema
      read_time:          estimateReadTime(post.content),
      generated_topic_id: topic.id,
      generated_at:       new Date().toISOString(),
      image_credit:       post.image_credit,
    }
    if (autoPublish) row.published_at = new Date().toISOString()

    const { data, error } = await sb
      .from("blog_posts").insert(row).select("id, slug, status").single()
    if (error) {
      console.error("blog_posts insert failed:", error, row)
      return NextResponse.json({ error: `DB insert failed: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success:        true,
      auto_published: autoPublish,
      topic_id:       topic.id,
      topic_category: topic.category,
      title:          post.title,
      slug:           data.slug,
      blog_id:        data.id,
      status:         data.status,
      image_credit:   post.image_credit,
    })
  } catch (err: any) {
    console.error("cron generate-blog error:", err)
    return NextResponse.json({ error: err.message || "generation failed" }, { status: 500 })
  }
}

// Rough "X min read" estimate at ~225 wpm reading speed
function estimateReadTime(markdown: string): string {
  const words = (markdown || "").trim().split(/\s+/).length
  const mins = Math.max(1, Math.round(words / 225))
  return `${mins} min read`
}
