import { createClient } from "@supabase/supabase-js"
import { generatePost, pickNextTopic } from "@/lib/blog-generator"

// Shared blog-generation logic used by both the scheduled cron and the
// manual "Generate now" button. Picks a fresh topic, generates content +
// Unsplash image via Groq, ensures a unique slug, and inserts the post.

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function estimateReadTime(text: string): string {
  const words = (text || "").split(/\s+/).filter(Boolean).length
  const mins = Math.max(1, Math.round(words / 200))
  return `${mins} min read`
}

export interface GenerateResult {
  success: boolean
  blog_id?: string
  slug?: string
  title?: string
  status?: string
  topic_category?: string
  error?: string
}

// Generate one blog post. `autoPublish` decides published vs draft.
export async function generateOneBlogPost(autoPublish: boolean): Promise<GenerateResult> {
  const sb = admin()

  // Avoid repeating a recent topic
  const { data: recentRows } = await sb
    .from("blog_posts")
    .select("generated_topic_id, created_at")
    .not("generated_topic_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(35)
  const recentIds: string[] = (recentRows || []).map((r: any) => r.generated_topic_id).filter(Boolean)

  const topic = pickNextTopic(recentIds)
  const post = await generatePost(topic)

  // Unique slug
  let slug = post.slug
  const { data: clash } = await sb.from("blog_posts").select("id").eq("slug", slug).maybeSingle()
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`

  const row: Record<string, any> = {
    title:              post.title,
    slug,
    excerpt:            post.excerpt,
    content:            post.content,
    category:           topic.category,
    author:             "North Falmouth Pharmacy Team",
    status:             autoPublish ? "published" : "draft",
    featured_image:     post.main_image_url,
    read_time:          estimateReadTime(post.content),
    key_points:         post.key_points,
    generated_topic_id: topic.id,
    generated_at:       new Date().toISOString(),
    image_credit:       post.image_credit,
  }
  if (autoPublish) row.published_at = new Date().toISOString()

  const { data, error } = await sb
    .from("blog_posts").insert(row).select("id, slug, status").single()
  if (error) {
    return { success: false, error: error.message }
  }

  // Update last_generated_at on the settings row (best-effort)
  try {
    await sb.from("blog_automation_settings")
      .upsert({ id: 1, last_generated_at: new Date().toISOString() }, { onConflict: "id" })
  } catch { /* non-fatal */ }

  return {
    success: true,
    blog_id: data.id,
    slug: data.slug,
    title: post.title,
    status: data.status,
    topic_category: topic.category,
  }
}

// Decide whether the cron should generate now, based on settings + frequency.
// Returns { should: boolean, reason: string }.
export async function shouldGenerateNow(): Promise<{ should: boolean; reason: string; autoPublish: boolean }> {
  const sb = admin()
  const { data: settings } = await sb
    .from("blog_automation_settings").select("*").eq("id", 1).maybeSingle()

  // Default behavior if no settings row: enabled, daily, auto-publish
  const s = settings || { enabled: true, frequency: "daily", auto_publish: true, last_generated_at: null }

  if (!s.enabled) return { should: false, reason: "Auto-generation is paused", autoPublish: s.auto_publish }

  const last = s.last_generated_at ? new Date(s.last_generated_at).getTime() : 0
  const now = Date.now()
  const hoursSince = (now - last) / 3_600_000

  // Minimum hours between posts per frequency. The cron runs daily, so these
  // gates decide whether to actually generate on a given run.
  const minHours: Record<string, number> = {
    daily: 20,        // ~1/day (20h guard avoids double-posting)
    weekly: 24 * 7 - 4,
    biweekly: 24 * 3 - 4,   // "biweekly" here = twice a week (~every 3 days)
    monthly: 24 * 30 - 4,
  }
  const threshold = minHours[s.frequency] ?? 20

  if (last && hoursSince < threshold) {
    return {
      should: false,
      reason: `Next post not due yet (${Math.round(threshold - hoursSince)}h remaining for ${s.frequency})`,
      autoPublish: s.auto_publish,
    }
  }

  return { should: true, reason: "Due for generation", autoPublish: s.auto_publish }
}
