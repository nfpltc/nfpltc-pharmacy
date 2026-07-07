/**
 * Server-side HTML -> PNG renderer for pharmacy social images.
 *
 * Ported from WealthClaude's lib/social/render-image.ts. Uses
 * htmlcsstoimage.com (hcti.io) — a real headless Chrome — so our rich CSS
 * templates render faithfully with no local browser. Returns a public PNG URL.
 *
 * Env: HCTI_USER_ID + HCTI_API_KEY (free tier ~50 images/mo).
 *
 * The default canvas is 420x525 and we upscale via device_scale to a crisp
 * 1080x1350 portrait — the standard Instagram/Facebook post size.
 */

export function hctiConfigured(): boolean {
  return !!(process.env.HCTI_USER_ID && process.env.HCTI_API_KEY)
}

export async function renderHtmlToImage(
  html: string,
  opts: { width?: number; height?: number; scale?: number } = {},
): Promise<{ url: string | null; error?: string }> {
  const user = process.env.HCTI_USER_ID
  const key = process.env.HCTI_API_KEY
  if (!user || !key) {
    return { url: null, error: "HCTI_USER_ID / HCTI_API_KEY not configured (HTML image renderer)." }
  }

  const width = opts.width ?? 420
  const height = opts.height ?? 525
  const scale = opts.scale ?? 1080 / width // -> 1080px wide output

  // Crisp-font shell around the template markup.
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Anton&family=Archivo+Black&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}</style>
</head><body style="width:${width}px;height:${height}px;overflow:hidden;">${html}</body></html>`

  try {
    const r = await fetch("https://hcti.io/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${user}:${key}`).toString("base64"),
      },
      body: new URLSearchParams({
        html: fullHtml,
        viewport_width: String(width),
        viewport_height: String(height),
        device_scale: String(scale),
      }),
    })
    if (!r.ok) return { url: null, error: `Renderer ${r.status}: ${(await r.text()).slice(0, 160)}` }
    const d = await r.json()
    return { url: d.url || null }
  } catch (e) {
    return { url: null, error: (e as Error).message }
  }
}
