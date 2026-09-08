// app/team/[slug]/page.tsx
//
// One person's full bio page — the destination for "Read full bio" on the
// About page's Our Team cards. Mirrors app/blog/[slug]/page.tsx's structure
// (hero + content + a related strip) since that's the existing convention
// for single-item public pages in this app; no SiteHeader/Footer import here
// because the root layout already renders those globally (see app/layout.tsx).

import { notFound } from "next/navigation"
import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { bioParagraphs, type TeamMember } from "@/lib/team-members"

export const revalidate = 60

async function getMember(slug: string): Promise<TeamMember | null> {
  const { data } = await supabaseAdmin()
    .from("team_members")
    .select("*")
    .eq("slug", slug)
    .eq("visible", true)
    .maybeSingle()
  return data
}

async function getOtherMembers(excludeId: string): Promise<TeamMember[]> {
  const { data } = await supabaseAdmin()
    .from("team_members")
    .select("*")
    .eq("visible", true)
    .neq("id", excludeId)
    .order("display_order", { ascending: true })
    .limit(3)
  return data || []
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const member = await getMember(slug)
  if (!member) return { title: "Team Member Not Found" }
  return {
    title: `${member.name} | North Falmouth Pharmacy`,
    description: member.short_bio || `${member.name}, ${member.role} at North Falmouth Pharmacy.`,
  }
}

export default async function TeamMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const member = await getMember(slug)
  if (!member) notFound()

  const others = await getOtherMembers(member.id)
  const paragraphs = bioParagraphs(member.long_bio)

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section
        className="relative isolate overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}
      >
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
          <Link href="/about#team" className="mb-6 inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to our team
          </Link>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.name} className="h-28 w-28 flex-shrink-0 rounded-full border-4 border-white/30 object-cover" />
            ) : (
              <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full border-4 border-white/30 bg-white/10 text-3xl font-semibold text-white">
                {initials(member.name)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/70">
                {member.role}{member.credentials ? ` · ${member.credentials}` : ""}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white md:text-4xl lg:text-5xl">{member.name}</h1>
              {member.short_bio && <p className="mt-3 max-w-xl text-white/90">{member.short_bio}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Bio + expertise */}
      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_260px]">
          <div>
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} className="mb-4 leading-relaxed text-gray-700">{p}</p>
              ))
            ) : (
              <p className="leading-relaxed text-gray-500">More about {member.name.split(" ")[0]} is coming soon.</p>
            )}
          </div>

          <aside className="space-y-6">
            {member.expertise && member.expertise.length > 0 && (
              <div className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-800">Areas of expertise</h2>
                <ul className="space-y-2">
                  {member.expertise.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {member.tagline && (
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-700/80">
                {member.tagline}
              </p>
            )}
          </aside>
        </div>
      </section>

      {/* Rest of the team */}
      {others.length > 0 && (
        <section className="border-t border-black/5 bg-white py-12 md:py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">Meet the rest of the team</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {others.map((o) => (
                <Link key={o.id} href={`/team/${o.slug}`} className="group rounded-xl border border-black/5 p-4 text-center transition hover:shadow-md">
                  {o.photo_url ? (
                    <img src={o.photo_url} alt={o.name} className="mx-auto h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                      {initials(o.name)}
                    </div>
                  )}
                  <h3 className="mt-3 text-sm font-semibold text-emerald-900 group-hover:text-emerald-700">{o.name}</h3>
                  <p className="text-xs text-emerald-700/70">{o.role}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
