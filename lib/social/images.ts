/**
 * Image generation for social posts, with provider fallback.
 *   fal.ai Flux Schnell (primary) -> Unsplash (fallback).
 *
 * Env: FAL_KEY (fal.ai), UNSPLASH_ACCESS_KEY (Unsplash).
 */

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || process.env.FAL_AI_API_KEY
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY

export interface ImageResult {
  url: string
  provider: "fal.ai" | "unsplash"
  credit?: string
  creditLink?: string
}

export async function falImage(prompt: string): Promise<ImageResult | { error: string }> {
  if (!FAL_KEY) return { error: "FAL_KEY not configured." }
  try {
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      }),
    })
    if (!r.ok) return { error: `fal.ai ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` }
    const d = await r.json()
    const url = d?.images?.[0]?.url
    return url ? { url, provider: "fal.ai" } : { error: "fal.ai returned no image." }
  } catch (e: any) {
    return { error: e.message || "fal.ai request failed" }
  }
}

export async function unsplashImage(query: string): Promise<ImageResult | { error: string }> {
  if (!UNSPLASH_KEY) return { error: "UNSPLASH_ACCESS_KEY not configured." }
  // A specific phrase like "pharmacy counter" can return zero results, especially
  // with an orientation filter. Try the phrase, then progressively broader terms,
  // and drop the squarish filter after the first attempt.
  const base = (query || "").trim()
  const firstWord = base.split(/\s+/)[0] || ""
  const tries = [...new Set([base, firstWord, "pharmacy", "healthcare", "health"].filter(Boolean))]
  try {
    for (let i = 0; i < tries.length; i++) {
      const orient = i === 0 ? "&orientation=squarish" : ""
      const r = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(tries[i])}&per_page=10${orient}`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } },
      )
      if (!r.ok) {
        if (i === tries.length - 1) return { error: `Unsplash ${r.status}` }
        continue
      }
      const d = await r.json()
      const results: any[] = d?.results || []
      if (!results.length) continue
      const pick = results[Math.floor(Math.random() * Math.min(results.length, 10))]
      const url = pick?.urls?.regular
      if (url) return { url, provider: "unsplash", credit: pick?.user?.name, creditLink: pick?.links?.html }
    }
    return { error: `No Unsplash photo for "${base}" (tried broader terms too).` }
  } catch (e: any) {
    return { error: e.message || "Unsplash request failed" }
  }
}

// provider "auto" tries fal.ai first, falls back to Unsplash on error.
export async function generateImage(opts: {
  prompt?: string
  query?: string
  provider?: "auto" | "fal" | "unsplash"
}): Promise<ImageResult | { error: string }> {
  const provider = opts.provider || "auto"
  const prompt = (opts.prompt || opts.query || "health wellness").trim()
  const query = (opts.query || opts.prompt || "health wellness").trim()

  if (provider === "unsplash") return unsplashImage(query)
  if (provider === "fal") return falImage(prompt)

  const f = await falImage(prompt)
  if ("url" in f) return f
  const u = await unsplashImage(query)
  if ("url" in u) return u
  return { error: `No image provider available. fal.ai: ${(f as any).error}; Unsplash: ${(u as any).error}` }
}
