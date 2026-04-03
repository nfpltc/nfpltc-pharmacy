"use client"
import { useState } from "react"

export function NewsletterForm({ source = "blog" }: { source?: string }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus("loading")
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      })
      const data = await r.json()
      if (r.ok) { setStatus("success"); setMessage(data.message || "Thanks!"); setEmail("") }
      else { setStatus("error"); setMessage(data.error || "Something went wrong") }
    } catch { setStatus("error"); setMessage("Failed to subscribe.") }
  }

  if (status === "success") return (
    <div className="mx-auto flex h-14 max-w-md items-center justify-center gap-3 rounded-full bg-emerald-500/20 px-6 ring-1 ring-emerald-500/30">
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      <span className="font-medium text-emerald-300">{message}</span>
    </div>
  )

  return (
    <div>
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-4 sm:flex-row">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required disabled={status === "loading"}
          className="h-14 flex-1 rounded-full border border-white/20 bg-white/10 px-6 text-white placeholder:text-gray-500 outline-none focus:border-white/40 disabled:opacity-50" />
        <button type="submit" disabled={status === "loading"} className="flex h-14 min-w-[130px] items-center justify-center gap-2 rounded-full bg-white px-8 font-medium text-emerald-700 transition hover:bg-gray-100 disabled:opacity-50">
          {status === "loading" ? "Subscribing..." : "Subscribe"}
        </button>
      </form>
      {status === "error" && <p className="mt-3 text-center text-sm text-red-400">{message}</p>}
      {status !== "success" && <p className="mt-4 text-center text-xs text-gray-500">No spam. Unsubscribe anytime.</p>}
    </div>
  )
}
