// lib/team-members.ts
//
// Shared type + small helpers for the Team Members feature, used by the
// admin page, the API route, the public "Our Team" section, and the
// per-person /team/[slug] bio page — kept in one place so all four stay
// in sync the way the vaccine form/PDF drift did before extractScreeningAnswers().

export type TeamMember = {
  id: string
  created_at: string
  updated_at: string
  name: string
  credentials: string | null
  role: string
  slug: string
  photo_url: string | null
  short_bio: string | null
  long_bio: string | null
  expertise: string[]
  tagline: string | null
  display_order: number
  visible: boolean
}

/** name → URL-safe slug, same rules as the blog's slugify(). */
export function slugifyName(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** long_bio (blank-line-separated) → paragraph array, for rendering. */
export function bioParagraphs(longBio: string | null): string[] {
  if (!longBio) return []
  return longBio
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}
