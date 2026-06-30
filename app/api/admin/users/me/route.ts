import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/users/me — returns current logged-in user's info + permissions
export async function GET() {
  try {
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
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    // Look up admin_users record
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: adminUser } = await sb
      .from("admin_users")
      .select("*")
      .eq("email", user.email)
      .maybeSingle()

    if (!adminUser) {
      // User exists in Supabase Auth but not in admin_users — treat as full admin (backward compat)
      return NextResponse.json({
        user: { id: null, email: user.email, name: user.email?.split("@")[0], role: "admin", allowed_pages: ["dashboard","crm","statements","medication-tasks","chats","blog","enrollments","contacts","credit-cards","assistant","users"], active: true },
      })
    }

    if (!adminUser.active) {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 })
    }

    // Update last_login
    await sb.from("admin_users").update({ last_login: new Date().toISOString() }).eq("id", adminUser.id)

    return NextResponse.json({ user: adminUser })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
