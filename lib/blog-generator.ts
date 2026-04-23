// Blog generator: calls Groq (Llama 3.3 70B) to write a post,
// then Unsplash to fetch a matching image. Returns a structured
// payload ready to insert into the `blogs` Supabase table.

import { BLOG_TOPICS, BlogTopic } from "./blog-topics"

// ─── Groq client (REST, no SDK dependency) ─────────────────────────────────
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"   // Groq's best general-purpose model on free tier

// ─── Safety rules baked into every system prompt ──────────────────────────
const SYSTEM_PROMPT = `You are a writer for North Falmouth Pharmacy ("NFPLTC"), a long-term care pharmacy on Cape Cod, Massachusetts. You write warm, practical, education-focused blog posts for patients, caregivers, and facility staff.

RULES (non-negotiable):
1. NEVER give specific medical advice. Do not recommend doses, tell readers to start/stop/change medications, or diagnose conditions.
2. NEVER name specific prescription drugs, dosages, or drug classes by their brand names. Generic categories are OK ("antihistamines", "blood-pressure medications"). Specific names like "Lipitor 20mg" are NOT OK.
3. NEVER mention competitor pharmacies (CVS, Walgreens, Rite Aid, Walmart pharmacy, Stop & Shop pharmacy, etc.) by name.
4. NEVER invent statistics, studies, or quotes. If you don't know a specific number, don't make one up.
5. NEVER claim "research shows" or "studies prove" without a source — just speak from a pharmacist's practical experience.
6. ALWAYS remind readers to consult their pharmacist or doctor for personal medical questions.
7. ALWAYS end with a soft call-to-action inviting readers to contact North Falmouth Pharmacy at (508) 564-4459.
8. Use a warm, local, conversational tone — NOT corporate. Write like a neighbor who happens to be a pharmacist.

FORMAT:
- 500 to 700 words of body content
- Write in Markdown
- Use a short intro (2-3 sentences), 3-4 H2 sections, and a short closing
- Include 1 bulleted list somewhere (3-5 bullets)
- End with a one-paragraph disclaimer in italics: "*This post is for general information only and is not medical advice. For personal questions about your medications, talk to your pharmacist or call us at (508) 564-4459.*"

AVOID these tired content-mill phrases:
- "In today's fast-paced world..."
- "It's no secret that..."
- "delve into"
- "navigate the complexities of"
- "unlock the secrets"

You are writing for real people on Cape Cod. Be direct and useful.`

// Prompt for the actual post (second pass uses this)
function buildUserPrompt(topic: BlogTopic): string {
  return `Write a blog post on this topic:

Title seed: "${topic.title_seed}"
Angle/focus: ${topic.angle}
Category: ${topic.category}
Tags: ${topic.tags.join(", ")}

Return ONLY valid JSON with this exact structure (no markdown fences, no commentary before or after):
{
  "title": "final clickable title (60 characters or fewer, no clickbait)",
  "meta_title": "SEO title with 'North Falmouth Pharmacy' appended (max 60 chars)",
  "description": "1-2 sentence meta description for search results (max 160 chars, no period needed at end)",
  "excerpt": "a 2-3 sentence summary for the blog preview card (about 200 chars)",
  "content": "the full post body in Markdown, 500-700 words, following the formatting rules"
}`
}

// ─── Public type returned to the cron endpoint ────────────────────────────
export interface GeneratedPost {
  topic_id: string
  title: string
  meta_title: string
  description: string
  excerpt: string
  slug: string
  content: string
  thumbnail_url: string | null
  main_image_url: string | null
  image_credit: string | null
  tags: string[]
}

