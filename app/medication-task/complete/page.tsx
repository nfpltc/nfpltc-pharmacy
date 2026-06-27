"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, AlertCircle, Pill } from "lucide-react"

function CompletionInner() {
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<any>(null)
  const [recipient, setRecipient] = useState<any>(null)
  const [error, setError] = useState("")
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setError("Missing link token."); setLoading(false); return }
    (async () => {
      try {
        const r = await fetch(`/api/medication-task/complete?token=${encodeURIComponent(token)}`)
        const d = await r.json()
        if (!r.ok) { setError(d.error || "Could not load task."); return }
        setTask(d.task)
        setRecipient(d.recipient)
        if (d.task.status === "completed") setDone(true)
      } catch {
        setError("Network error.")
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const markComplete = async () => {
    setCompleting(true)
    setError("")
    try {
      const r = await fetch("/api/medication-task/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not mark complete."); return }
      setDone(true)
    } catch {
      setError("Network error.")
    } finally {
      setCompleting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5EF] p-6">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <div className="px-6 py-5 text-center" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
            <h1 className="text-lg font-semibold text-white">North Falmouth Pharmacy</h1>
            <p className="text-sm text-white/85">Medication Task</p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-6 text-center">
                <AlertCircle className="mb-2 h-10 w-10 text-red-400" />
                <p className="text-sm text-gray-700">{error}</p>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="mb-3 h-14 w-14 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900">Task Completed</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Thank you{recipient?.name ? `, ${recipient.name}` : ""}. This medication task has been marked as done.
                </p>
                {task?.completed_by && task.status === "completed" && (
                  <p className="mt-2 text-xs text-gray-400">Completed by {task.completed_by}</p>
                )}
              </div>
            ) : (
              <>
                {task?.priority === "urgent" && (
                  <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">⚠ Urgent</div>
                )}
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <Pill className="h-5 w-5 text-[#0B7C79]" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <Row label="Patient" value={task?.patient_name} bold />
                    {task?.patient_account && <Row label="Account" value={task.patient_account} />}
                    <Row label="Medication" value={task?.medication} bold />
                    {task?.instructions && <Row label="Instructions" value={task.instructions} />}
                  </div>
                </div>

                <button
                  onClick={markComplete}
                  disabled={completing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B7C79] px-4 py-3 font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60"
                >
                  {completing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Mark as Completed
                </button>
                <p className="mt-3 text-center text-xs text-gray-400">
                  Click to confirm this medication task is done.
                </p>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">North Falmouth Pharmacy · (508) 564-4459</p>
      </div>
    </main>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 flex-shrink-0 text-xs text-gray-500">{label}</span>
      <span className={`text-gray-900 ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  )
}

export default function MedicationTaskCompletePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F7F5EF]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
      <CompletionInner />
    </Suspense>
  )
}
