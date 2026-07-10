import { createClient } from "@supabase/supabase-js"

// Non-fatal insert into email_log. Never throws — logging must not break a send.
export async function logEmail(entry: {
  to?: string | null
  subject?: string
  category?: string
  status?: string
  resendId?: string | null
  error?: string | null
  meta?: any
  sentBy?: string | null
}): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    await sb.from("email_log").insert({
      to_email: entry.to || null,
      subject: entry.subject || null,
      category: entry.category || "other",
      status: entry.status || "sent",
      resend_id: entry.resendId || null,
      error: entry.error ? String(entry.error).slice(0, 500) : null,
      meta: entry.meta || null,
      sent_by: entry.sentBy || null,
    })
  } catch {
    /* email_log table may not be migrated yet — non-fatal */
  }
}
