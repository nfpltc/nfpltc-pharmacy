// Email template for monthly statement notifications.
// Returns both an HTML version (branded, inlined CSS for email clients)
// and a plain-text fallback (required for good deliverability).

export interface StatementEmailParams {
  firstName: string
  lastName: string
  billingPeriodLabel: string     // e.g. "March 2026"
  statementsUrl: string          // where to click to view (the public search page)
  unsubscribeUrl: string         // one-click unsubscribe link
  pharmacyPhone?: string         // optional; default filled in
  pharmacyName?: string
}

// HIPAA note: this email intentionally does NOT contain account number,
// amount due, drug names, or any other PHI. Only the customer's first
// name (which they themselves gave us) and that "a statement is ready".

export function renderStatementEmail(p: StatementEmailParams) {
  const pharmacyName = p.pharmacyName || "North Falmouth Pharmacy"
  const phone = p.pharmacyPhone || "(508) 564-4459"
  const friendly = (p.firstName || "").trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")

  const subject = `Your ${p.billingPeriodLabel} statement from ${pharmacyName} is ready`

  const text = [
    `Hi ${friendly},`,
    ``,
    `Your ${p.billingPeriodLabel} statement from ${pharmacyName} is ready to view.`,
    ``,
    `View your statement: ${p.statementsUrl}`,
    ``,
    `When you click the link above, you'll be asked for your first name, last name, and account number (the same information shown on your past statements).`,
    ``,
    `Questions? Call us at ${phone} — we're happy to help.`,
    ``,
    `— ${pharmacyName}`,
    ``,
    `---`,
    `You received this because you are subscribed to monthly statement notifications.`,
    `To unsubscribe: ${p.unsubscribeUrl}`,
  ].join("\n")

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F7F5EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5EF;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">

            <!-- Brand bar -->
            <tr>
              <td style="background:linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%);padding:24px 28px;color:#ffffff;">
                <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">${escapeHtml(pharmacyName)}</div>
                <div style="font-size:12px;opacity:0.9;margin-top:2px;">Long Term Care Pharmacy</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 28px 24px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(friendly) || "there"},</p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.55;">
                  Your <strong>${escapeHtml(p.billingPeriodLabel)}</strong> statement from ${escapeHtml(pharmacyName)} is ready to view.
                </p>

                <!-- CTA button -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                  <tr>
                    <td style="border-radius:8px;background:#0B7C79;">
                      <a href="${escapeAttr(p.statementsUrl)}"
                         style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        View Your Statement &nbsp;&rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#4b5563;">
                  When you click the button, you'll be asked for your first name, last name, and account number
                  (the same information shown on your past statements).
                </p>

                <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:14px;line-height:1.55;color:#4b5563;">
                  <p style="margin:0 0 6px;">Questions? Call <strong style="color:#0B7C79;">${escapeHtml(phone)}</strong> — we're happy to help.</p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:16px 28px;font-size:12px;line-height:1.5;color:#6b7280;">
                <div style="margin-bottom:8px;"><strong style="color:#374151;">${escapeHtml(pharmacyName)}</strong></div>
                <div>You received this because you are subscribed to monthly statement notifications.</div>
                <div style="margin-top:4px;">
                  <a href="${escapeAttr(p.unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top:12px;font-size:11px;color:#9ca3af;">
            This email contains no prescription, diagnosis, or payment information.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  // URLs — allow characters that are safe in href values but strip anything weird
  return String(s || "").replace(/"/g, "%22").replace(/'/g, "%27").replace(/</g, "%3C").replace(/>/g, "%3E")
}

// Format a YYYY-MM billing period string like "2026-03" into "March 2026"
export function formatBillingPeriodLabel(period: string): string {
  if (!period) return ""
  const [y, m] = period.split("-")
  if (!y || !m) return period
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" })
}

// Build an unsubscribe token (HMAC-signed account#) so users can one-click
// unsubscribe without logging in. The token is included in the URL.
import crypto from "node:crypto"

export function signUnsubscribeToken(accountNumber: string, secret: string): string {
  const h = crypto.createHmac("sha256", secret).update(accountNumber).digest("hex").slice(0, 32)
  return `${Buffer.from(accountNumber).toString("base64url")}.${h}`
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  try {
    const [b64, sig] = token.split(".")
    if (!b64 || !sig) return null
    const acct = Buffer.from(b64, "base64url").toString("utf8")
    const expected = crypto.createHmac("sha256", secret).update(acct).digest("hex").slice(0, 32)
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    return acct
  } catch {
    return null
  }
}
