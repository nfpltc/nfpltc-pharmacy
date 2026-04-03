"use client"

import { useState, useEffect } from "react"

interface NewsArticle {
  id: string; title: string; description: string; url: string
  source: string; publishedAt: string; image?: string; category: string
}

const sourceColors: Record<string, string> = {
  gnews: "bg-blue-100 text-blue-700", fda: "bg-amber-100 text-amber-700",
  medlineplus: "bg-emerald-100 text-emerald-700", drugs: "bg-purple-100 text-purple-700",
}
const sourceLabels: Record<string, string> = {
  gnews: "News", fda: "FDA Alert", medlineplus: "MedlinePlus", drugs: "Drugs.com",
}

function formatDate(d: string): string {
  try {
    const ms = Date.now() - new Date(d).getTime()
    const h = Math.floor(ms / 3600000), days = Math.floor(ms / 86400000)
    if (h < 1) return "Just now"
    if (h < 24) return `${h}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch { return "" }
}

export function NewsSection() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    fetch("/api/news").then(r => r.json()).then(d => setArticles(d.articles || []))
      .catch(() => setError("Unable to load news."))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === "all" ? articles : articles.filter(a => a.category === filter)

  return (
    <section className="border-b border-emerald-900/5 bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span>
            <h2 className="text-2xl font-semibold text-gray-900">Latest Pharmacy News</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[{ key: "all", label: "All" }, { key: "gnews", label: "News" }, { key: "fda", label: "FDA" }, { key: "medlineplus", label: "Health" }].map(btn => (
              <button key={btn.key} onClick={() => setFilter(btn.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === btn.key ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{btn.label}</button>
            ))}
          </div>
        </div>

        {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="animate-pulse"><div className="mb-3 h-32 rounded-xl bg-gray-100" /><div className="mb-2 h-4 w-3/4 rounded bg-gray-100" /><div className="h-3 w-1/2 rounded bg-gray-100" /></div>)}</div>}

        {error && !loading && <div className="rounded-2xl bg-gray-50 py-12 text-center"><p className="text-gray-500">{error}</p><button onClick={() => window.location.reload()} className="mt-4 text-sm text-emerald-600 hover:underline">Try again</button></div>}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.slice(0, 8).map(article => (
              <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col rounded-xl border border-emerald-900/5 bg-gray-50/50 p-4 transition-all hover:bg-white hover:shadow-md hover:border-emerald-200">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceColors[article.category] || "bg-gray-100"}`}>{sourceLabels[article.category] || article.category}</span>
                  <span className="text-[10px] text-gray-400">{formatDate(article.publishedAt)}</span>
                </div>
                <h3 className="mb-2 text-sm font-medium leading-snug text-gray-900 line-clamp-3 group-hover:text-emerald-700 transition">{article.title}</h3>
                <p className="flex-1 text-xs text-gray-500 line-clamp-2">{article.description}</p>
                <div className="mt-3 flex items-center justify-between border-t border-emerald-900/5 pt-3">
                  <span className="max-w-[70%] truncate text-[10px] text-gray-400">{article.source}</span>
                  <svg className="h-3.5 w-3.5 text-gray-300 group-hover:text-emerald-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                </div>
              </a>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && <div className="rounded-2xl bg-gray-50 py-12 text-center"><p className="text-gray-500">No news found.</p><button onClick={() => setFilter("all")} className="mt-4 text-sm text-emerald-600 hover:underline">Show all</button></div>}
      </div>
    </section>
  )
}
