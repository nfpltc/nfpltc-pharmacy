import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateOneBlogPost } from "@/lib/blog-automation"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// POST /api/admin/blog-settings/generate-now
// Body: { publish?: boolean }  (default: use the saved auto_publish setting)
// Generates one blog post immediately, bypassing the schedule gate.
// Used by the "Generate Now" button on the Blog admin page.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Decide publish vs draft: explicit override, else the saved setting
    let autoPublish = true
    if ("publish" in body) {
      autoPublish = Boolean(body.publish)
    } else {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data } = await sb.from("blog_automation_settings").select("auto_publish").eq("id", 1).maybeSingle()
      autoPublish = data?.auto_publish ?? true
    }

    const result = await generateOneBlogPost(autoPublish)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Generation failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      title: result.title,
      slug: result.slug,
      blog_id: result.blog_id,
      status: result.status,
      topic_category: result.topic_category,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
