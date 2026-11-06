"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Check, X, Clock, UserCheck, UserX } from "lucide-react"

interface Request {
  id: string
  account_number: string
  email: string
  phone: string | null
  first_name: string | null
  last_name: string | null
  status: string
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export default function PortalRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<"pending" | "all">("pending")

  const load = async () => {
    try {
      const r = await fetch("/api/admin/portal-requests")
      const d = await r.json()
      setRequests(d.requests || [])
    } catch { setMsg({ ok: false, text: "Failed to load requests" }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActing(id); setMsg(null)
    try {
      const r = await fetch("/api/admin/portal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
      const d = await r.json()
      if (r.ok) { setMsg({ ok: true, text: d.message }); load() }
      else setMsg({ ok: false, text: d.error || "Action failed" })
    } catch { setMsg({ ok: false, text: "Something went wrong" }) }
    finally { setActing(null) }
  }

  const filtered = filter === "pending" ? requests.filter(r => r.status === "pending") : requests
  const pendingCount = requests.filter(r => r.status === "pending").length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Portal Access Requests</h1>
            <p className="text-sm text-gray-500">Customers requesting online portal access</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            {pendingCount} pending
          </span>
        )}
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setFilter("pending")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filter === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filter === "all" ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          All
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">{filter === "pending" ? "No pending requests" : "No requests yet"}</p>
          <p className="mt-1 text-sm text-gray-400">Customers who can&apos;t verify their email will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                    req.status === "pending" ? "bg-amber-100" : req.status === "approved" ? "bg-emerald-100" : "bg-red-100"
                  }`}>
                    {req.status === "pending" ? <Clock className="h-5 w-5 text-amber-600" /> :
                     req.status === "approved" ? <UserCheck className="h-5 w-5 text-emerald-600" /> :
                     <UserX className="h-5 w-5 text-red-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {req.first_name} {req.last_name}
                      <span className="ml-2 text-xs font-normal text-gray-400">Acct: {req.account_number}</span>
                    </p>
                    <p className="text-sm text-gray-600">{req.email}</p>
                    {req.phone && <p className="text-sm text-gray-500">{req.phone}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      Requested {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {req.reviewed_at && ` · Reviewed ${new Date(req.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                    {req.admin_notes && <p className="mt-1 text-xs text-gray-500 italic">Note: {req.admin_notes}</p>}
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req.id, "approve")}
                      disabled={acting === req.id}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "reject")}
                      disabled={acting === req.id}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}

                {req.status !== "pending" && (
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    req.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-medium text-blue-800">How it works</h3>
        <ul className="mt-2 space-y-1 text-xs text-blue-700">
          <li>• When a customer creates an account at <strong>nfpltc.com/user</strong>, we check if their email matches our records.</li>
          <li>• If the email matches → account is created automatically.</li>
          <li>• If the email doesn&apos;t match → a request appears here for you to approve.</li>
          <li>• Approving adds their email to the customer record, so they can then create their account.</li>
        </ul>
      </div>
    </div>
  )
}
