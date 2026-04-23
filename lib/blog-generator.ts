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
1. A 2-3 sentence opening that starts with a specific moment or story, NOT a definition. Do NOT label it "Introduction." Do NOT use an H1 or H2 heading before it. Just start with prose.
2. Three or four ## H2 sections with concrete, useful content. Use numbered or bulleted lists where it helps. Do NOT label any section "Introduction" or "Conclusion" or "Overview" or "Next Steps."
3. One bulleted list somewhere (3-5 bullets, each bullet one short sentence).
4. A short closing paragraph (2-3 sentences) inviting readers to call (508) 564-4459 or stop by. Keep it warm, not salesy. Do NOT precede it with a "Conclusion" heading — just let the final paragraph flow.
5. MANDATORY final line in italics (use Markdown \\*text\\* syntax), on its OWN line separated from the closing paragraph by a blank line, EXACTLY this format:
   *This post is for general information only, not medical advice. For questions about your medications, call us at (508) 564-4459 or stop by the pharmacy.*

MARKDOWN RULES:
- NEVER use # (H1) headings. Only ## (H2) for section breaks.
- Each heading and paragraph MUST have a blank line before and after it.
- Never run text together without line breaks.
- Section headings are short (2-5 words), specific, and never generic labels like "Introduction" / "Overview" / "Conclusion" / "Next Steps" / "Final Thoughts."

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
  "key_points": [
    "3 to 4 short, punchy bullets (each 8-18 words)",
    "Each bullet is a specific takeaway — NOT a topic heading",
    "Written as statements, not questions",
    "These appear in a 'Key Points' box at the top of the article"
  ],
  "content": "full post body in Markdown, 500-700 words, following every rule in the system prompt. Do NOT repeat the key points verbatim in the body."
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
  key_points: string[]
  thumbnail_url: string | null
  main_image_url: string | null
  image_credit: string | null
  tags: string[]
}

// ─── Main entry: generate one post for a given topic ──────────────────────
export async function generatePost(topic: BlogTopic): Promise<GeneratedPost> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw new Error("GROQ_API_KEY is not set")

  // Try up to 3 times. First attempt uses the base prompt. Subsequent attempts
  // get explicit feedback about what failed the quality check.
  let lastError: string | null = null
  let parsed: any = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(topic) },
    ]
    if (attempt > 1 && lastError) {
      messages.push({
        role: "user",
        content: `Your last attempt was rejected because: "${lastError}". Please write a completely new post that avoids that problem. Do NOT use an H1 heading. Do NOT use "Introduction" or "Conclusion" as section labels. Open with a specific story or observation, not a definition. Include the mandatory italic disclaimer on its own line as the absolute final line.`,
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
        temperature: 0.7 + (attempt - 1) * 0.1,  // 0.7 → 0.8 → 0.9 on retries
        max_tokens: 2500,
        // Note: intentionally NOT using response_format: { type: "json_object" }.
        // Groq's strict JSON mode rejects responses with markdown code fences,
        // which Llama sometimes adds even when told not to. We parse manually
        // below, stripping any ```json fences Llama might include.
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "")
      throw new Error(`Groq API ${resp.status}: ${txt.slice(0, 300)}`)
    }
    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) { lastError = "Groq returned empty content"; continue }

    try {
      parsed = parseJsonFromLlm(raw)
    } catch (e: any) {
      lastError = `Groq returned non-JSON content: ${e.message || "parse failed"}`
      continue
    }

    const { title, content } = parsed
    if (!title || !content) { lastError = "Generated post missing title or content"; continue }

    // key_points must be an array of at least 3 items
    if (!Array.isArray(parsed.key_points) || parsed.key_points.length < 3) {
      lastError = "missing or too-few key_points (need at least 3)"
      continue
    }

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
    throw new Error(`Generation failed after 3 attempts: ${lastError}`)
  }

  const { title, meta_title, description, excerpt, content, key_points } = parsed

  // Fetch an image from Unsplash (best-effort; post still works without one)
  const img = await fetchUnsplashImage(topic.image_query).catch(() => null)

  // Build slug
  const slug = slugify(title) || `post-${Date.now()}`

  // Normalize key_points — ensure it's an array of 3-5 short strings
  let keyPoints: string[] = []
  if (Array.isArray(key_points)) {
    keyPoints = key_points
      .map(k => String(k || "").trim())
      .filter(k => k.length > 5 && k.length < 200)
      .slice(0, 5)
  }

  return {
    topic_id: topic.id,
    title: String(title).trim(),
    meta_title: String(meta_title || title).trim().slice(0, 60),
    description: String(description || excerpt || "").trim().slice(0, 160),
    excerpt: String(excerpt || description || "").trim().slice(0, 240),
    slug,
    content: String(content).trim(),
    key_points: keyPoints,
    thumbnail_url: img?.thumbUrl || null,
    main_image_url: img?.fullUrl || null,
    image_credit: img?.credit || null,
    tags: topic.tags,
  }
}

