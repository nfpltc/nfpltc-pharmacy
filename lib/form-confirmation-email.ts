import { Resend } from "resend"
import { logEmail } from "./email-log"

// Branded confirmation emailed to the person who submitted a public form.
// HIPAA-safe: contains no PHI — only "we received your <form>".
export function renderFormConfirmation(p: {
  firstName?: string
  formName: string
  pharmacyName?: string
  phone?: string
}) {
  const pharmacyName = p.pharmacyName || "North Falmouth Pharmacy"
  const phone = p.phone || "(508) 564-4459"
  const friendly = (p.firstName || "").trim().split(/\s+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
  const form = p.formName
  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const subject = `We received your ${form} — ${pharmacyName}`

  const text = [
    `Hi ${friendly || "there"},`, ``,
    `Thank you — we've received your ${form}.`,
    `Our team will review it and will only reach out if we need any further information.`, ``,
    `Questions? Call us at ${phone}.`, ``,
    `— ${pharmacyName}`,
  ].join("\n")

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F7F5EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5EF;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#0EA171 0%,#0B7C79 100%);padding:22px 28px;color:#ffffff;">
        <div style="font-size:19px;font-weight:700;">${esc(pharmacyName)}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:2px;">Long Term Care Pharmacy</div>
      </td></tr>
      <tr><td style="padding:30px 28px 6px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:#D1FAE5;margin:0 auto 14px;line-height:64px;font-size:32px;color:#059669;">&#10003;</div>
        <h1 style="margin:0 0 6px;font-size:22px;color:#111827;">We&rsquo;ve got it!</h1>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#4b5563;">Hi ${esc(friendly) || "there"}, thank you — we&rsquo;ve received your <strong>${esc(form)}</strong>.</p>
      </td></tr>
      <tr><td style="padding:14px 28px 26px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4b5563;text-align:center;">Our team will review it and will only reach out if we need any further information from you.</p>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;font-size:13px;color:#6b7280;">Questions? Call <strong style="color:#0B7C79;">${esc(phone)}</strong> — we're happy to help.</div>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:14px 28px;text-align:center;font-size:12px;color:#9ca3af;">${esc(pharmacyName)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`

  return { subject, html, text }
}

// Fire-and-forget confirmation to the submitter. NEVER throws — a failed
// confirmation must not fail the form submission itself.
export async function sendFormConfirmation(opts: {
  to?: string | null
  firstName?: string
  formName: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  const to = String(opts.to || "").trim()
  if (!key || !from || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false
  try {
    const resend = new Resend(key)
    const { subject, html, text } = renderFormConfirmation({ firstName: opts.firstName, formName: opts.formName })
    const res: any = await resend.emails.send({ from, to, subject, html, text })
    await logEmail({
      to, subject, category: "form",
      status: res?.error ? "failed" : "sent",
      resendId: res?.data?.id, error: res?.error?.message,
      meta: { form: opts.formName },
    })
    return !res?.error
  } catch {
    return false
  }
}
