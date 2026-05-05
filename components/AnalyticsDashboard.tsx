"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
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

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<"line" | "bar">("line")

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
            return <SummaryCard key={key} meta={m} stat={s} href={m.href} />
          })}
        </div>
      </div>

      {/* ─── Monthly trend chart ─────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Last 12 Months</h2>
            <p className="text-sm text-gray-500">Submissions per form type, by month</p>
          </div>
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setChartMode("line")}
              className={`rounded px-3 py-1 text-xs font-medium ${chartMode === "line" ? "bg-emerald-700 text-white" : "text-gray-600"}`}
            >Line</button>
            <button
              onClick={() => setChartMode("bar")}
              className={`rounded px-3 py-1 text-xs font-medium ${chartMode === "bar" ? "bg-emerald-700 text-white" : "text-gray-600"}`}
            >Bar</button>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "line" ? (
              <LineChart data={data.monthly_series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  cursor={{ stroke: "#0EA171", strokeOpacity: 0.1, strokeWidth: 30 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {sources.map(k => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={SOURCE_META[k]?.label || k}
                    stroke={SOURCE_META[k]?.color || "#666"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={data.monthly_series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {sources.map(k => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={SOURCE_META[k]?.label || k}
                    fill={SOURCE_META[k]?.color || "#666"}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
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
                    <td className="px-6 py-3 text-right text-gray-900 font-semibold">{s.this_month}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{s.last_month}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{s.this_year}</td>
                    <td className="px-6 py-3 text-right text-gray-900 font-semibold">{s.total}</td>
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

// ── Summary card with month-over-month delta ─────────────────────────────
function SummaryCard({ meta, stat, href }: {
  meta: { label: string; color: string; Icon: any }
  stat: SummaryStat
  href: string
}) {
  const { Icon } = meta
  const delta = stat.delta_pct
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-500"

  return (
    <Link href={href}
      className="group block rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:shadow-md"
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
      <p className="mt-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{stat.total}</span> all time
      </p>
    </Link>
  )
}
