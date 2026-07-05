import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { postSocial, socialConfigured } from "@/lib/social/post-social"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// Service-role client — same inline "admin()" pattern as app/api/admin/blog/route.ts
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const ALL_PLATFORMS = ["facebook", "instagram", "linkedin"]

// GET /api/admin/social/post → recent post history
export async function GET() {
  try {
    const { data, error } = await admin()
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data, configured: socialConfigured() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/social/post — multipart form:
//   caption (string, required)
//   platforms (comma-separated, e.g. "facebook,instagram")
//   image (File, optional)
//   image_url (string, optional — used if no file is uploaded)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const sb = admin()

    const caption = String(form.get("caption") || "").trim()
    const platforms = String(form.get("platforms") || "")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p) => ALL_PLATFORMS.includes(p))

    let imageUrl = String(form.get("image_url") || "").trim() || null

    // Upload an attached image to the Supabase `images` bucket (blog route pattern).
    const imageFile = form.get("image") as File | null
    if (imageFile && imageFile.size > 0) {
      const safeName = `social/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const buffer = Buffer.from(await imageFile.arrayBuffer())
      const { error: upErr } = await sb.storage
        .from("images")
        .upload(safeName, buffer, { contentType: imageFile.type })
      if (upErr) {
        return NextResponse.json({ error: `Image upload failed: ${upErr.message}` }, { status: 500 })
      }
      const { data: urlData } = sb.storage.from("images").getPublicUrl(safeName)
      imageUrl = urlData.publicUrl
    }

    // ── Pre-publish validation ─────────────────────────────────────────────
    // Encodes the real-world rules: a caption is required, at least one platform
    // must be selected, and Instagram cannot post text-only (it needs an image).
    // This is the spot to tune if your rules differ — see note in the chat.
    const problem = validatePost(caption, platforms, imageUrl)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    // Deliver via the provider (Make webhook today; Buffer later).
    const result = await postSocial({
      text: caption,
      image_url: imageUrl || undefined,
      platforms,
      content_type: imageUrl ? "image" : "text",
      source: "admin/social",
      timestamp: new Date().toISOString(),
    })

    // Record the outcome. If nothing is wired up (provider 'draft') or the
    // webhook failed, we still keep the post as a draft rather than lose it.
    const status = result.ok ? "posted" : result.provider === "draft" ? "draft" : "failed"
    const row: Record<string, any> = {
      caption,
      image_url: imageUrl,
      platforms,
      status,
      provider: result.provider,
      error: status === "failed" ? "Webhook did not accept the post" : null,
      posted_at: result.ok ? new Date().toISOString() : null,
    }
    const { data, error } = await sb.from("social_posts").insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (status === "failed") {
      return NextResponse.json({ post: data, error: "Post was saved but the webhook rejected it." }, { status: 502 })
    }
    return NextResponse.json({
      post: data,
      draft: status === "draft",
      message:
        status === "draft"
          ? "Saved as draft — no social provider is connected yet (set SOCIAL_WEBHOOK_URL)."
          : "Posted!",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to post" }, { status: 500 })
  }
}

// Returns an error string if the post is invalid, or null if it's good to go.
function validatePost(caption: string, platforms: string[], imageUrl: string | null): string | null {
  if (!caption) return "Please write a caption."
  if (platforms.length === 0) return "Pick at least one platform."
  if (platforms.includes("instagram") && !imageUrl) {
    return "Instagram posts need an image. Add one, or uncheck Instagram."
  }
  return null
}
