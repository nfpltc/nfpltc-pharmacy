"use client"
import { useState, useEffect, useCallback } from "react"
import { Bot, Loader2, Play, Pause, Sparkles, Calendar, CheckCircle2 } from "lucide-react"

// Control panel shown at the top of the Blog admin page. Lets the admin
// pause/resume auto-generation, pick frequency, choose publish vs draft,
// and generate a post on demand.

interface Settings {
  enabled: boolean
  frequency: string
  auto_publish: boolean
  last_generated_at: string | null
}
interface Stats { this_week: number; this_month: number; total_ai: number }

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "biweekly", label: "2–3 / week" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

export default function BlogAutomationPanel({ onGenerated }: { onGenerated?: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stats, setStats] = useState<Stats>({ this_week: 0, this_month: 0, total_ai: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState("")
  const [customTopic, setCustomTopic] = useState("")

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/blog-settings")
      const d = await r.json()
      if (r.ok) { setSettings(d.settings); setStats(d.stats) }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const update = async (patch: Partial<Settings>) => {
    setSaving(true)
    setMsg("")
    // optimistic
    setSettings(prev => prev ? { ...prev, ...patch } : prev)
    try {
      const r = await fetch("/api/admin/blog-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const d = await r.json()
      if (!r.ok) { setMsg(d.error || "Could not save"); load() }
      else setSettings(d.settings)
    } catch { setMsg("Network error"); load() }
    finally { setSaving(false) }
  }

  const generateNow = async () => {
    setGenerating(true)
    setMsg("")
    try {
      const r = await fetch("/api/admin/blog-settings/generate-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customTopic.trim() ? { topic: customTopic.trim() } : {}),
      })
      const d = await r.json()
      if (!r.ok) { setMsg(d.error || "Generation failed"); return }
      setMsg(`Created "${d.title}" (${d.status}) ✓`)
      setCustomTopic("")
      load()
      onGenerated?.()
    } catch {
      setMsg("Network error")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading automation settings…
      </div>
    )
  }
  if (!settings) return null

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <Bot className="h-5 w-5 text-[#0B7C79]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Blog Automation</h3>
            <p className="text-xs text-gray-500">
              {settings.enabled
                ? `Active · ${FREQUENCIES.find(f => f.value === settings.frequency)?.label || settings.frequency} · ${settings.auto_publish ? "auto-publish" : "save as draft"}`
                : "Paused — no automatic posts"}
            </p>
          </div>
        </div>

        {/* Pause / Resume */}
        <button
          onClick={() => update({ enabled: !settings.enabled })}
          disabled={saving}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            settings.enabled
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {settings.enabled ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
        </button>
      </div>

      {/* Controls grid */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* Frequency */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
            <Calendar className="h-3.5 w-3.5" /> Frequency
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map(f => (
              <button
                key={f.value}
                onClick={() => update({ frequency: f.value })}
                disabled={saving || !settings.enabled}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                  settings.frequency === f.value
                    ? "bg-[#0B7C79] text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Publish mode */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">When generated</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => update({ auto_publish: true })}
              disabled={saving}
              className={`flex-1 rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                settings.auto_publish ? "bg-[#0B7C79] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Publish live
            </button>
            <button
              onClick={() => update({ auto_publish: false })}
              disabled={saving}
              className={`flex-1 rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                !settings.auto_publish ? "bg-[#0B7C79] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Save as draft
            </button>
          </div>
        </div>

        {/* Generate now */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Manual</label>
          <button
            onClick={generateNow}
            disabled={generating}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {generating
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3.5 w-3.5" /> {customTopic.trim() ? "Generate This Topic" : "Generate Now"}</>}
          </button>
        </div>
      </div>

      {/* Custom topic input */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Custom topic (optional) — leave blank to auto-pick from the topic bank
        </label>
        <input
          type="text"
          value={customTopic}
          onChange={e => setCustomTopic(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !generating) generateNow() }}
          placeholder="e.g. How to safely store insulin at home"
          disabled={generating}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Stats + message */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>
          {stats.this_week} this week · {stats.this_month} this month · {stats.total_ai} total AI posts
          {settings.last_generated_at && <> · last: {new Date(settings.last_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}
        </span>
        {msg && (
          <span className={`flex items-center gap-1 ${msg.includes("✓") ? "text-emerald-600" : "text-red-600"}`}>
            {msg.includes("✓") && <CheckCircle2 className="h-3.5 w-3.5" />}{msg}
          </span>
        )}
      </div>

      {generating && (
        <p className="mt-2 text-xs text-gray-400">
          Writing content with AI and fetching an image… this can take 10–20 seconds.
        </p>
      )}
    </div>
  )
}
