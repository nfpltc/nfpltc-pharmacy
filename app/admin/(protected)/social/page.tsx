"use client"

import { useEffect, useRef, useState } from "react"
import {
  Share2, Sparkles, Image as ImageIcon, X, Send, Loader2,
  Instagram, Facebook, Linkedin, CheckCircle2, AlertCircle, Clock, FileText,
  Upload, LayoutTemplate, Wand2,
} from "lucide-react"

type Platform = "facebook" | "instagram" | "linkedin"
type ImgSource = "upload" | "template" | "ai"
type HealthTemplate = "hero_photo" | "tip_card" | "food_as_medicine" | "quote_card"
type PhotoEngine = "stock" | "ai"
type Post = {
  id: string
  caption: string
  image_url: string | null
  platforms: string[]
  status: "draft" | "posted" | "failed"
  created_at: string
}

const PLATFORMS: { id: Platform; label: string; icon: any }[] = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
]

const TEMPLATES: { id: HealthTemplate; label: string }[] = [
  { id: "hero_photo", label: "Photo headline" },
  { id: "tip_card", label: "Wellness tips" },
  { id: "food_as_medicine", label: "Food as medicine" },
  { id: "quote_card", label: "Quote / announcement" },
]

const IMG_SOURCES: { id: ImgSource; label: string; icon: any }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "template", label: "Template", icon: LayoutTemplate },
  { id: "ai", label: "AI image", icon: Wand2 },
]

