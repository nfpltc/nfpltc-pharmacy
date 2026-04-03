import { NextResponse } from "next/server"

interface NewsArticle {
  id: string; title: string; description: string; url: string
  source: string; publishedAt: string; image?: string; category: string
}

export async function GET() {
  const articles: NewsArticle[] = []

  // GNews API (free: 100 req/day, get key at https://gnews.io)
  const GNEWS_KEY = process.env.GNEWS_API_KEY
  if (GNEWS_KEY) {
    try {
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=pharmacy OR medication OR FDA drug&lang=en&country=us&max=6&apikey=${GNEWS_KEY}`,
        { next: { revalidate: 3600 } } // cache 1 hour
      )
      if (res.ok) {
        const data = await res.json()
        ;(data.articles || []).forEach((a: any, i: number) => {
          articles.push({
            id: `gnews-${i}`,
            title: a.title,
            description: a.description || "",
            url: a.url,
            source: a.source?.name || "News",
            publishedAt: a.publishedAt,
            image: a.image,
            category: "gnews",
          })
        })
      }
    } catch (e) { console.error("GNews error:", e) }
  }

  // FDA Drug Safety - RSS feed (no key needed)
  try {
    const res = await fetch("https://api.fda.gov/drug/enforcement.json?limit=4&sort=report_date:desc", { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      ;(data.results || []).forEach((r: any, i: number) => {
        articles.push({
          id: `fda-${i}`,
          title: `FDA ${r.classification}: ${r.product_description?.substring(0, 80) || "Drug Safety Alert"}`,
          description: r.reason_for_recall || r.product_description || "",
          url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
          source: "U.S. Food & Drug Administration",
          publishedAt: r.report_date ? new Date(r.report_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toISOString() : new Date().toISOString(),
          category: "fda",
        })
      })
    }
  } catch (e) { console.error("FDA error:", e) }

  // MedlinePlus Health Topics (no key needed)
  try {
    const topics = ["flu", "diabetes-medicines", "drug-reactions", "pain-relievers"]
    const topic = topics[Math.floor(Date.now() / 86400000) % topics.length] // rotates daily
    const res = await fetch(`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${topic}&retmax=4`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const text = await res.text()
      const titleMatches = text.match(/<content name="title">(.*?)<\/content>/g) || []
      const snippetMatches = text.match(/<content name="snippet">(.*?)<\/content>/g) || []
      titleMatches.slice(0, 4).forEach((t: string, i: number) => {
        const title = t.replace(/<[^>]+>/g, "").trim()
        const snippet = snippetMatches[i]?.replace(/<[^>]+>/g, "").trim() || ""
        articles.push({
          id: `medline-${i}`,
          title,
          description: snippet.substring(0, 200),
          url: `https://medlineplus.gov/ency/article/000001.htm`,
          source: "MedlinePlus",
          publishedAt: new Date().toISOString(),
          category: "medlineplus",
        })
      })
    }
  } catch (e) { console.error("MedlinePlus error:", e) }

  // Sort by date, newest first
  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  return NextResponse.json({ articles })
}
