import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { signUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function publicBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, "")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "www.nfpltc.com"
  return `${proto}://${host}`
}

function unsubSecret() {
  return (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string
}

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"

// POST /api/admin/customers/send-email
// Body: { account_number, subject, message }
// Sends a custom email to one customer. Logs to customer_email_log.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const account = String(body.account_number || "").trim()
    const subject = String(body.subject || "").trim()
    const message = String(body.message || "").trim()

    if (!account || !subject || !message) {
      return NextResponse.json({ error: "account_number, subject, and message are required" }, { status: 400 })
    }

    const sb = admin()
    const { data: customer, error: cErr } = await sb
      .from("customers")
      .select("account_number, first_name, last_name, email, email_opt_in")
      .eq("account_number", account)
      .maybeSingle()

    if (cErr || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    if (!customer.email) {
      return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 })
    }
    if (!customer.email_opt_in) {
      return NextResponse.json({ error: "Customer has opted out of emails" }, { status: 400 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const base = publicBaseUrl(req)
    const unsubscribeUrl = `${base}/unsubscribe?t=${signUnsubscribeToken(account, unsubSecret())}`
    const firstName = customer.first_name || "there"

    // Convert plain-text message into simple HTML paragraphs
    const htmlBody = message
      .split("\n\n")
      .map(p => `<p style="margin:0 0 16px;line-height:1.6;color:#374151">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("")

    const html = `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:24px">
        <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
          <p style="margin:0 0 16px;color:#111827">Dear ${escapeHtml(firstName)},</p>
          ${htmlBody}
          <p style="margin:24px 0 0;color:#6B7280;font-size:14px">North Falmouth Pharmacy · (508) 564-4459</p>
        </div>
        <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:16px">
          <a href="${unsubscribeUrl}" style="color:#9CA3AF">Unsubscribe</a>
        </p>
      </div>
    </body></html>`

    const text = `Dear ${firstName},\n\n${message}\n\nNorth Falmouth Pharmacy · (508) 564-4459\n\nUnsubscribe: ${unsubscribeUrl}`

    const resend = new Resend(RESEND_API_KEY)
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if ((r as any).error) {
      return NextResponse.json({ error: (r as any).error.message || "Send failed" }, { status: 500 })
    }

    // Log it (best-effort)
    try {
      await sb.from("customer_email_log").insert({
        account_number: account,
        email_to: customer.email,
        email_type: "custom",
        subject,
        status: "sent",
        resend_message_id: (r as any).data?.id || null,
        sent_at: new Date().toISOString(),
      })
    } catch (e) { console.error("email log failed (non-fatal):", e) }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
