"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Tab = "signin" | "create"

export default function UserAuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("signin")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [checking, setChecking] = useState(true)

  // Sign-in fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Create account fields
  const [cAccount, setCAccount] = useState("")
  const [cEmail, setCEmail] = useState("")
  const [cPhone, setCPhone] = useState("")
  const [cPassword, setCPassword] = useState("")
  const [cConfirm, setCConfirm] = useState("")

  // Check if already logged in
  useEffect(() => {
    fetch("/api/user/session")
      .then(r => r.json())
      .then(d => { if (d.user) router.replace("/user/dashboard") })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null); setLoading(true)
    try {
      const r = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (r.ok) { router.push("/user/dashboard") }
      else setMsg({ ok: false, text: d.error || "Sign in failed" })
    } catch { setMsg({ ok: false, text: "Something went wrong" }) }
    finally { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (cPassword !== cConfirm) { setMsg({ ok: false, text: "Passwords don't match." }); return }
    if (cPassword.length < 6) { setMsg({ ok: false, text: "Password must be at least 6 characters." }); return }
    setLoading(true)
    try {
      const r = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: cAccount, email: cEmail, password: cPassword, phone: cPhone }),
      })
      const d = await r.json()
      if (d.ok) { router.push("/user/dashboard") }
      else if (d.pending) { setMsg({ ok: true, text: d.message }) }
      else setMsg({ ok: false, text: d.error || "Registration failed" })
    } catch { setMsg({ ok: false, text: "Something went wrong" }) }
    finally { setLoading(false) }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5EF]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">My Account</h1>
          <p className="mx-auto mt-3 max-w-lg text-base text-white/85">
            Access your statements, balances, and account details online.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-10">
        {/* Tab switcher */}
        <div className="mb-6 flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => { setTab("signin"); setMsg(null) }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${tab === "signin" ? "bg-emerald-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab("create"); setMsg(null) }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${tab === "create" ? "bg-emerald-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            Create Account
          </button>
        </div>

        {/* Message */}
        {msg && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {msg.text}
          </div>
        )}

        {/* Sign In Form */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <button type="submit" disabled={loading}
              className="h-12 w-full rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* Create Account Form */}
        {tab === "create" && (
          <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              Enter your account number as shown on your pharmacy statement. If your email matches our records, your account will be created instantly. Otherwise, we&apos;ll send a request to the pharmacy for approval.
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Account Number *</label>
              <input type="text" required value={cAccount} onChange={e => setCAccount(e.target.value)}
                placeholder="e.g. 101001100"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
              <input type="email" required value={cEmail} onChange={e => setCEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={cPhone} onChange={e => setCPhone(e.target.value)}
                placeholder="(508) 555-1234"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password *</label>
              <input type="password" required value={cPassword} onChange={e => setCPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password *</label>
              <input type="password" required value={cConfirm} onChange={e => setCConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <button type="submit" disabled={loading}
              className="h-12 w-full rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>
        )}

        {/* Help */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Need help? Call us at{" "}
          <a href="tel:5085644459" className="font-medium text-emerald-700 hover:underline">(508) 564-4459</a>
        </div>
      </section>
    </div>
  )
}
