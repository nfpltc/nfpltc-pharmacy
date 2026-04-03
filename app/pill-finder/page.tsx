"use client"

import { useMemo, useState, useEffect } from "react"
import pills from "@/lib/pills_600.json" assert { type: "json" }
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type Pill = { id: number; name: string; image: string }

export default function PillFinderPage() {
  const [q, setQ] = useState("")
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  useEffect(() => { setShowDisclaimer(true) }, [])

  const filteredPills = useMemo(() => {
    return q.trim().length === 0
      ? []
      : pills.filter((pill) => pill.name.toLowerCase().includes(q.toLowerCase()))
  }, [q])

  return (
    <>
      {/* Disclaimer Modal */}
      <Dialog open={showDisclaimer}>
        <DialogContent className="max-w-xl rounded-2xl border-0 bg-white shadow-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <DialogTitle className="text-center text-xl font-semibold text-gray-900">
              Medical Disclaimer
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600">
            <p>This Pill Finder is provided for <strong>educational purposes only</strong> and is intended for use in the United States. The information on this site is not intended to replace consultation with a qualified physician, pharmacist, or other healthcare professional.</p>
            <p>Always seek the advice of your physician or other qualified healthcare provider regarding a medical condition. Never disregard medical advice or delay seeking care because of something you have read here.</p>
            <p>We do not guarantee that the information or images are accurate, complete, or current. The North Falmouth Pharmacy Pill Finder is an informational tool only and does not provide diagnostic or medical services.</p>
            <p className="font-medium text-gray-800">If you are experiencing a medical emergency, please call <span className="text-red-600 font-bold">911</span>.</p>
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => (window.location.href = "/")} className="border-gray-300 text-gray-700 hover:bg-gray-100">Back to Home</Button>
            <Button onClick={() => setShowDisclaimer(false)} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6">I Understand — Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page */}
      <div className="min-h-screen bg-[#F7F5EF]">
        {/* Hero */}
        <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg, #0EA171 0%, #0B8F79 50%, #0B7C79 100%)" }}>
          <div className="mx-auto max-w-5xl px-6 py-16 text-center md:py-20">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">Pill Identifier</h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">Search our database of {pills.length.toLocaleString()}+ medications by name to see pill images and identification details.</p>

            {/* Search */}
            <div className="mx-auto mt-8 max-w-xl">
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by medication name (e.g. Lisinopril, Metformin, Amoxicillin...)"
                  disabled={showDisclaimer}
                  className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              {q.trim() && !showDisclaimer && (
                <p className="mt-3 text-sm text-white/80">
                  Found <strong className="text-white">{filteredPills.length}</strong> result{filteredPills.length !== 1 ? "s" : ""} for &quot;{q}&quot;
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="mx-auto max-w-6xl px-6 py-10">
          {q.trim() && !showDisclaimer ? (
            filteredPills.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredPills.map((pill) => (
                  <div key={pill.id} className="group overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm transition hover:shadow-md">
                    <div className="flex h-36 items-center justify-center border-b bg-white p-3">
                      <img
                        src={pill.image.startsWith("/") ? pill.image : `/images/pills/600/${pill.image}`}
                        alt={pill.name}
                        className="max-h-full max-w-full object-contain transition group-hover:scale-105"
                        onError={(e) => ((e.target as HTMLImageElement).src = "/placeholder-pill.png")}
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-medium leading-snug text-gray-800 line-clamp-3">{pill.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-white py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">No pills found for &quot;{q}&quot;</h3>
                <p className="mt-2 text-sm text-gray-500">Try a different spelling or search by generic name</p>
              </div>
            )
          ) : !showDisclaimer ? (
            /* Info Cards — shown when no search */
            <div className="space-y-10">
              {/* How to use */}
              <div>
                <h2 className="mb-5 text-center text-xl font-semibold text-gray-900">How to Use the Pill Identifier</h2>
                <div className="grid gap-5 md:grid-cols-3">
                  {[
                    { icon: "1", title: "Search by Name", desc: "Type the medication name, brand name, or active ingredient in the search bar above." },
                    { icon: "2", title: "Compare the Image", desc: "Match the pill image with the medication you have. Check shape, color, and markings." },
                    { icon: "3", title: "Confirm with Your Pharmacist", desc: "Always verify with your pharmacist or doctor before taking any medication." },
                  ].map((s) => (
                    <div key={s.icon} className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-lg font-bold text-emerald-700">{s.icon}</div>
                      <h3 className="mb-2 font-semibold text-gray-900">{s.title}</h3>
                      <p className="text-sm leading-relaxed text-gray-600">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Searches */}
              <div>
                <h2 className="mb-5 text-center text-xl font-semibold text-gray-900">Popular Searches</h2>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Lisinopril", "Metformin", "Amoxicillin", "Omeprazole", "Atorvastatin", "Amlodipine", "Gabapentin", "Hydrochlorothiazide", "Metoprolol", "Losartan", "Levothyroxine", "Ibuprofen"].map((name) => (
                    <button key={name} onClick={() => setQ(name)} className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Safety Info */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-200">
                      <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-amber-900">Important Safety Information</h3>
                    <p className="text-sm leading-relaxed text-amber-800">This tool is for reference purposes only. Pill appearance can vary between manufacturers. Never take medication that wasn&apos;t prescribed to you. If you find an unknown pill, bring it to your pharmacist for proper identification. Contact us at <strong>(508) 564-4459</strong> for assistance.</p>
                  </div>
                </div>
              </div>

              {/* Stats / Trust */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-900/10 bg-white p-5 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-700">{pills.length.toLocaleString()}+</p>
                  <p className="mt-1 text-sm text-gray-500">Medications in Database</p>
                </div>
                <div className="rounded-xl border border-emerald-900/10 bg-white p-5 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-700">FDA</p>
                  <p className="mt-1 text-sm text-gray-500">Referenced Drug Images</p>
                </div>
                <div className="rounded-xl border border-emerald-900/10 bg-white p-5 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-700">Free</p>
                  <p className="mt-1 text-sm text-gray-500">Always Free to Use</p>
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl bg-emerald-700 p-8 text-center text-white shadow-lg">
                <h3 className="mb-2 text-xl font-semibold">Need Help Identifying a Medication?</h3>
                <p className="mx-auto mb-5 max-w-lg text-sm text-emerald-100">Our pharmacists are here to help. Bring any unknown medications to our pharmacy and we&apos;ll identify them for you — free of charge.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <a href="tel:5085644459" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                    (508) 564-4459
                  </a>
                  <a href="/contact" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}
