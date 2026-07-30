"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, PenLine } from "lucide-react"
import BlogAutomationPanel from "@/components/BlogAutomationPanel"

interface Post {
  id: string; title: string; slug: string; excerpt: string; content: string
  category: string; author: string; status: string; featured_image: string | null
  read_time: string; published_at: string | null; created_at: string
}

const statusColors: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-700", draft: "bg-gray-100 text-gray-600",
}

const emptyForm = { title: "", slug: "", excerpt: "", content: "", category: "News", author: "North Falmouth Pharmacy Team", status: "draft", read_time: "5 min read" }

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    try { const r = await fetch("/api/admin/blog"); const d = await r.json()
      if (r.ok) setPosts(d.posts || [])
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const genSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (imageFile) fd.append("image", imageFile)
      if (editing) fd.append("id", editing.id)

      const r = await fetch("/api/admin/blog", { method: editing ? "PATCH" : "POST", body: fd })
      if (r.ok) {
        setMsg({ ok: true, text: editing ? "Post updated!" : "Post created!" })
        setShowForm(false); setEditing(null); setForm(emptyForm); setImageFile(null); load()
      } else { setMsg({ ok: false, text: "Failed to save" }) }
    } catch { setMsg({ ok: false, text: "Failed to save" }) }
    finally { setSaving(false) }
  }

  const handleEdit = (p: Post) => {
    setEditing(p)
    setForm({ title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content || "", category: p.category, author: p.author, status: p.status, read_time: p.read_time || "5 min read" })
    setShowForm(true)
  }

  // Open the manual editor with a blank article.
  const openNew = () => { setEditing(null); setForm(emptyForm); setImageFile(null); setShowForm(true) }

  const handleToggle = async (p: Post) => {
    const fd = new FormData()
    fd.append("id", p.id)
    fd.append("status", p.status === "published" ? "draft" : "published")
    await fetch("/api/admin/blog", { method: "PATCH", body: fd })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return
    try { const r = await fetch(`/api/admin/blog?id=${id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Deleted" }); load() }
    } catch { setMsg({ ok: false, text: "Failed" }) }
  }

  const list = posts.filter(p => (filter === "all" || p.status === filter) &&
    (!search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.category || "").toLowerCase().includes(search.toLowerCase())))

  const c = { t: posts.length, p: posts.filter(p => p.status === "published").length, d: posts.filter(p => p.status === "draft").length }
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Blog</h1>
            <p className="text-sm text-gray-500">Write a post by hand, or generate one with AI below.</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
            <PenLine className="h-4 w-4" /> Write article
          </button>
        </div>

        {msg && <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button></div>}

        <BlogAutomationPanel onGenerated={() => load()} />

        <div className="mb-6 grid grid-cols-3 gap-4">
          {[{ l: "Total", v: c.t, cl: "text-gray-900" }, { l: "Published", v: c.p, cl: "text-emerald-600" }, { l: "Drafts", v: c.d, cl: "text-gray-500" }].map(s =>
            <div key={s.l} className="rounded-xl border border-emerald-900/10 bg-white p-4 shadow-sm"><p className={`text-2xl font-semibold ${s.cl}`}>{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>)}
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <input type="text" placeholder="Search by title or category..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <div className="flex gap-2">
            {["all", "published", "draft"].map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
        : list.length === 0 ? <div className="rounded-xl border bg-white py-16 text-center"><h3 className="text-lg font-medium mb-2">No posts found</h3><button onClick={() => setShowForm(true)} className="text-emerald-600 font-medium">Write your first article</button></div>
        : <div className="space-y-3">{list.map(p => (
            <div key={p.id} className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start gap-4">
                {p.featured_image && <img src={p.featured_image} alt="" className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{p.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[p.status] || "bg-gray-100"}`}>{p.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-1">{p.excerpt}</p>
                  <p className="mt-2 text-xs text-gray-400">{p.category} · {p.author} · {p.published_at ? fmt(p.published_at) : "Not published"} · /blog/{p.slug}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggle(p)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${p.status === "published" ? "text-gray-600 hover:bg-gray-50" : "text-emerald-600 hover:bg-emerald-50"}`}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
                  <button onClick={() => handleEdit(p)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit">✏️</button>
                  <a href={`/blog/${p.slug}`} target="_blank" className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="View">👁️</a>
                  <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">🗑️</button>
                </div>
              </div>
            </div>))}</div>}
      

      {/* Create/Edit Modal */}
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
        <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editing ? "Edit Article" : "New Article"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title *</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value, slug: editing ? form.slug : genSlug(e.target.value) })} className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Article title" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <div className="flex items-center gap-1"><span className="text-sm text-gray-500">/blog/</span><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="flex-1 rounded-lg border px-3 py-2.5 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm">
                  {["News", "Health Tips", "Pharmacy Updates", "Community", "Medication Management", "Immunizations", "LTC Pharmacy", "Clinical"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Author</label><input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm" /></div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Excerpt</label>
              <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm" rows={2} placeholder="Brief summary shown on the blog listing..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Content * <span className="text-gray-400 font-normal">(supports Markdown: ## headings, - lists, paragraphs)</span></label>
              <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono" rows={12} placeholder="Write your article here..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Featured Image</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700" />
                {editing?.featured_image && !imageFile && <p className="mt-1 text-xs text-gray-400">Current image set — upload new to replace</p>}
              </div>
              <div><label className="mb-1 block text-sm font-medium">Read Time</label><input value={form.read_time} onChange={e => setForm({ ...form, read_time: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="5 min read" /></div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border px-3 py-2.5 text-sm">
                <option value="draft">Draft — Save but don&apos;t publish</option>
                <option value="published">Published — Visible on public blog</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="rounded-lg px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update Article" : "Create Article"}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  )
}
