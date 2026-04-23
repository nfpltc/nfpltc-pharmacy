"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default function UnsubscribePage() {
  const params = useSearchParams()
  const token = params?.get("t") || ""
  const [state, setState] = useState<"loading" | "ok" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) { setState("error"); setMessage("Missing unsubscribe token"); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" })
        const d = await r.json()
        if (r.ok) {
          setState("ok")
          setMessage(`Account ${d.account_number} is now unsubscribed from monthly statement emails.`)
        } else {
          setState("error")
          setMessage(d.error || "Unable to unsubscribe")
        }
      } catch (e: any) {
        setState("error")
        setMessage(e.message || "Network error")
      }
    })()
  }, [token])

  return (
    <main className="min-h-screen bg-[#F7F5EF] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm ring-1 ring-black/5 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full"
             style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
          <span className="text-2xl">✉</span>
        </div>

        {state === "loading" && (
          <>
            <h1 className="text-xl font-semibold">Processing your request...</h1>
            <p className="mt-2 text-sm text-gray-600">One moment.</p>
          </>
        )}

        {state === "ok" && (
          <>
            <h1 className="text-xl font-semibold text-emerald-700">You've been unsubscribed</h1>
            <p className="mt-3 text-sm text-gray-600">{message}</p>
            <p className="mt-4 text-sm text-gray-500">
              You'll still be able to view your statements any time at
              {" "}
              <Link href="/forms/statements" className="text-emerald-700 underline">our statements page</Link>.
            </p>
            <p className="mt-6 text-sm text-gray-500">
              Changed your mind? Call the pharmacy and we'll resubscribe you.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-xl font-semibold text-red-700">Something went wrong</h1>
            <p className="mt-3 text-sm text-gray-600">{message}</p>
            <p className="mt-5 text-sm text-gray-500">
              Please contact the pharmacy at <strong>(508) 564-4459</strong> and we'll take care of it manually.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
