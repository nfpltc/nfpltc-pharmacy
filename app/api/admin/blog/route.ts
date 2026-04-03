import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET() {
  try {
    const { data, error } = await admin()
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const sb = admin()

    const post: Record<string, any> = {
      title: formData.get("title") as string,
      slug: formData.get("slug") as string,
      excerpt: formData.get("excerpt") as string || null,
      content: formData.get("content") as string,
      category: formData.get("category") as string || "News",
      author: formData.get("author") as string || "North Falmouth Pharmacy Team",
      status: formData.get("status") as string || "draft",
      read_time: formData.get("read_time") as string || "5 min read",
    }

    if (post.status === "published") {
      post.published_at = new Date().toISOString()
    }

    // Handle image upload
    const imageFile = formData.get("image") as File | null
    if (imageFile && imageFile.size > 0) {
      const safeName = `blog/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const buffer = Buffer.from(await imageFile.arrayBuffer())
      const { error: upErr } = await sb.storage
        .from("images")
        .upload(safeName, buffer, { contentType: imageFile.type })

      if (!upErr) {
        const { data: urlData } = sb.storage.from("images").getPublicUrl(safeName)
        post.featured_image = urlData.publicUrl
      }
    }

    const { data, error } = await sb.from("blog_posts").insert(post).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const formData = await req.formData()
    const id = formData.get("id") as string
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    const sb = admin()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    // Only add fields that were sent
    const fields = ["title", "slug", "excerpt", "content", "category", "author", "status", "read_time"]
    fields.forEach(f => {
      const val = formData.get(f)
      if (val !== null) updates[f] = val
    })

    // Handle publish/unpublish
    if (updates.status === "published") {
      // Check if already published
      const { data: existing } = await sb.from("blog_posts").select("published_at").eq("id", id).single()
      if (!existing?.published_at) updates.published_at = new Date().toISOString()
    }

    // Handle image upload
    const imageFile = formData.get("image") as File | null
    if (imageFile && imageFile.size > 0) {
      const safeName = `blog/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const buffer = Buffer.from(await imageFile.arrayBuffer())
      const { error: upErr } = await sb.storage
        .from("images")
        .upload(safeName, buffer, { contentType: imageFile.type })

      if (!upErr) {
        const { data: urlData } = sb.storage.from("images").getPublicUrl(safeName)
        updates.featured_image = urlData.publicUrl
      }
    }

    const { data, error } = await sb.from("blog_posts").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    const { error } = await admin().from("blog_posts").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
