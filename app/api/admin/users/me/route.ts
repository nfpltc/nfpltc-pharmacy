import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const ALL_PAGES = ["dashboard","crm","statements","medication-tasks","chats","blog","enrollments","contacts","credit-cards","assistant","users"]

// GET /api/admin/users — list all admin users
export async function GET() {
  try {
    const sb = admin()
    const { data, error } = await sb.from("admin_users").select("*").order("created_at")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [], all_pages: ALL_PAGES })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/users — create a new admin/staff user
// Body: { email, name, password, role, allowed_pages }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()
    const name = String(body.name || "").trim()
    const password = String(body.password || "")
    const role = body.role === "admin" ? "admin" : "staff"
    const pages: string[] = role === "admin" ? ALL_PAGES : (Array.isArray(body.allowed_pages) ? body.allowed_pages.filter((p: string) => ALL_PAGES.includes(p)) : [])

    if (!email || !name || !password) return NextResponse.json({ error: "email, name, and password are required" }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })

    const sb = admin()

    // Create Supabase Auth user
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    // Create admin_users record
    const { data: user, error: dbErr } = await sb.from("admin_users").insert({
      supabase_uid: authUser.user.id,
      email,
      name,
      role,
      allowed_pages: role === "admin" ? ALL_PAGES : pages,
    }).select().single()

    if (dbErr) {
      // Rollback: delete the auth user
      await sb.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/users — update user
// Body: { id, name?, role?, allowed_pages?, active?, reset_password? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const sb = admin()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if ("name" in body) updates.name = String(body.name).trim()
    if ("role" in body) {
      updates.role = body.role === "admin" ? "admin" : "staff"
      if (updates.role === "admin") updates.allowed_pages = ALL_PAGES
    }
    if ("allowed_pages" in body && body.role !== "admin") {
      updates.allowed_pages = Array.isArray(body.allowed_pages)
        ? body.allowed_pages.filter((p: string) => ALL_PAGES.includes(p))
        : []
    }
    if ("active" in body) updates.active = Boolean(body.active)

    const { error } = await sb.from("admin_users").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Reset password if requested
    if (body.reset_password && typeof body.reset_password === "string" && body.reset_password.length >= 6) {
      const { data: usr } = await sb.from("admin_users").select("supabase_uid").eq("id", id).single()
      if (usr?.supabase_uid) {
        await sb.auth.admin.updateUserById(usr.supabase_uid, { password: body.reset_password })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/users?id=XXX
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const sb = admin()
    const { data: usr } = await sb.from("admin_users").select("supabase_uid, role").eq("id", id).single()
    if (!usr) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (usr.role === "admin") {
      // Don't allow deleting the last admin
      const { count } = await sb.from("admin_users").select("id", { count: "exact", head: true }).eq("role", "admin")
      if ((count ?? 0) <= 1) return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 })
    }

    await sb.from("admin_users").delete().eq("id", id)
    if (usr.supabase_uid) await sb.auth.admin.deleteUser(usr.supabase_uid)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
