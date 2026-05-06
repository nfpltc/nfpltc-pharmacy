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

// 30 minutes — long enough to find a statement, short enough that abandoned
// sessions don't keep the gate open indefinitely.
const COOKIE_MAX_AGE = 30 * 60

// POST /api/statements/gate
// Body: { name: string, email: string }
// Side effects: inserts a row in statement_viewer_log, sets stmt_viewer cookie
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name  = String(body.name || "").trim()
    const email = String(body.email || "").trim()

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }
    if (name.length > 200 || email.length > 200) {
      return NextResponse.json({ error: "Name or email is too long" }, { status: 400 })
    }

    // Capture IP + user-agent for audit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("x-real-ip")
      || "unknown"
    const userAgent = req.headers.get("user-agent") || ""

    const sb = admin()
    const { data, error } = await sb
      .from("statement_viewer_log")
      .insert({
        name,
        email,
        ip_address: ip,
        user_agent: userAgent.slice(0, 500),
      })
      .select("id")
      .single()

    if (error || !data) {
      console.error("statement gate insert failed:", error)
      return NextResponse.json({ error: "Could not record entry. Please try again." }, { status: 500 })
    }

    // Set a session cookie containing the log row id. The search endpoint
    // uses this id to update the "did they actually search" / "did they
    // view a statement" fields on the same row.
    const res = NextResponse.json({ success: true })
    res.cookies.set("stmt_viewer", data.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    return res
  } catch (err: any) {
    console.error("statement gate error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// GET /api/statements/gate
// Returns whether the current visitor has already passed the gate.
// The page uses this on first load to decide whether to show the gate.
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("stmt_viewer")
  return NextResponse.json({ allowed: Boolean(cookie?.value) })
}
