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

// Fetch the actual sent email from Resend by its message id.
async function fetchResendEmail(resendId: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || !resendId) return null
  try {
    const r = await fetch(`https://api.resend.com/emails/${resendId}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    })
    if (!r.ok) return null
    const d = await r.json()
    return {
      subject: d?.subject || null,
      html: d?.html || null,
      text: d?.text || null,
      to: Array.isArray(d?.to) ? d.to.join(", ") : d?.to || null,
      from: d?.from || null,
      date: d?.created_at || null,
    }
  } catch { return null }
}

// GET /api/admin/mail/body?id=el_<uuid> | sl_<uuid>
// Returns the real body of a logged email (fetched from Resend by message id).
export async function GET(req: NextRequest) {
  const sb = admin()
  const raw = new URL(req.url).searchParams.get("id") || ""
  const us = raw.indexOf("_")
  const prefix = us > 0 ? raw.slice(0, us) : ""
  const id = us > 0 ? raw.slice(us + 1) : ""
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  let resendId: string | null = null
  try {
    if (prefix === "el") {
      const { data } = await sb.from("email_log").select("resend_id").eq("id", id).maybeSingle()
      resendId = data?.resend_id || null
    } else if (prefix === "sl") {
      const { data } = await sb.from("statement_email_log").select("resend_message_id").eq("id", id).maybeSingle()
      resendId = data?.resend_message_id || null
    }
  } catch { /* ignore */ }

  const remote = await fetchResendEmail(resendId || "")
  if (remote && (remote.html || remote.text)) {
    return NextResponse.json({ available: true, ...remote })
  }
  return NextResponse.json({
    available: false,
    error: "This email's body isn't available anymore (the email provider only keeps message contents for a limited time).",
  })
}