export default function SocialPage() {
  const [caption, setCaption] = useState("")
  const [selected, setSelected] = useState<Platform[]>(["facebook", "instagram"])
  const [topic, setTopic] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [genUrl, setGenUrl] = useState<string | null>(null)      // generated + re-hosted image URL
  const [imgSource, setImgSource] = useState<ImgSource>("upload")
  const [template, setTemplate] = useState<HealthTemplate>("hero_photo")
  const [photoEngine, setPhotoEngine] = useState<PhotoEngine>("stock")
  const [imgTopic, setImgTopic] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [genLoading, setGenLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [history, setHistory] = useState<Post[]>([])
  const [configured, setConfigured] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/social/post")
      if (res.ok) {
        const data = await res.json()
        setHistory(Array.isArray(data.posts) ? data.posts : [])
        setConfigured(data.configured !== false)
      }
    } catch { /* ignore */ }
  }

  function togglePlatform(p: Platform) {
    setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setGenUrl(null)
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  function clearImage() {
    setImageFile(null)
    setGenUrl(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  // Generate an image (HTML template or AI), re-hosted in Supabase, and preview it.
  async function generateImage() {
    const payload =
      imgSource === "ai"
        ? { mode: "ai", prompt: aiPrompt }
        : { mode: "template", template, topic: imgTopic, photo: photoEngine }
    if (imgSource === "ai" ? !aiPrompt.trim() : !imgTopic.trim()) {
      setMsg({ type: "error", text: "Describe the image first." }); return
    }
    setGenLoading(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.image_url) {
        setImageFile(null)
        setGenUrl(data.image_url)
        setImagePreview(data.image_url)
        if (data.warning) setMsg({ type: "info", text: data.warning })
      } else {
        setMsg({ type: "error", text: data.error || "Could not create image." })
      }
    } catch {
      setMsg({ type: "error", text: "Could not reach the image service." })
    } finally {
      setGenLoading(false)
    }
  }

  async function generateCaption() {
    if (!topic.trim()) { setMsg({ type: "error", text: "Type a topic for the AI first." }); return }
    setGenerating(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: topic, platform: selected[0] || "instagram" }),
      })
      const data = await res.json()
      if (res.ok) setCaption(data.caption)
      else setMsg({ type: "error", text: data.error || "Could not generate." })
    } catch {
      setMsg({ type: "error", text: "Could not reach the AI service." })
    } finally {
      setGenerating(false)
    }
  }

  async function publish() {
    setMsg(null)
    if (!caption.trim()) { setMsg({ type: "error", text: "Please write a caption." }); return }
    if (selected.length === 0) { setMsg({ type: "error", text: "Pick at least one platform." }); return }
    if (selected.includes("instagram") && !imageFile && !genUrl) {
      setMsg({ type: "error", text: "Instagram needs an image. Add one, or uncheck Instagram." }); return
    }
    setPosting(true)
    try {
      const form = new FormData()
      form.set("caption", caption)
      form.set("platforms", selected.join(","))
      if (imageFile) form.set("image", imageFile)
      else if (genUrl) form.set("image_url", genUrl)

      const res = await fetch("/api/admin/social/post", { method: "POST", body: form })
      const data = await res.json()
      if (res.ok) {
        setMsg({ type: data.draft ? "info" : "success", text: data.message || "Posted!" })
        setCaption(""); setTopic(""); setImgTopic(""); setAiPrompt(""); clearImage()
        loadHistory()
      } else {
        setMsg({ type: "error", text: data.error || "Failed to post." })
      }
    } catch {
      setMsg({ type: "error", text: "Failed to post." })
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700">
          <Share2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Social Media</h1>
          <p className="text-sm text-gray-500">Compose a post, let AI help, and publish to your channels.</p>
        </div>
      </div>

      {!configured && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No social provider is connected yet. Posts will be saved as <b>drafts</b>. Set <code className="rounded bg-amber-100 px-1">SOCIAL_WEBHOOK_URL</code> (your Make.com webhook) to publish automatically.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Composer */}
        <div className="lg:col-span-3 space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {msg && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : msg.type === "info" ? "bg-blue-50 text-blue-800 border border-blue-200"
              : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {msg.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Platforms */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Post to</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label, icon: Icon }) => {
                const on = selected.includes(id)
                return (
                  <button key={id} type="button" onClick={() => togglePlatform(id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      on ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* AI helper */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
              <Sparkles className="h-4 w-4" /> AI caption helper
            </label>
            <div className="flex gap-2">
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. flu shots now available, walk-ins welcome"
                onKeyDown={(e) => e.key === "Enter" && generateCaption()}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button" onClick={generateCaption} disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate
              </button>
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7}
              placeholder="Write your post, or generate one above…"
              className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p className="mt-1 text-right text-xs text-gray-400">{caption.length} characters</p>
          </div>

          {/* Image */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Image {selected.includes("instagram") && <span className="text-red-500">(required for Instagram)</span>}</label>

            {imagePreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" className="max-h-56 rounded-lg border border-gray-200" />
                <button type="button" onClick={clearImage}
                  className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 p-3">
                {/* Source tabs */}
                <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-1">
                  {IMG_SOURCES.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setImgSource(id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        imgSource === id ? "bg-emerald-600 text-white" : "text-gray-500 hover:text-gray-800"
                      }`}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>

                {imgSource === "upload" && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-700">
                    <ImageIcon className="h-4 w-4" /> Choose an image file
                  </button>
                )}

                {imgSource === "template" && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((t) => (
                        <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            template === t.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-500"
                          }`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {template === "hero_photo" && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">Photo:</span>
                        {(["stock", "ai"] as PhotoEngine[]).map((p) => (
                          <button key={p} type="button" onClick={() => setPhotoEngine(p)}
                            className={`rounded-full border px-3 py-1 font-medium ${
                              photoEngine === p ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-500"
                            }`}>
                            {p === "stock" ? "Stock photo" : "AI photo"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input value={imgTopic} onChange={(e) => setImgTopic(e.target.value)}
                        placeholder="e.g. foods that help lower blood pressure"
                        onKeyDown={(e) => e.key === "Enter" && generateImage()}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <GenerateBtn loading={genLoading} onClick={generateImage} />
                    </div>
                    <p className="text-xs text-gray-400">AI writes the text from your topic and pairs it with a matching photo, then renders a branded 1080×1350 graphic.</p>
                  </div>
                )}

                {imgSource === "ai" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. a heart made of fresh vegetables, studio lighting"
                        onKeyDown={(e) => e.key === "Enter" && generateImage()}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <GenerateBtn loading={genLoading} onClick={generateImage} />
                    </div>
                    <p className="text-xs text-gray-400">Photorealistic AI image (fal.ai Flux).</p>
                  </div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          </div>

          {/* Publish */}
          <button type="button" onClick={publish} disabled={posting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
            {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {posting ? "Publishing…" : configured ? "Publish" : "Save as draft"}
          </button>
        </div>

        {/* History */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Recent posts</h2>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              <Share2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Nothing posted yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {history.map((p) => (
                <li key={p.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-start gap-2">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800">{p.caption}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <StatusBadge status={p.status} />
                        <span>{p.platforms.join(", ")}</span>
                        <span>· {new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Create
    </button>
  )
}

function StatusBadge({ status }: { status: Post["status"] }) {
  const map = {
    posted: { icon: CheckCircle2, cls: "text-emerald-600", label: "Posted" },
    draft: { icon: FileText, cls: "text-blue-500", label: "Draft" },
    failed: { icon: AlertCircle, cls: "text-red-500", label: "Failed" },
  } as const
  const { icon: Icon, cls, label } = map[status] ?? { icon: Clock, cls: "text-gray-400", label: status }
  return <span className={`inline-flex items-center gap-1 font-medium ${cls}`}><Icon className="h-3 w-3" />{label}</span>
}
