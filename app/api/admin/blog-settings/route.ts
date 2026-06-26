import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const VALID_FREQ = ["daily", "weekly", "biweekly", "monthly"]

// GET /api/admin/blog-settings — returns current settings + derived status
export async function GET() {
  try {
    const sb = admin()
    const { data } = await sb.from("blog_automation_settings").select("*").eq("id", 1).maybeSingle()

    const settings = data || { enabled: true, frequency: "daily", auto_publish: true, last_generated_at: null }

    // Count how many posts generated this week and this month (for display)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [{ count: weekCount }, { count: monthCount }, { count: totalCount }] = await Promise.all([
      sb.from("blog_posts").select("id", { count: "exact", head: true }).not("generated_topic_id", "is", null).gte("created_at", weekAgo),
      sb.from("blog_posts").select("id", { count: "exact", head: true }).not("generated_topic_id", "is", null).gte("created_at", monthStart),
      sb.from("blog_posts").select("id", { count: "exact", head: true }).not("generated_topic_id", "is", null),
    ])

    return NextResponse.json({
      settings,
      stats: {
        this_week: weekCount ?? 0,
        this_month: monthCount ?? 0,
        total_ai: totalCount ?? 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// PATCH /api/admin/blog-settings — update settings
// Body: { enabled?, frequency?, auto_publish? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if ("enabled" in body) updates.enabled = Boolean(body.enabled)
    if ("auto_publish" in body) updates.auto_publish = Boolean(body.auto_publish)
    if ("frequency" in body) {
      const f = String(body.frequency)
      if (!VALID_FREQ.includes(f)) {
        return NextResponse.json({ error: "Invalid frequency" }, { status: 400 })
      }
      updates.frequency = f
    }

    const sb = admin()
    // Upsert the single row (id=1)
    const { data, error } = await sb
      .from("blog_automation_settings")
      .upsert({ id: 1, ...updates }, { onConflict: "id" })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
