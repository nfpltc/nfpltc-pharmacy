"use client"

// components/TeamCarousel.tsx
//
// The interactive half of the Our Team section — a single large "spotlight"
// card for one team member at a time, with prev/next arrows and dot paging
// to browse the rest. Split out from team-section.tsx (a server component)
// because carousel state needs a client component; the data fetch stays
// server-side and the result is just passed in as a prop.

import { useState } from "react"
import Link from "next/link"
import type { TeamMember } from "@/lib/team-members"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

/** "Sneha Krishnakumar" -> ["Sneha", "Krishnakumar"] for the two-tone name treatment. */
function splitName(name: string): [string, string | null] {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return [name, null]
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]]
}

export default function TeamCarousel({ members }: { members: TeamMember[] }) {
  const [index, setIndex] = useState(0)
  if (members.length === 0) return null

  const m = members[index % members.length]
  const [firstName, lastName] = splitName(m.name)
  const canPage = members.length > 1
  const go = (dir: -1 | 1) => setIndex((i) => (i + dir + members.length) % members.length)

  return (
    <div className="relative">
      <div className="grid overflow-hidden rounded-3xl border border-black/5 bg-white shadow-lg md:grid-cols-2">
        {/* Left: intro copy */}
        <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Introducing</span>
          <h3 className="text-3xl font-extrabold leading-tight text-gray-900 md:text-4xl">
            {firstName}
            {lastName && <><br /><span className="text-emerald-600">{lastName}.</span></>}
          </h3>
          <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {m.role}
            {m.credentials && <span className="text-emerald-600"> · {m.credentials}</span>}
          </p>
          {m.short_bio && <p className="text-gray-600">{m.short_bio}</p>}

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-t border-gray-100 pt-4">
            {m.tagline ? (
              <p className="text-xs font-semibold uppercase leading-relaxed tracking-widest text-gray-800">
                {m.tagline}
              </p>
            ) : <span />}
            <Link
              href={`/team/${m.slug}`}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Read full bio →
            </Link>
          </div>
        </div>

        {/* Right: large photo with a caption overlay, same tap target as the button above */}
        <Link href={`/team/${m.slug}`} className="group relative block min-h-[320px] overflow-hidden bg-emerald-50 md:min-h-full">
          {m.photo_url ? (
            <img
              src={m.photo_url}
              alt={m.name}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-emerald-200">
              {initials(m.name)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{m.role}</p>
            <p className="text-sm font-semibold text-white">
              {m.name}{m.credentials && <span className="font-normal text-white/70"> {m.credentials}</span>}
            </p>
          </div>
        </Link>
      </div>

      {canPage && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous team member"
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-50 md:-left-5"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next team member"
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-50 md:-right-5"
          >
            →
          </button>

          <div className="mt-6 flex justify-center gap-2">
            {members.map((mem, i) => (
              <button
                key={mem.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${mem.name}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-emerald-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
