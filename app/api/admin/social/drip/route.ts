import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/social/db"
import { runAutoDrip } from "@/lib/social/auto-drip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → current drip config + stats (unused image count, last drip date).
export async function GET() {
  const sb = supabaseAdmin()

  let config = { enabled: true, tone: "Warm & friendly" }
  try {
    const { data } = await sb
      .from("social_drip_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
    if (data) config = data
  } catch {
    // table not migrated
  }

  let unusedCount = 0
  let totalCount = 0
  let lastDripAt: string | null = null
  try {
    const { count: total } = await sb
      .from("social_images")
      .select("id", { count: "exact", head: true })
    totalCount = total || 0

    const { count: unused } = await sb
      .from("social_images")
      .select("id", { count: "exact", head: true })
      .is("drip_used_at", null)
    unusedCount = unused || 0

    const { data: lastUsed } = await sb
      .from("social_images")
      .select("drip_used_at")
      .not("drip_used_at", "is", null)
      .order("drip_used_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    lastDripAt = lastUsed?.drip_used_at || null
  } catch {
    // columns not migrated
  }

  return NextResponse.json({
    ...config,
    unusedCount,
    totalCount,
    lastDripAt,
    needsMigration: unusedCount === 0 && totalCount === 0,
  })
}

// POST → update config or trigger a manual run.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const sb = supabaseAdmin()

  if (b.action === "run") {
    const result = await runAutoDrip()
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  }

  // Update config
  const update: any = { updated_at: new Date().toISOString() }
  if (typeof b.enabled === "boolean") update.enabled = b.enabled
  if (typeof b.tone === "string") update.tone = b.tone

  try {
    const { error } = await sb
      .from("social_drip_config")
      .upsert({ id: "default", ...update })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: "Run supabase/social_drip.sql first" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...update })
}
