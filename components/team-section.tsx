// components/team-section.tsx
//
// Server component — was a hardcoded client array before the admin Team
// Members page existed (see app/admin/(protected)/team). Now it reads the
// same team_members table the admin page writes to, so adding someone in
// the admin panel is the only step needed to get them on this page.
//
// Data fetching stays here (server-side, no client bundle cost); the actual
// spotlight-card + prev/next browsing UI is TeamCarousel, a client component,
// since paging state can't live in a server component.

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TeamMember } from "@/lib/team-members"
import TeamCarousel from "@/components/TeamCarousel"

// Revalidation is configured on app/about/page.tsx (the actual route
// segment), not here — a `revalidate` export in a plain component like this
// one is silently ignored by Next.js.

async function getVisibleTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabaseAdmin()
    .from("team_members")
    .select("*")
    .eq("visible", true)
    .order("display_order", { ascending: true })
  // A query error would otherwise look identical to "no team members yet"
  // (the section just quietly disappears) — log it so that's diagnosable.
  if (error) console.error("team-section: failed to load team_members:", error.message)
  return data || []
}

export async function TeamSection() {
  const team = await getVisibleTeam()
  if (team.length === 0) return null

  return (
    <section id="team" className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Who works here</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          The people who care for you.
        </h2>
        <p className="mt-3 max-w-2xl text-gray-500">
          Meet the pharmacists and operations team behind your care.
          {team.length > 1 ? " Tap the arrows or a card to meet everyone." : " Tap the card to read their full bio."}
        </p>

        <div className="mt-10">
          <TeamCarousel members={team} />
        </div>
      </div>
    </section>
  )
}
