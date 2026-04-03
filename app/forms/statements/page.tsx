"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

interface Statement {
  id: string; first_name: string; last_name: string; account_number: string
  billing_period: string; file_path: string; file_name: string; file_url?: string
  bill_date: string; amount_due: number
}

function formatPeriod(p: string) {
  if (!p) return "—"
  const [y, m] = p.split("-")
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { year: "numeric", month: "long" })
}

function HIPAAModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
          <h2 className="text-lg font-semibold text-white">HIPAA Notice of Privacy Practices</h2>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto px-6 py-5 text-sm text-gray-700 space-y-3">
          <p className="font-semibold text-gray-900 text-base">NORTH FALMOUTH PHARMACY</p>
          <p className="font-semibold text-gray-900">NOTICE OF PRIVACY PRACTICES</p>

          <p>This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully. If you have any questions about this Notice, please contact our Privacy Officer.</p>

          <p className="font-medium text-gray-900 mt-4">Our Duties</p>
          <p>We are required by applicable federal and state law to maintain the privacy of your protected health information (PHI). We are also required to give you this Notice about our privacy practices, our legal duties, and your rights concerning your PHI.</p>

          <p className="font-medium text-gray-900 mt-4">Uses and Disclosures of PHI</p>
          <p>We may use and disclose your PHI for the following purposes: treatment, payment, and health care operations. We may also use or disclose your PHI for the following purposes without your authorization: as required by law, for public health activities, for health oversight activities, and for judicial and administrative proceedings.</p>

          <p className="font-medium text-gray-900 mt-4">Your Rights</p>
          <p>You have the right to request restrictions on certain uses and disclosures of your PHI. You have the right to receive confidential communications. You have the right to inspect and copy your PHI. You have the right to request amendments to your PHI. You have the right to receive an accounting of certain disclosures of your PHI. You have the right to a paper copy of this Notice.</p>

          <p className="font-medium text-gray-900 mt-4">Statement Access</p>
          <p>By clicking &quot;I Acknowledge and Agree&quot; below, you confirm that you are the account holder or an authorized representative, and you consent to accessing your billing statements electronically through this secure portal. You agree that you will not share access credentials or statement information with unauthorized individuals.</p>

          <p className="font-medium text-gray-900 mt-4">Contact Information</p>
          <p>North Falmouth Pharmacy<br />
            Phone: (508) 564-4459<br />
            Email: care@nfpltc.com</p>

          <p className="text-xs text-gray-400 mt-4">Effective Date: April 14, 2003 | Revised: January 2026</p>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <button
            onClick={onAccept}
            className="w-full h-12 rounded-lg font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}
          >
            I Acknowledge and Agree
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">
            You must accept to view your statements
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ViewStatementsPage() {
  const [accepted, setAccepted] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [account, setAccount] = useState("")
  const [period, setPeriod] = useState("all")
  const [periods, setPeriods] = useState<string[]>([])
  const [results, setResults] = useState<Statement[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if already accepted in this session
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("hipaa_accepted") === "true") {
      setAccepted(true)
    }
  }, [])

  // Load available billing periods on mount
  useEffect(() => {
    fetch("/api/statements/search?periods_only=1")
      .then(r => r.json()).then(d => setPeriods(d.periods || [])).catch(() => {})
  }, [])

  const handleAccept = () => {
    setAccepted(true)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hipaa_accepted", "true")
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName && !lastName) { setError("Please enter your first or last name."); return }
    setError(""); setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams()
      if (firstName) params.append("first_name", firstName)
      if (lastName) params.append("last_name", lastName)
      if (account) params.append("account", account)
      if (period !== "all") params.append("period", period)
      const r = await fetch(`/api/statements/search?${params}`)
      const d = await r.json()
      if (r.ok) { setResults(d.statements || []); setPeriods(d.periods || []) }
      else setError(d.error || "Search failed")
    } catch { setError("Something went wrong. Please try again.") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* HIPAA Modal — shows on first visit */}
      {!accepted && <HIPAAModal onAccept={handleAccept} />}

      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20 text-center">
          <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">Statements</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
            View and download your monthly pharmacy billing statements. Enter your name below to search.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        {/* Info Box */}
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
            </div>
            <div>
              <h3 className="font-medium text-emerald-800">How to find your statements</h3>
              <p className="mt-1 text-sm text-emerald-700">Enter your first and last name as they appear on your account. You can also enter your account number for a more precise search. Select a billing month to filter results.</p>
            </div>
          </div>
        </div>

        {/* HIPAA badge */}
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-white border border-emerald-900/10 px-4 py-2.5 shadow-sm">
          <svg className="h-5 w-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
          <p className="text-xs text-gray-600"><span className="font-medium text-gray-800">HIPAA Protected</span> — Your health information is secured under HIPAA privacy regulations. Statements are accessed via time-limited secure links.</p>
        </div>

        {/* Search Form */}
        <div className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Search Your Statements</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. Joan" className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Zhang" className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Number <span className="text-gray-400">(optional)</span></label>
                <input type="text" value={account} onChange={e => setAccount(e.target.value)} placeholder="e.g. 101338" className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Billing Month</label>
                <select value={period} onChange={e => setPeriod(e.target.value)} className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="all">All Months</option>
                  {periods.map(p => <option key={p} value={p}>{formatPeriod(p)}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="h-12 w-full rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition sm:w-auto sm:px-8">
              {loading ? "Searching..." : "Search Statements"}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div className="mt-8">
            {loading ? (
              <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-emerald-900/10 bg-white py-12 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No statements found</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">We couldn&apos;t find any statements matching your name. Please check the spelling or contact the pharmacy for assistance.</p>
                <p className="mt-4 text-sm text-gray-500">
                  Need help? Call us at <a href="tel:5085644459" className="font-medium text-emerald-700 hover:underline">(508) 564-4459</a>
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {results.length} Statement{results.length !== 1 ? "s" : ""} Found
                  </h3>
                  <p className="text-sm text-gray-500">
                    for {results[0]?.first_name} {results[0]?.last_name}
                  </p>
                </div>
                <div className="space-y-3">
                  {results.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{formatPeriod(s.billing_period)}</p>
                          <p className="text-sm text-gray-500">
                            {s.last_name}, {s.first_name} · Acct: {s.account_number || "—"}
                            {s.amount_due > 0 && <span className="ml-2 font-medium text-gray-700">${s.amount_due.toFixed(2)}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.file_url ? (
                          <>
                            <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-2 rounded-lg bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                              View
                            </a>
                            <a href={s.file_url} download className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                              Download
                            </a>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">PDF not available</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-12 rounded-xl border border-emerald-900/10 bg-white p-6 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
          <p className="text-sm text-gray-600 mb-4">If you can&apos;t find your statement or have billing questions, our team is here to help.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="tel:5085644459" className="flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-medium text-white hover:bg-emerald-800 transition">
              (508) 564-4459
            </a>
            <Link href="/contact" className="flex h-10 items-center gap-2 rounded-lg border border-emerald-700 px-6 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
