import { Resend } from "resend"
import { logEmail } from "./email-log"

// Sends a branded custom email via Resend AND records it in email_log.
// Shared by the "New email" send, the outbox "send now", and the cron.
export async function sendCustomEmail(opts: {
  to: string
  subject: string
  message: string
  sentBy?: string | null
}): Promise<{ ok: boolean; id?: string | null; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  if (!key) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." }
  if (!from) return { ok: false, error: "No sender email configured (FROM_EMAIL)." }

  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#0EA171,#0B7C79);padding:18px 24px;color:#ffffff;border-radius:10px 10px 0 0;">
    <div style="font-size:18px;font-weight:700;">North Falmouth Pharmacy</div>
  </div>
  <div style="border:1px solid #eee;border-top:none;border-radius:0 0 10px 10px;padding:22px 24px;font-size:15px;line-height:1.6;white-space:pre-line;">${esc(opts.message)}</div>
  <p style="font-size:12px;color:#9ca3af;margin-top:10px;text-align:center;">North Falmouth Pharmacy &middot; (508) 564-4459</p>
</div>`

  const resend = new Resend(key)
  try {
    const res: any = await resend.emails.send({ from, to: opts.to, subject: opts.subject, html, text: opts.message })
    if (res?.error) {
      await logEmail({ to: opts.to, subject: opts.subject, category: "custom", status: "failed", error: res.error.message, sentBy: opts.sentBy })
      return { ok: false, error: res.error.message || "Send failed" }
    }
    await logEmail({ to: opts.to, subject: opts.subject, category: "custom", status: "sent", resendId: res?.data?.id, sentBy: opts.sentBy, meta: { html } })
    return { ok: true, id: res?.data?.id || null }
  } catch (e: any) {
    await logEmail({ to: opts.to, subject: opts.subject, category: "custom", status: "failed", error: e?.message, sentBy: opts.sentBy })
    return { ok: false, error: e?.message || "Send failed" }
  }
}
