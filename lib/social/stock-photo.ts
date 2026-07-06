/**
 * Stock photography for social posts — Pexels (free, professional photos).
 *
 * Templates overlay branded text + the NFPLTC logo on top of a matching photo,
 * which is what gives posts a premium, marketing-ready feel (vs. flat CSS).
 *
 * Env: PEXELS_API_KEY (free at https://www.pexels.com/api/).
 */

export function stockConfigured(): boolean {
  return !!process.env.PEXELS_API_KEY
}

/**
 * Find a matching photo for a query. Returns a large, correctly-oriented image
 * URL plus attribution (Pexels asks that the photographer be credited).
 */
export async function fetchStockPhoto(
  query: string,
  opts: { orientation?: "portrait" | "landscape" | "square" } = {},
): Promise<{ url: string; credit: string } | { error: string }> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return { error: "PEXELS_API_KEY not configured (stock photos)." }

  const q = (query || "health wellness").trim()
  const orientation = opts.orientation || "portrait"
  const endpoint =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}` +
    `&orientation=${orientation}&size=large&per_page=15`

  try {
    const r = await fetch(endpoint, { headers: { Authorization: key } })
    if (!r.ok) return { error: `Pexels error ${r.status}` }
    const data = await r.json()
    const photos: any[] = Array.isArray(data.photos) ? data.photos : []
    if (!photos.length) return { error: `No stock photo found for "${q}".` }

    // Pick from the top matches for variety instead of always the first.
    const pool = photos.slice(0, 8)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const src = pick?.src?.large2x || pick?.src?.large || pick?.src?.original
    if (!src) return { error: "Pexels returned no usable image." }
    return { url: src, credit: pick?.photographer || "Pexels" }
  } catch (e: any) {
    return { error: e.message || "Stock photo lookup failed" }
  }
}
