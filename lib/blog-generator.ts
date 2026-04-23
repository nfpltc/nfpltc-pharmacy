// Blog generator: calls Groq (Llama 3.3 70B) to write a post,
// then Unsplash to fetch a matching image. Returns a structured
// payload ready to insert into the `blogs` Supabase table.

import { BLOG_TOPICS, BlogTopic } from "./blog-topics"

// ─── Groq client (REST, no SDK dependency) ─────────────────────────────────
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"   // Groq's best general-purpose model on free tier

// ─── Safety rules baked into every system prompt ──────────────────────────
const SYSTEM_PROMPT = `You are writing a blog post for North Falmouth Pharmacy ("NFPLTC"), a long-term care pharmacy on Cape Cod, Massachusetts. Our readers are patients, their adult children, caregivers, and facility staff.

YOUR VOICE:
You are a real pharmacist who has been at the counter for 20 years. You write like a neighbor, not a textbook. You use "I" and "we" and "you." You tell specific stories ("Last week a patient asked me..."). You name specific situations (a dad in Falmouth who just came home from Cape Cod Hospital, a daughter trying to help her mom in Mashpee). You never sound corporate, never lecture, never repeat the same point three different ways.

BANNED SENTENCE PATTERNS:
Never write "X is a simple yet effective way to..."
Never write "Taking [medications/anything] can be overwhelming"
Never write "In today's fast-paced world"
Never write "It's no secret that"
Never write "delve into" or "navigate the complexities of"
Never open a post with "Did you know..." or "Have you ever..."
Never repeat the post's topic phrase more than twice in the whole post.
Never start consecutive sentences or paragraphs with the same word.

WRITING RULES:
- Open with a SPECIFIC moment, story, or observation — NOT a definition. Definitions come later.
- Use short paragraphs (2-3 sentences max).
- Use contractions: "you'll", "won't", "here's" — not "you will", "will not", "here is".
- Vary sentence length. Some short. Some a bit longer with a clause. That rhythm matters.
- Include one specific Cape Cod / Falmouth / local reference if it fits naturally.
- Write 500-700 words. Do not pad.

SAFETY RULES (non-negotiable):
1. NEVER give specific medical advice. Don't recommend doses, don't tell readers to start/stop/change medications, don't diagnose.
2. NEVER name specific prescription drugs, dosages, or drug classes by brand name. Generic categories are OK ("blood thinners", "antihistamines").
3. NEVER mention competitor pharmacies (CVS, Walgreens, Rite Aid, Walmart, Stop & Shop) by name.
4. NEVER invent statistics, studies, or quotes.
5. ALWAYS tell readers to consult their pharmacist or doctor for personal questions.

REQUIRED STRUCTURE (exactly this):
1. A 2-3 sentence opening that starts with a specific moment or story, NOT a definition.
2. Three or four ## H2 sections with concrete, useful content. Use numbered or bulleted lists where it helps.
3. One bulleted list somewhere (3-5 bullets, each bullet one short sentence).
4. A short closing paragraph (2-3 sentences) inviting readers to call (508) 564-4459 or stop by. Keep it warm, not salesy.
5. MANDATORY final line in italics (use Markdown \\*text\\* syntax), EXACTLY this format:
   *This post is for general information only, not medical advice. For questions about your medications, call us at (508) 564-4459 or stop by the pharmacy.*

GOOD EXAMPLE OF VOICE (for reference only, don't copy):
"A customer stopped by last Tuesday with two shopping bags full of her mom's prescription bottles. Her mom had just come home from rehab, and she was trying to figure out what to give and when. I get that call at least twice a week. So let's talk about what actually helps in that first week home."

That's the voice. Specific. Warm. Pharmacist-who-actually-talks-to-people. Not a chatbot explaining things to a child.`