// ─── Unsplash image fetch ──────────────────────────────────────────────────
async function fetchUnsplashImage(query: string): Promise<{ thumbUrl: string; fullUrl: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) {
    console.warn("[blog-generator] UNSPLASH_ACCESS_KEY not set — skipping image fetch")
    return null
  }

  // Try the specific query first, then fall back to broader terms if it returns nothing
  const queries = [query, "pharmacy", "pharmacist"]
  for (const q of queries) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=10&orientation=landscape&content_filter=high`
      const r = await fetch(url, { headers: { "Authorization": `Client-ID ${key}` } })
      if (!r.ok) {
        console.warn(`[blog-generator] Unsplash ${r.status} for query "${q}":`, await r.text().catch(() => ""))
        continue
      }
      const d = await r.json()
      if (!d?.results?.length) {
        console.warn(`[blog-generator] Unsplash returned 0 results for query "${q}"`)
        continue
      }
      const pick = d.results[Math.floor(Math.random() * Math.min(d.results.length, 5))]
      const credit = `Photo by ${pick.user?.name || "Unsplash"} on Unsplash`
      return {
        thumbUrl: pick.urls?.small || pick.urls?.regular,
        fullUrl:  pick.urls?.regular || pick.urls?.full,
        credit,
      }
    } catch (e) {
      console.warn(`[blog-generator] Unsplash fetch threw for "${q}":`, e)
    }
  }
  return null
}

// ─── Utilities ────────────────────────────────────────────────────────────
// Parses JSON that may be wrapped in markdown fences or preceded/followed by
// stray text. Llama-3.3 on Groq often adds ```json ... ``` fences despite
// instructions not to, which would break strict JSON.parse.
function parseJsonFromLlm(raw: string): any {
  let s = String(raw).trim()

  // Strip leading/trailing markdown fences like ```json ... ```
  s = s.replace(/^```(?:json|javascript|js)?\s*\n?/i, "")
  s = s.replace(/\n?```\s*$/i, "")

  // If there's still junk around the JSON object, grab the outermost { ... }
  const firstBrace = s.indexOf("{")
  const lastBrace  = s.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1)
  }

  return JSON.parse(s)
}

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

  // ─── Quality: no H1 headings allowed, only H2 ─────────────────────────
  // Lines starting with a single # followed by space
  if (/^# [^\n]/m.test(content)) {
    return "contains H1 heading (only H2 allowed)"
  }

  // ─── Quality: no generic section labels like "Introduction" / "Conclusion" ─
  const genericHeadings = [
    /^#+\s*introduction\b/im,
    /^#+\s*overview\b/im,
    /^#+\s*conclusion\b/im,
    /^#+\s*next steps\b/im,
    /^#+\s*final thoughts\b/im,
    /^#+\s*summary\b/im,
    /^#+\s*in conclusion\b/im,
  ]
  for (const re of genericHeadings) {
    if (re.test(content)) return `contains generic section heading: ${re.source}`
  }

  // ─── Quality: post must NOT open with a dictionary-style definition ─────
  // (first 120 chars of actual content)
  const opening = content.replace(/^#+[^\n]*\n+/, "").trim().slice(0, 150).toLowerCase()
  const definitionOpeners = [
    /^(medication|prescription|pharmacy|refill|vaccine|immunization|storage|proper|healthy?)\s+\w+\s+(is|are)\s+(a|an|the|crucial|important|essential|critical)/,
    /^(as a resident of|as a patient|as a caregiver)/,
    /^(when it comes to)/,
  ]
  for (const re of definitionOpeners) {
    if (re.test(opening)) return `post opens with a textbook definition, not a specific story or moment`
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
