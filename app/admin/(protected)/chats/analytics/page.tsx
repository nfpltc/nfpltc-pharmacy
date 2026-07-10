"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, MessageSquare, Sparkles, TrendingUp } from "lucide-react"

type Theme = { key: string; label: string; count: number; pct: number }
type TopQ = { text: string; count: number }
type Win = { label: string; total: number; themes: Theme[]; topQuestions: TopQ[] }
type Data = { windows: { month: Win; half_year: Win; year: Win }; status: Record<string, number> }

const BAR_COLORS = ["bg-emerald-600", "bg-emerald-500", "bg-teal-500", "bg-amber-400", "bg-orange-400", "bg-gray-300"]

export default function ChatAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [takeaways, setTakeaways] = useState<string[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiErr, setAiErr] = useState("")

  useEffect(() => {
    fetch("/api/admin/chats/analytics").then((r) => r.json()).then((d) => setData(d.error ? null : d)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const getTakeaways = async () => {
    if (!data) return
    setAiLoading(true); setAiErr("")
    try {
      const y = data.windows.half_year
      const r = await fetch("/api/admin/chats/analytics/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themes: y.themes, questions: y.topQuestions }),
      })
      const d = await r.json()
      if (!r.ok) { setAiErr(d.error || "Could not generate takeaways."); return }
      setTakeaways(d.takeaways || [])
    } catch { setAiErr("Could not reach the AI service.") }
    finally { setAiLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>

  const windows = data ? [data.windows.month, data.windows.half_year, data.windows.year] : []
  const empty = !data || windows.every((w) => w.total === 0)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2"><Link href="/admin/chats" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to Chats</Link></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><TrendingUp className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Chat insights</h1>
            <p className="text-sm text-gray-500">What customers ask most — use it to train the bot and staff FAQs.</p>
          </div>
        </div>
        {data && (
          <div className="flex gap-2 text-xs">
            <Chip label="Active" n={data.status.active || 0} cls="bg-emerald-50 text-emerald-700" />
            <Chip label="Escalated" n={data.status.escalated || 0} cls="bg-amber-50 text-amber-700" />
            <Chip label="Resolved" n={data.status.resolved || 0} cls="bg-gray-100 text-gray-600" />
          </div>
        )}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No customer chats yet. Once people use the website chatbot, their questions show up here.</p>
        </div>
      ) : (
        <>
          {/* AI takeaways */}
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Sparkles className="h-4 w-4" /> AI takeaways</div>
              {!takeaways && (
                <button onClick={getTakeaways} disabled={aiLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} What should we improve?
                </button>
              )}
            </div>
            {aiErr && <p className="mt-2 text-xs text-red-600">{aiErr}</p>}
            {takeaways && (
              <ul className="mt-3 space-y-1.5">
                {takeaways.map((t, i) => <li key={i} className="flex gap-2 text-sm text-emerald-900"><span className="mt-0.5 text-emerald-500">•</span>{t}</li>)}
              </ul>
            )}
            {!takeaways && !aiErr && <p className="mt-2 text-xs text-emerald-700/70">Summarizes the last 6 months of questions into concrete FAQ / bot improvements.</p>}
          </div>

          {/* Three windows */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {windows.map((w) => (
              <div key={w.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">{w.label}</h2>
                  <span className="text-lg font-semibold tabular-nums text-gray-900">{w.total}<span className="ml-1 text-xs font-normal text-gray-400">questions</span></span>
                </div>

                {w.total === 0 ? <p className="py-8 text-center text-xs text-gray-400">No questions in this window.</p> : (
                  <>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Top question types</p>
                    <div className="mb-4 space-y-1.5">
                      {w.themes.slice(0, 5).map((t, i) => (
                        <div key={t.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                          <div>
                            <div className="mb-0.5 flex justify-between text-xs text-gray-600"><span className="truncate">{t.label}</span><span className="ml-2 tabular-nums text-gray-400">{t.pct}%</span></div>
                            <div className="h-2 rounded-full bg-gray-100"><div className={`h-full rounded-full ${BAR_COLORS[i] || "bg-gray-300"}`} style={{ width: `${Math.max(t.pct, 3)}%` }} /></div>
                          </div>
                          <span className="text-xs tabular-nums text-gray-500">{t.count}</span>
                        </div>
                      ))}
                    </div>

                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Most-asked</p>
                    <ol className="space-y-1">
                      {w.topQuestions.slice(0, 5).map((q, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 text-xs">
                          <span className="text-gray-700"><span className="mr-1 text-gray-400">{i + 1}.</span>{q.text}</span>
                          {q.count > 1 && <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 tabular-nums text-gray-500">×{q.count}</span>}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">Each customer chat is counted once by its opening question. Types are matched by keyword; "Most-asked" groups near-identical wording.</p>
        </>
      )}
    </div>
  )
}

function Chip({ label, n, cls }: { label: string; n: number; cls: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${cls}`}>{n} {label}</span>
}
