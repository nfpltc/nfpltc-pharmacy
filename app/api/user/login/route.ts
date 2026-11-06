import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { verifyPassword, createSession } from "@/lib/portal-auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const emailLower = email.trim().toLowerCase()

    const { data: user } = await sb
      .from("portal_users")
      .select("id, password_hash, status, account_number")
      .eq("email", emailLower)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: "No account found with this email. Please create an account first." }, { status: 401 })
    }

    if (user.status === "suspended") {
      return NextResponse.json({ error: "Your account has been suspended. Please contact the pharmacy." }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 })
    }

    // Update last login
    await sb.from("portal_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id)

    await createSession(user.id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Login error:", e)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