// Prompt for the actual post (second pass uses this)
function buildUserPrompt(topic: BlogTopic): string {
  return `Write the blog post.

Topic: ${topic.title_seed}
Angle: ${topic.angle}
Category: ${topic.category}
Tags: ${topic.tags.join(", ")}

Remember: open with a specific moment or story (NOT a definition). Use contractions. Short paragraphs. No repetitive sentence openings. Include the mandatory italic disclaimer as the absolute final line.

Return ONLY valid JSON (no markdown fences, no commentary). Exact keys:
{
  "title": "compelling title, max 60 chars, no clickbait, no colon-subtitle format",
  "meta_title": "SEO title ending with '| North Falmouth Pharmacy', max 60 chars",
  "description": "meta description for Google, 140-160 chars, no trailing period",
  "excerpt": "preview text for the blog card, 180-240 chars, hook the reader",
  "content": "full post body in Markdown, 500-700 words, following every rule in the system prompt"
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

  // Try up to 2 times. First attempt uses the base prompt. If it fails the
  // quality check, retry once with explicit feedback about what was wrong.
  let lastError: string | null = null
  let parsed: any = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(topic) },
    ]
    if (attempt === 2 && lastError) {
      messages.push({
        role: "user",
        content: `Your last attempt was rejected because: "${lastError}". Please write a completely new post that avoids that problem. Pay special attention to the banned phrases and the required final italic disclaimer.`,
      })
    }

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: attempt === 1 ? 0.7 : 0.85,  // bump variety on retry
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
    if (!raw) { lastError = "Groq returned empty content"; continue }

    try { parsed = JSON.parse(raw) }
    catch { lastError = "Groq returned non-JSON content"; continue }

    const { title, content } = parsed
    if (!title || !content) { lastError = "Generated post missing title or content"; continue }

    const unsafe = scanForUnsafeContent(content)
    if (unsafe) {
      lastError = unsafe
      continue  // try again
    }

    // Passed all checks
    lastError = null
    break
  }

  if (lastError) {
    throw new Error(`Generation failed after 2 attempts: ${lastError}`)
  }

  const { title, meta_title, description, excerpt, content } = parsed

  // Fetch an image from Unsplash (best-effort; post still works without one)
  const img = await fetchUnsplashImage(topic.image_query).catch(() => null)

  // Build slug
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

// Lightweight content quality + safety scan. Returns a reason string if the
// post should be rejected, or null if it's acceptable.
function scanForUnsafeContent(content: string): string | null {
  const lower = content.toLowerCase()

  // ─── Safety: specific dosage instructions ───────────────────────────────
  if (/take\s+\d+\s*(mg|mcg|milligram|microgram|pills?|tablets?|capsules?)/i.test(content)) {
    return "contains specific dosage instructions"
  }

  // ─── Safety: specific brand-name drugs ──────────────────────────────────
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

  // ─── Safety: competitor pharmacies ──────────────────────────────────────
  const competitors = ["cvs","walgreens","rite aid","walmart pharmacy","stop & shop pharmacy","stop and shop pharmacy"]
  for (const c of competitors) {
    if (lower.includes(c)) return `mentions competitor: ${c}`
  }

  // ─── Quality: banned clichés that signal low-effort AI writing ──────────
  const bannedPhrases = [
    /simple yet effective/i,
    /in today'?s fast[- ]paced world/i,
    /it'?s no secret that/i,
    /\bdelve into\b/i,
    /navigate the complexit/i,
    /unlock the secrets?/i,
    /\b(harness|leverage|utilize|streamline) the power of\b/i,
    /a game[- ]chang(er|ing)/i,
    /in conclusion,/i,
    /embark on a journey/i,
    /ever[- ]evolving (world|landscape)/i,
    /can be overwhelming/i,
  ]
  for (const re of bannedPhrases) {
    if (re.test(content)) return `contains banned phrase: ${re.source}`
  }

  // ─── Quality: required final disclaimer must be present ────────────────
  const disclaimerRe = /\*this post is for general information only[^*]*508[^*]*\*/is
  if (!disclaimerRe.test(content)) {
    return "missing required final italic disclaimer"
  }

  // ─── Quality: must mention the phone number somewhere ──────────────────
  if (!content.includes("564-4459")) {
    return "missing pharmacy phone number"
  }

  // ─── Quality: reject extreme repetition (same word starting multiple
  //     consecutive sentences, or title topic repeated too many times) ────
  const openings = (content.match(/(?:^|\n\n|\. )([A-Z]\w+)/g) || [])
    .map(s => s.trim().replace(/^[. ]+/, "").split(/\s+/)[0].toLowerCase())
  const runs: Record<string, number> = {}
  let prev = ""
  let currentRun = 0, maxRun = 0, maxRunWord = ""
  for (const w of openings) {
    if (w === prev) { currentRun++; if (currentRun > maxRun) { maxRun = currentRun; maxRunWord = w } }
    else { currentRun = 1; prev = w }
  }
  if (maxRun >= 3) return `${maxRun} paragraphs in a row start with "${maxRunWord}"`

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
