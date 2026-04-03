import Link from "next/link"
import Image from "next/image"
import { createClient } from "@supabase/supabase-js"
import { NewsSection } from "@/components/blog/news-section"
import { NewsletterForm } from "@/components/blog/newsletter-form"

export const metadata = {
  title: "Blog & News | North Falmouth Pharmacy",
  description: "Health tips, pharmacy news, and resources for long-term care facilities from North Falmouth Pharmacy.",
}

async function getBlogPosts() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, category, author, read_time, published_at, created_at, featured_image")
      .eq("status", "published")
      .order("published_at", { ascending: false })
    if (error) { console.error("Blog fetch error:", error); return [] }
    return data || []
  } catch { return [] }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default async function BlogPage() {
  const posts = await getBlogPosts()
  const featured = posts.slice(0, 2)
  const regular = posts.slice(2)

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-white/70">Resources</p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">Blog & News</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">Stay informed with the latest pharmacy news, health tips, and resources for long-term care facilities.</p>
        </div>
      </section>

      {/* Live Pharmacy News from APIs */}
      <NewsSection />

      {/* Our Articles from Supabase */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-8 text-2xl font-semibold text-gray-900">Our Articles</h2>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-emerald-900/10 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles yet</h3>
            <p className="text-gray-500">Check back soon for new content from our pharmacy team!</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <div className="mb-10 grid gap-6 md:grid-cols-2">
                {featured.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm transition hover:shadow-lg">
                    <div className="relative h-56 bg-emerald-50 overflow-hidden">
                      {post.featured_image ? (
                        <Image src={post.featured_image} alt={post.title} fill className="object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
                          <svg className="h-12 w-12 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                        </div>
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-emerald-700">Featured</span>
                    </div>
                    <div className="p-6">
                      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-emerald-600">{post.category}</span><span>·</span>
                        <span>{formatDate(post.published_at || post.created_at)}</span><span>·</span>
                        <span>{post.read_time || "3 min read"}</span>
                      </div>
                      <h2 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-emerald-700 transition">{post.title}</h2>
                      <p className="text-sm text-gray-600 line-clamp-2">{post.excerpt}</p>
                      <p className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-700">Read article →</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Regular grid */}
            {regular.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {regular.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-sm transition hover:shadow-lg">
                    <div className="relative h-40 bg-gray-100 overflow-hidden">
                      {post.featured_image ? (
                        <Image src={post.featured_image} alt={post.title} fill className="object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-emerald-600">{post.category}</span><span>·</span><span>{post.read_time || "3 min read"}</span>
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-emerald-700 transition line-clamp-2">{post.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{post.excerpt}</p>
                      <p className="mt-3 text-xs text-gray-400">{formatDate(post.published_at || post.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Newsletter CTA */}
      <section className="bg-emerald-800 py-16 text-white md:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Stay Updated</h2>
          <p className="mx-auto mt-4 max-w-xl text-emerald-200">Subscribe to our newsletter for the latest pharmacy insights, health tips, and resources for long-term care facilities.</p>
          <div className="mt-8">
            <NewsletterForm source="blog" />
          </div>
        </div>
      </section>
    </div>
  )
}
