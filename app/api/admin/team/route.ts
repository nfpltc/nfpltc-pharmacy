// app/api/admin/team/route.ts
//
// CRUD for the Team Members admin page. Unlike most /api/admin/** routes in
// this app, every method here checks admin_users before touching data —
// this endpoint accepts photo uploads and writes public-facing bio content,
// so an unauthenticated POST/PATCH/DELETE would let anyone deface the public
// "Our Team" section. See lib/team-members.ts for the shared type/helpers.

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { slugifyName } from "@/lib/team-members"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "images"

/** Resolve the signed-in Supabase user from the request cookies, or null. */
async function currentUser() {
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

/** True if the signed-in user is an active admin_users row. Logs nothing about who was denied — just pass/fail. */
async function requireAdmin(): Promise<boolean> {
  const user = await currentUser()
  if (!user?.email) return false
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("id, active")
    .eq("email", user.email)
    .maybeSingle()
  return !!data && data.active !== false
}

async function uploadPhoto(file: File, slug: string): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const path = `team/${slug}-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, buf, {
    upsert: true,
    contentType: file.type || "image/*",
  })
  if (error) throw error
  return supabaseAdmin().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base || crypto.randomUUID().slice(0, 8)
  let attempt = slug
  let n = 1
  for (;;) {
    let q = supabaseAdmin().from("team_members").select("id").eq("slug", attempt)
    if (excludeId) q = q.neq("id", excludeId)
    const { data } = await q.maybeSingle()
    if (!data) return attempt
    n += 1
    attempt = `${slug}-${n}`
  }
}

function parseExpertise(raw: FormDataEntryValue | null): string[] {
  if (raw == null) return []
  return String(raw)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

// GET /api/admin/team — list every member (visible and hidden), for the admin table.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { data, error } = await supabaseAdmin()
    .from("team_members")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data || [] })
}

// POST /api/admin/team — create a member. multipart/form-data with an optional "photo" file.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  try {
    const form = await req.formData()
    const name = String(form.get("name") || "").trim()
    const role = String(form.get("role") || "").trim()
    if (!name || !role) return NextResponse.json({ error: "Name and role are required" }, { status: 400 })

    const rawSlug = String(form.get("slug") || "")
    const slug = await uniqueSlug(slugifyName(rawSlug || name))

    const photoFile = form.get("photo") as File | null
    const photo_url = photoFile && photoFile.size > 0 ? await uploadPhoto(photoFile, slug) : null

    // New members go last by default: one past the current max order.
    const { data: maxRow } = await supabaseAdmin()
      .from("team_members")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    const display_order = (maxRow?.display_order ?? -1) + 1

    const payload = {
      name,
      role,
      slug,
      credentials: String(form.get("credentials") || "").trim() || null,
      short_bio: String(form.get("short_bio") || "").trim() || null,
      long_bio: String(form.get("long_bio") || "").trim() || null,
      tagline: String(form.get("tagline") || "").trim() || null,
      expertise: parseExpertise(form.get("expertise")),
      photo_url,
      display_order,
      visible: form.get("visible") !== "false",
    }

    const { data, error } = await supabaseAdmin().from("team_members").insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ member: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create team member" }, { status: 500 })
  }
}

// PATCH /api/admin/team — update a member. multipart/form-data, "id" required,
// every other field optional (only fields present in the form are updated).
// A photo file replaces the existing photo; omit it to keep the current one.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  try {
    const form = await req.formData()
    const id = String(form.get("id") || "")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (form.has("name")) updates.name = String(form.get("name") || "").trim()
    if (form.has("role")) updates.role = String(form.get("role") || "").trim()
    if (form.has("credentials")) updates.credentials = String(form.get("credentials") || "").trim() || null
    if (form.has("short_bio")) updates.short_bio = String(form.get("short_bio") || "").trim() || null
    if (form.has("long_bio")) updates.long_bio = String(form.get("long_bio") || "").trim() || null
    if (form.has("tagline")) updates.tagline = String(form.get("tagline") || "").trim() || null
    if (form.has("expertise")) updates.expertise = parseExpertise(form.get("expertise"))
    if (form.has("visible")) updates.visible = form.get("visible") !== "false"
    if (form.has("display_order")) {
      const n = Number(form.get("display_order"))
      if (Number.isFinite(n)) updates.display_order = n
    }

    if (form.has("slug")) {
      const requested = slugifyName(String(form.get("slug") || ""))
      if (requested) updates.slug = await uniqueSlug(requested, id)
    }

    const photoFile = form.get("photo") as File | null
    if (photoFile && photoFile.size > 0) {
      const slugForPath = updates.slug || id
      updates.photo_url = await uploadPhoto(photoFile, slugForPath)
    }

    const { data, error } = await supabaseAdmin().from("team_members").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ member: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update team member" }, { status: 500 })
  }
}

// DELETE /api/admin/team?id=<uuid>
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

  const { error } = await supabaseAdmin().from("team_members").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
