"use client"

// components/TeamCarousel.tsx
//
// The interactive half of the Our Team section — a single large "spotlight"
// card for one team member at a time: auto-advances on a timer, and can be
// paged manually via the prev/next buttons, the dots, a touch swipe, or by
// hovering (which pauses autoplay so a visitor mid-read doesn't get yanked
// to the next person). Split out from team-section.tsx (a server component)
// because all of that needs client state; the data fetch stays server-side
// and the result is just passed in as a prop.

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { TeamMember } from "@/lib/team-members"

const AUTOPLAY_MS = 6000
const SWIPE_THRESHOLD_PX = 50

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
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const didSwipeRef = useRef(false)

  const count = members.length
  const canPage = count > 1
  const go = (dir: -1 | 1) => setIndex((i) => (i + dir + count) % count)

  // Auto-advance, restarting the clock on every change (including manual
  // ones) so a swipe/click doesn't get immediately overridden by a stale
  // timer. Paused on hover so reading a bio doesn't get interrupted.
  useEffect(() => {
    if (!canPage || paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [canPage, paused, index, count])

  if (count === 0) return null

  const m = members[index % count]
  const [firstName, lastName] = splitName(m.name)
  // Only a member with a bio page gets a clickable photo — otherwise it's
  // just a plain div (no href, nothing to spread {href} onto).
  const PhotoTag = m.show_bio_page ? Link : "div"

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    didSwipeRef.current = false
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || !canPage) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      didSwipeRef.current = true
      go(dx < 0 ? 1 : -1)
    }
  }
  // A swipe that crosses the threshold shouldn't also fire the photo/button
  // link underneath it — swallow the one click that follows a real swipe.
  const onClickCapture = (e: React.MouseEvent) => {
    if (didSwipeRef.current) {
      e.preventDefault()
      e.stopPropagation()
      didSwipeRef.current = false
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClickCapture={onClickCapture}
    >
      <div className="grid overflow-hidden rounded-3xl border border-black/5 bg-white shadow-lg md:min-h-[560px] md:grid-cols-2">
        {/* Left: intro copy */}
        <div className="flex flex-col justify-center gap-5 p-8 md:p-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Introducing</span>
          <h3 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
            {firstName}
            {lastName && <><br /><span className="text-emerald-600">{lastName}.</span></>}
          </h3>
          <p className="text-sm font-medium tracking-wide text-gray-500">
            <span className="uppercase">{m.role}</span>
            {/* Credentials are typed case (e.g. "PharmD, MS") — not forced uppercase,
               so this matches exactly what shows in the admin edit form. */}
            {m.credentials && <span className="text-emerald-600"> · {m.credentials}</span>}
          </p>
          {m.short_bio && <p className="text-base leading-relaxed text-gray-600">{m.short_bio}</p>}

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-t border-gray-100 pt-5">
            {m.tagline ? (
              <p className="text-xs font-semibold uppercase leading-relaxed tracking-widest text-gray-800">
                {m.tagline}
              </p>
            ) : <span />}
            {m.show_bio_page && (
              <Link
                href={`/team/${m.slug}`}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Read full bio →
              </Link>
            )}
          </div>
        </div>

        {/* Right: large photo — object-cover fills this box regardless of the
           source photo's own aspect ratio, and the md:min-h-[560px] above
           (inherited via grid row stretch) is what makes it consistently
           large rather than shrinking to whatever the left column needs.
           A member without a bio page (show_bio_page: false) gets a plain
           div here instead of a Link — nothing to click through to. */}
        <PhotoTag
          {...(m.show_bio_page ? { href: `/team/${m.slug}` } : {})}
          className="group relative block min-h-[380px] overflow-hidden bg-emerald-50 md:min-h-full"
        >
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
        </PhotoTag>
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
