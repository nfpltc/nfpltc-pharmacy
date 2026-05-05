"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  UserCheck, Syringe, CreditCard, MessageSquare, FileStack,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react"

interface SummaryStat {
  total: number
  today: number | null
  this_week: number | null
  this_month: number
  last_month: number
  this_year: number
  delta_pct: number
}

interface AnalyticsData {
  generated_at: string
  summary: Record<string, SummaryStat>
  monthly_series: Array<Record<string, any>>
  sources: string[]
}

// Visual config per source — labels, colors, icons, links
const SOURCE_META: Record<string, { label: string; color: string; href: string; Icon: any }> = {
  enrollments:  { label: "Enrollments",   color: "#0EA171", href: "/admin/enrollments",  Icon: UserCheck },
  vaccines:     { label: "Vaccines",      color: "#3B82F6", href: "/admin/vaccines",     Icon: Syringe },
  credit_cards: { label: "Card Updates",  color: "#A855F7", href: "/admin/credit-cards", Icon: CreditCard },
  contacts:     { label: "Contact Forms", color: "#F59E0B", href: "/admin/contacts",     Icon: MessageSquare },
  statements:   { label: "Statements",    color: "#0B7C79", href: "/admin/statements",   Icon: FileStack },
}

// Statements dwarf everything else (1000s vs single digits), so by default
// we exclude them so the smaller series are visible. User can toggle on.
const DEFAULT_VISIBLE = ["enrollments", "vaccines", "credit_cards", "contacts"]

type ChartType = "line" | "bar" | "area"

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<ChartType>("area")
  const [visible, setVisible] = useState<Set<string>>(new Set(DEFAULT_VISIBLE))

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch("/api/admin/analytics")
        const d = await r.json()
        if (!r.ok) { setError(d.error || "Failed to load analytics"); return }
        setData(d)
      } catch (e: any) {
        setError(e.message || "Network error")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }
  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
  }
  if (!data) return null

  const sources = data.sources
  const visibleSources = sources.filter(s => visible.has(s))

  const toggleSource = (key: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const showAll = () => setVisible(new Set(sources))
  const showOnly = (key: string) => setVisible(new Set([key]))
  const reset = () => setVisible(new Set(DEFAULT_VISIBLE))

  return (
    <div className="space-y-8">
      {/* ─── Headline summary cards ──────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">This Month</h2>
          <p className="text-xs text-gray-500">
            Updated {new Date(data.generated_at).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sources.map(key => {
            const s = data.summary[key]
            const m = SOURCE_META[key]
            if (!s || !m) return null
            return (
              <SummaryCard
                key={key} meta={m} stat={s} href={m.href}
                onClick={() => showOnly(key)}
                isFocused={visible.size === 1 && visible.has(key)}
              />
            )
          })}
        </div>
      </div>

      {/* ─── Monthly trend chart with filter pills ──────────────────── */}
      <div className="rounded-xl border border-emerald-900/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Last 12 Months</h2>
            <p className="text-sm text-gray-500">Click cards above to focus, use pills below to filter</p>
          </div>
          {/* Chart type toggle */}
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            {(["area", "line", "bar"] as ChartType[]).map(t => (
              <button
                key={t}
                onClick={() => setChartMode(t)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                  chartMode === t ? "bg-emerald-700 text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-3">
          {sources.map(key => {
            const m = SOURCE_META[key]
            if (!m) return null
            const isVisible = visible.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleSource(key)}
                className={`group flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition ${
                  isVisible
                    ? "border border-transparent text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
                style={isVisible ? { backgroundColor: m.color } : undefined}
                title={isVisible ? `Hide ${m.label}` : `Show ${m.label}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isVisible ? "rgba(255,255,255,0.8)" : m.color }}
                />
                {m.label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <button onClick={showAll} className="text-emerald-700 hover:underline">Show all</button>
            <span className="text-gray-300">·</span>
            <button onClick={reset} className="text-gray-500 hover:underline">Reset</button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-80 w-full px-2 py-4">
          {visibleSources.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select at least one form type above to see the chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "area" ? (
                <AreaChart data={data.monthly_series} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <defs>
                    {visibleSources.map(k => (
                      <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={SOURCE_META[k]?.color || "#666"} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={SOURCE_META[k]?.color || "#666"} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip sources={visibleSources} />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {visibleSources.map(k => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      name={SOURCE_META[k]?.label || k}
                      stroke={SOURCE_META[k]?.color || "#666"}
                      strokeWidth={2.5}
                      fill={`url(#grad-${k})`}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    />
                  ))}
                </AreaChart>
              ) : chartMode === "line" ? (
                <LineChart data={data.monthly_series} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip sources={visibleSources} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  {visibleSources.map(k => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      name={SOURCE_META[k]?.label || k}
                      stroke={SOURCE_META[k]?.color || "#666"}
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0, fill: SOURCE_META[k]?.color || "#666" }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={data.monthly_series} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip sources={visibleSources} />} cursor={{ fill: "rgba(14, 161, 113, 0.05)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  {visibleSources.map(k => (
                    <Bar
                      key={k}
                      dataKey={k}
                      name={SOURCE_META[k]?.label || k}
                      fill={SOURCE_META[k]?.color || "#666"}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ─── Detailed breakdown table ────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-900/10 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Activity Breakdown</h2>
          <p className="text-sm text-gray-500">All-time totals and recent activity</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Form</th>
                <th className="px-6 py-3 text-right">Today</th>
                <th className="px-6 py-3 text-right">This Week</th>
                <th className="px-6 py-3 text-right">This Month</th>
                <th className="px-6 py-3 text-right">Last Month</th>
                <th className="px-6 py-3 text-right">This Year</th>
                <th className="px-6 py-3 text-right">All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sources.map(k => {
                const s = data.summary[k]
                const m = SOURCE_META[k]
                if (!s || !m) return null
                return (
                  <tr key={k} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <Link href={m.href} className="flex items-center gap-2 font-medium text-emerald-700 hover:underline">
                        <m.Icon className="h-4 w-4" />
                        {m.label}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900">{s.today ?? "—"}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{s.this_week ?? "—"}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{s.this_month}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{s.last_month}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{s.this_year}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{s.total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Custom tooltip with cleaner styling ──────────────────────────────────
function CustomTooltip({ active, payload, label, sources }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-gray-900">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}</span>
            </span>
            <span className="font-semibold text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Summary card with month-over-month delta ─────────────────────────────
function SummaryCard({ meta, stat, href, onClick, isFocused }: {
  meta: { label: string; color: string; Icon: any }
  stat: SummaryStat
  href: string
  onClick: () => void
  isFocused: boolean
}) {
  const { Icon } = meta
  const delta = stat.delta_pct
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-500"

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className={`group block cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isFocused
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-emerald-900/10 hover:border-emerald-300"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div
          className="inline-flex h-9 w-9 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {delta === 0 ? "0%" : `${delta > 0 ? "+" : ""}${delta}%`}
        </span>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{meta.label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{stat.this_month}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{stat.total}</span> all time
        </p>
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100 hover:underline"
        >
          Open →
        </Link>
      </div>
    </div>
  )
}
