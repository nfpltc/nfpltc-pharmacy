// components/team-section.tsx
//
// Server component — was a hardcoded client array before the admin Team
// Members page existed (see app/admin/(protected)/team). Now it reads the
// same team_members table the admin page writes to, so adding someone in
// the admin panel is the only step needed to get them on this page.
//
// Replaced the earlier one-at-a-time "spotlight" carousel with a grid of
// circular photos for everyone at once — the overview only shows name +
// role per the request that drove this; the photo, hover-to-enlarge, and
// full bio all live one click away on /team/<slug> (see PHARMD,MS casing
// fix and the show_bio_page toggle in lib/team-members.ts). No client
// component needed here: the enlarge-on-hover is plain CSS, not state.

import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TeamMember } from "@/lib/team-members"

// Revalidation is configured on app/about/page.tsx (the actual route
// segment), not here — a `revalidate` export in a plain component like this
// one is silently ignored by Next.js. (Learned that one the hard way — see
// that file's comment.)

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

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

function TeamPhoto({ m }: { m: TeamMember }) {
  return (
    <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-md transition-transform duration-300 ease-out group-hover:scale-110 sm:h-36 sm:w-36">
      {m.photo_url ? (
        <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-3xl font-semibold text-emerald-700">
          {initials(m.name)}
        </div>
      )}
    </div>
  )
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
          Meet the pharmacists and operations team behind your care. Tap anyone to read their full bio.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-8 md:grid-cols-4">
          {team.map((m) =>
            m.show_bio_page ? (
              <Link key={m.id} href={`/team/${m.slug}`} className="group flex flex-col items-center text-center">
                <TeamPhoto m={m} />
                <h3 className="mt-4 text-sm font-semibold text-emerald-900 group-hover:text-emerald-700 sm:text-base">
                  {m.name}
                </h3>
                <p className="text-xs text-emerald-700/70 sm:text-sm">{m.role}</p>
              </Link>
            ) : (
              // No bio page for this person — same look, just not a link.
              <div key={m.id} className="group flex flex-col items-center text-center">
                <TeamPhoto m={m} />
                <h3 className="mt-4 text-sm font-semibold text-emerald-900 sm:text-base">{m.name}</h3>
                <p className="text-xs text-emerald-700/70 sm:text-sm">{m.role}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
