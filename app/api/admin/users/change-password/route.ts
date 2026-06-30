import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Resend } from "resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/admin/users/change-password
// Body: { new_password }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const newPassword = String(body.new_password || "")
    if (newPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })

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

    // Update password via admin API
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { error } = await sb.auth.admin.updateUserById(user.id, { password: newPassword })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify admin(s) about password change
    const { data: adminUser } = await sb.from("admin_users").select("name, email").eq("email", user.email).maybeSingle()
    const userName = adminUser?.name || user.email

    // Find admins to notify
    const { data: admins } = await sb.from("admin_users").select("email").eq("role", "admin").neq("email", user.email || "")
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL

    if (RESEND_API_KEY && FROM_EMAIL && admins && admins.length > 0) {
      const resend = new Resend(RESEND_API_KEY)
      for (const a of admins) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: a.email,
            subject: `🔐 Password changed: ${userName}`,
            html: `<p>User <strong>${userName}</strong> (${user.email}) changed their password on ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET.</p><p>No action needed — this is just a notification.</p>`,
            text: `User ${userName} (${user.email}) changed their password.`,
          })
        } catch {}
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
