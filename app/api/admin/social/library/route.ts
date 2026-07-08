import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/social/db"
import crypto from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BUCKET = "social-images"

// Create the public bucket on first use; ignore "already exists".
async function ensureBucket(sb: any) {
  try { await sb.storage.createBucket(BUCKET, { public: true }) } catch { /* exists */ }
}

// GET → saved images, newest first.
export async function GET() {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from("social_images")
    .select("id, url, filename, source, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ images: [], error: error.message })
  return NextResponse.json({ images: data || [] })
}

// POST → save an image, two ways:
//   multipart/form-data with `file`   → store an uploaded file
//   application/json { url, source? } → fetch a URL (AI/Unsplash) and re-host it
// Both re-host into the public bucket so the URL is permanent for Buffer.
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin()
  const ctype = req.headers.get("content-type") || ""

  let bytes: ArrayBuffer | null = null
  let filename = "image"
  let contentType = "image/jpeg"
  let source = "upload"

  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file") as File | null
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 })
      bytes = await file.arrayBuffer()
      filename = file.name || "upload"
      contentType = file.type || "image/jpeg"
      source = "upload"
    } else {
      const b = await req.json().catch(() => ({}))
      const url = String(b.url || "")
      if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "A file or image URL is required" }, { status: 400 })
      const r = await fetch(url)
      if (!r.ok) return NextResponse.json({ error: `Could not fetch image (${r.status})` }, { status: 400 })
      contentType = r.headers.get("content-type") || "image/jpeg"
      bytes = await r.arrayBuffer()
      filename = url.split("/").pop()?.split("?")[0] || "image"
      source = ["ai", "unsplash"].includes(b.source) ? b.source : "saved"
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not read image" }, { status: 400 })
  }

  if (!bytes || bytes.byteLength === 0) return NextResponse.json({ error: "Empty image" }, { status: 400 })

  await ensureBucket(sb)
  const ext = (contentType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg"
  const path = `social/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType, upsert: false })
  if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })

  const url = sb.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl
  if (!url) return NextResponse.json({ error: "Could not get public URL" }, { status: 500 })

  // Record in the library (non-fatal if the table isn't migrated yet — the URL
  // still works for the current post, it just won't show in the saved list).
  const { data: row } = await sb
    .from("social_images")
    .insert({ url, path, filename: filename.slice(0, 200), source })
    .select("id")
    .maybeSingle()

  return NextResponse.json({ id: row?.id || null, url, source })
}

// DELETE ?id= → remove from the library and storage.
export async function DELETE(req: NextRequest) {
  const sb = supabaseAdmin()
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const { data: row } = await sb.from("social_images").select("path").eq("id", id).maybeSingle()
  if (row?.path) { try { await sb.storage.from(BUCKET).remove([row.path]) } catch { /* ignore */ } }
  const { error } = await sb.from("social_images").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