// ─── Main entry: generate one post for a given topic ──────────────────────
export async function generatePost(topic: BlogTopic): Promise<GeneratedPost> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw new Error("GROQ_API_KEY is not set")

  // 1) Call Groq to write the post as JSON
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserPrompt(topic) },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "")
    throw new Error(`Groq API ${resp.status}: ${txt.slice(0, 300)}`)
  }
  const data = await resp.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) throw new Error("Groq returned no content")

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Groq returned non-JSON content: " + String(raw).slice(0, 200))
  }

  const { title, meta_title, description, excerpt, content } = parsed
  if (!title || !content) throw new Error("Generated post missing title or content")

  // 2) Safety scan — reject if obvious PHI/advice leaked through
  const unsafe = scanForUnsafeContent(content)
  if (unsafe) throw new Error(`Safety check failed: ${unsafe}`)

  // 3) Fetch an image from Unsplash (best-effort; post still works without one)
  const img = await fetchUnsplashImage(topic.image_query).catch(() => null)

  // 4) Build slug
  const slug = slugify(title) || `post-${Date.now()}`

  return {
    topic_id: topic.id,
    title: String(title).trim(),
    meta_title: String(meta_title || title).trim().slice(0, 60),
    description: String(description || excerpt || "").trim().slice(0, 160),
    excerpt: String(excerpt || description || "").trim().slice(0, 240),
    slug,
    content: String(content).trim(),
    thumbnail_url: img?.thumbUrl || null,
    main_image_url: img?.fullUrl || null,
    image_credit: img?.credit || null,
    tags: topic.tags,
  }
}

// ─── Unsplash image fetch ──────────────────────────────────────────────────
async function fetchUnsplashImage(query: string): Promise<{ thumbUrl: string; fullUrl: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&content_filter=high`
  const r = await fetch(url, { headers: { "Authorization": `Client-ID ${key}` } })
  if (!r.ok) return null
  const d = await r.json()
  const pick = d?.results?.[Math.floor(Math.random() * Math.min(d.results.length, 5))]
  if (!pick) return null
  // Unsplash attribution: required by their API terms
  const credit = `Photo by ${pick.user?.name || "Unsplash"} on Unsplash`
  return {
    thumbUrl: pick.urls?.small || pick.urls?.regular,
    fullUrl:  pick.urls?.regular || pick.urls?.full,
    credit,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

// Very lightweight safety scan — not foolproof, but catches obvious cases.
// Looks for phrases like "you should take X mg" and specific brand drug names.
function scanForUnsafeContent(content: string): string | null {
  const lower = content.toLowerCase()

  // Dosage instructions
  if (/take\s+\d+\s*(mg|mcg|milligram|microgram|pills?|tablets?|capsules?)/i.test(content)) {
    return "contains specific dosage instructions"
  }

  // Specific brand-name drugs we want to avoid
  const blockedBrands = [
    "lipitor","crestor","zocor","plavix","xarelto","eliquis","ozempic","wegovy",
    "mounjaro","jardiance","farxiga","januvia","advair","symbicort","spiriva",
    "humira","enbrel","keytruda","prozac","zoloft","lexapro","wellbutrin",
    "xanax","klonopin","ativan","ambien","vyvanse","adderall","ritalin",
    "oxycontin","percocet","vicodin","suboxone","methadone","warfarin",
  ]
  for (const b of blockedBrands) {
    if (new RegExp(`\\b${b}\\b`, "i").test(content)) return `mentions brand drug: ${b}`
  }

  // Competitor names
  const competitors = ["cvs","walgreens","rite aid","walmart pharmacy","stop & shop pharmacy","stop and shop pharmacy"]
  for (const c of competitors) {
    if (lower.includes(c)) return `mentions competitor: ${c}`
  }

  return null
}

// ─── Pick the next topic to write about ────────────────────────────────────
// Given the most-recently-used topic IDs (from the DB), return the next topic.
export function pickNextTopic(recentlyUsedIds: string[]): BlogTopic {
  const recent = new Set(recentlyUsedIds)
  const unused = BLOG_TOPICS.filter(t => !recent.has(t.id))
  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)]
  }
  // All topics have been used — pick the one used longest ago (earliest in recentlyUsedIds)
  const sorted = [...BLOG_TOPICS].sort((a, b) => {
    const ai = recentlyUsedIds.indexOf(a.id)
    const bi = recentlyUsedIds.indexOf(b.id)
    return bi - ai  // larger index = more recent; we want smallest (oldest)
  })
  return sorted[0]
}
