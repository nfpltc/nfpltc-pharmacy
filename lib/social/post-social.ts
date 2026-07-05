/**
 * Unified social posting for North Falmouth Pharmacy.
 *
 * Ported from WealthClaude's lib/social/post-social.ts, trimmed to the one
 * provider the pharmacy uses today: a Make.com (or Zapier/Buffer) webhook.
 *
 * Delivery is driven by a single env var:
 *   SOCIAL_WEBHOOK_URL   (preferred)   — your Make.com "Custom webhook" URL
 *   MAKE_WEBHOOK_URL     (fallback)    — same thing, WealthClaude's name
 *
 * The webhook receives a JSON body and a Make scenario fans it out to the
 * chosen platforms (Instagram / Facebook / LinkedIn), just like WealthClaude.
 *
 * If NO webhook is configured, postSocial() reports provider 'draft' and
 * ok:false — the caller then stores the post as a draft instead of losing it.
 * Adding Buffer later means adding a postViaBuffer() branch here; nothing in
 * the UI or the API route has to change.
 */

export interface SocialPayload {
  text: string                 // the caption
  image_url?: string
  platforms?: string[]         // ['facebook','instagram','linkedin']
  content_type?: string        // 'image' | 'text'
  source?: string
  timestamp?: string
  [k: string]: any
}

function webhookUrl(): string | null {
  return process.env.SOCIAL_WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || null
}

export function socialConfigured(): boolean {
  return !!webhookUrl()
}

async function postViaMake(p: SocialPayload): Promise<boolean> {
  const url = webhookUrl()
  if (!url) return false
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Post to social. Returns which provider actually delivered it so the API
 * route can log it. Drop-in analog of WealthClaude's postSocial().
 */
export async function postSocial(
  p: SocialPayload,
): Promise<{ ok: boolean; provider: string }> {
  if (!socialConfigured()) {
    // Nothing wired up yet — tell the caller to keep it as a draft.
    return { ok: false, provider: "draft" }
  }
  const ok = await postViaMake(p)
  return { ok, provider: "make" }
}
