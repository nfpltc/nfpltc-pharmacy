import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export const revalidate = 60

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data } = await sb().from("blog_posts").select("title, excerpt").eq("slug", slug).eq("status", "published").single()
  if (!data) return { title: "Article Not Found" }
  return { title: `${data.title} | North Falmouth Pharmacy`, description: data.excerpt }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function renderContent(content: string) {
  const lines = content.split("\n")
  const elements: JSX.Element[] = []
  let para: string[] = []
  let listItems: string[] = []

  const flushPara = () => { if (para.length > 0) { elements.push(<p key={elements.length} className="mb-4 leading-relaxed text-gray-700">{para.join(" ")}</p>); para = [] } }
  const flushList = () => { if (listItems.length > 0) { elements.push(<ul key={elements.length} className="mb-6 list-disc space-y-2 pl-5 text-gray-700">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>); listItems = [] } }

  lines.forEach(line => {
    const t = line.trim()
    if (!t) { flushList(); flushPara(); return }
    if (t.startsWith("## ")) { flushList(); flushPara(); elements.push(<h2 key={elements.length} className="mb-4 mt-8 text-2xl font-semibold text-gray-900">{t.slice(3)}</h2>); return }
    if (t.startsWith("### ")) { flushList(); flushPara(); elements.push(<h3 key={elements.length} className="mb-3 mt-6 text-xl font-semibold text-gray-900">{t.slice(4)}</h3>); return }
    if (t.startsWith("- ") || t.startsWith("* ")) { flushPara(); listItems.push(t.slice(2)); return }
    if (listItems.length > 0) flushList()
    para.push(t)
  })
  flushList(); flushPara()
  return elements
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = sb()

  const { data: post, error } = await supabase
    .from("blog_posts").select("*").eq("slug", slug).eq("status", "published").single()

  if (error || !post) notFound()

  const { data: related } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, category, read_time, published_at, created_at")
    .eq("status", "published").eq("category", post.category).neq("id", post.id)
    .order("published_at", { ascending: false }).limit(3)

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
          <Link href="/blog" className="mb-6 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Back to articles
          </Link>
          <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
            <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white">{post.category}</span>
            <span>·</span>
            <span>{formatDate(post.published_at || post.created_at)}</span>
            <span>·</span>
            <span>{post.read_time || "3 min read"}</span>
          </div>
          <h1 className="text-3xl font-semibold text-white md:text-4xl lg:text-5xl">{post.title}</h1>
          <p className="mt-4 text-lg text-white/85">{post.excerpt}</p>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
              {post.author?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "NF"}
            </div>
            <div>
              <p className="font-medium text-white">{post.author || "North Falmouth Pharmacy"}</p>
              <p className="text-sm text-white/70">North Falmouth Pharmacy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {post.featured_image && (
        <div className="mx-auto max-w-4xl px-6 -mt-4">
          <div className="aspect-video overflow-hidden rounded-xl bg-gray-100 shadow-lg">
            <Image src={post.featured_image} alt={post.title} width={1200} height={675} className="h-full w-full object-cover" />
          </div>
          {post.image_credit && (
            <p className="mt-2 text-center text-xs italic text-gray-500">{post.image_credit}</p>
          )}
        </div>
      )}

      {/* Key Points — CNBC-style summary box */}
      {Array.isArray(post.key_points) && post.key_points.length > 0 && (
        <div className="mx-auto max-w-3xl px-6 pt-8">
          <div className="rounded-xl border-l-4 border-emerald-600 bg-white p-5 shadow-sm ring-1 ring-emerald-900/5 md:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Key Points
            </h2>
            <ul className="space-y-2 text-gray-700">
              {post.key_points.map((pt: string, i: number) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Content */}
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm md:p-10">
          {renderContent(post.content || "")}
        </div>
      </article>

      {/* Related */}
      {related && related.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Related Articles</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((r: any) => (
              <Link key={r.id} href={`/blog/${r.slug}`} className="group rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm transition hover:shadow-lg">
                <p className="mb-2 text-sm font-medium text-emerald-600">{r.category}</p>
                <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-emerald-700 transition line-clamp-2">{r.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{r.excerpt}</p>
                <p className="mt-3 text-xs text-gray-400">{r.read_time || "3 min read"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <div className="rounded-xl border border-emerald-900/10 bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Have Questions?</h2>
          <p className="mb-6 text-gray-600">Our pharmacy team is here to help with any questions about your medications or care needs.</p>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800 transition">
            Contact Us →
          </Link>
        </div>
      </section>
    </div>
  )
}
