// components/team-section.tsx
//
// Server component — was a hardcoded client array before the admin Team
// Members page existed (see app/admin/(protected)/team). Now it reads the
// same team_members table the admin page writes to, so adding someone in
// the admin panel is the only step needed to get them on this page.

import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TeamMember } from "@/lib/team-members"

export const revalidate = 60

async function getVisibleTeam(): Promise<TeamMember[]> {
  const { data } = await supabaseAdmin()
    .from("team_members")
    .select("*")
    .eq("visible", true)
    .order("display_order", { ascending: true })
  return data || []
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export async function TeamSection() {
  const team = await getVisibleTeam()
  if (team.length === 0) return null

  return (
    <section id="team" className="bg-white py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-[360px_1fr]">
        {/* Left intro panel */}
        <div className="rounded-3xl bg-emerald-600 p-8 text-white md:sticky md:top-24 md:self-start">
          <h2 className="text-3xl font-extrabold tracking-tight">Our Team</h2>
          <p className="mt-4 text-white/90">
            Meet the people behind your care. Our pharmacists and operations
            team coordinate closely with families and facilities to keep
            medication management safe and simple.
          </p>
        </div>

        {/* Right: cards with photo + name + title, linking to each person's bio page */}
        <div className="grid gap-6 sm:grid-cols-2">
          {team.map((m) => (
            <Link
              key={m.id}
              href={`/team/${m.slug}`}
              className="group rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                {m.photo_url ? (
                  <img
                    src={m.photo_url}
                    alt={m.name}
                    className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                    {initials(m.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-emerald-900 group-hover:text-emerald-700">
                    {m.name}
                    {m.credentials ? `, ${m.credentials}` : ""}
                  </h3>
                  <p className="mt-1 text-sm text-emerald-700/80">{m.role}</p>
                </div>
              </div>
              {m.short_bio && (
                <p className="mt-3 text-sm text-gray-500 line-clamp-2">{m.short_bio}</p>
              )}
              <span className="mt-3 inline-block text-sm font-medium text-emerald-600 group-hover:underline">
                Read full bio →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
