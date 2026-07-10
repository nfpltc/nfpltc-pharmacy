"use client"

import { useEffect, useRef, useState } from "react"
import {
  Linkedin, Twitter, Instagram, Sparkles, Wand2, Image as ImageIcon, Send,
  Clock, CalendarClock, Loader2, Trash2, RefreshCw, Save, Share2, AlertCircle,
  CheckCircle2, Play, FolderOpen, Upload, ZoomIn, X,
} from "lucide-react"

type Platform = "linkedin" | "x" | "instagram"
type Channel = { id: string; name: string; service: string; platform: string; avatar?: string }
type QueueItem = {
  id: string; text: string; platform: string; channel_id: string; channel_name?: string
  image_url?: string; due_at: string; status: string; error?: string; sent_at?: string; created_at?: string
}
type Msg = { type: "success" | "error" | "info"; text: string } | null

const PLATFORMS: { id: Platform; label: string; icon: any; limit: number }[] = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, limit: 3000 },
  { id: "x", label: "X", icon: Twitter, limit: 270 },
  { id: "instagram", label: "Instagram", icon: Instagram, limit: 2000 },
]

const REWRITES: { label: string; instr: string }[] = [
  { label: "Shorter", instr: "Make it noticeably shorter and punchier." },
  { label: "Hook line", instr: "Rewrite the opening as a scroll-stopping hook line, keep the rest." },
  { label: "Story", instr: "Rewrite as a short, warm personal story." },
  { label: "Hot take", instr: "Rewrite as one bold, sharp hot take." },
  { label: "Add CTA", instr: "Add a clear question CTA at the end." },
  { label: "Warmer", instr: "Make the tone warmer and more human." },
]

const TONES = ["Warm & friendly", "Professional", "Playful", "Inspirational", "Educational"]
const DRAFTS_KEY = "nfp_social_drafts"

// Downscale an image file in the browser (max 1600px long edge, JPEG) so uploads
// stay small and under Vercel's request-body limit, and are right-sized for social.
async function downscaleImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  )
}

export default function SocialEditor() {
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState(TONES[0])
  const [composing, setComposing] = useState(false)
  const [texts, setTexts] = useState<Record<Platform, string>>({ linkedin: "", x: "", instagram: "" })

  const [imageUrl, setImageUrl] = useState("")
  const [imageCredit, setImageCredit] = useState<{ name: string; link?: string } | null>(null)
  const [imageQuery, setImageQuery] = useState("")
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageProvider, setImageProvider] = useState<"auto" | "fal" | "unsplash">("auto")
  const [imgLoading, setImgLoading] = useState(false)

  // Saved image library (uploads + kept AI/Unsplash images)
  const [library, setLibrary] = useState<{ id: string; url: string; filename?: string; source?: string }[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [captioning, setCaptioning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [channels, setChannels] = useState<Channel[]>([])
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<Platform, string>>({ linkedin: "", x: "", instagram: "" })
  const [scheduleAt, setScheduleAt] = useState<Record<Platform, string>>({ linkedin: "", x: "", instagram: "" })
  const [igType, setIgType] = useState<"post" | "story" | "reel">("post")
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [rewriting, setRewriting] = useState<Platform | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [drafts, setDrafts] = useState<any[]>([])

  useEffect(() => { loadChannels(); loadQueue(); loadLibrary(); setDrafts(readDrafts()) }, [])

  // Story/Reel need media — fall back to a normal post when the image is cleared.
  useEffect(() => { if (!imageUrl && igType !== "post") setIgType("post") }, [imageUrl, igType])

  async function loadChannels() {
    try {
      const res = await fetch("/api/admin/buffer/profiles")
      const data = await res.json()
      if (res.ok) {
        const ch: Channel[] = data.channels || []
        setChannels(ch)
        setChannelsError(null)
        // auto-select the first channel for each platform
        setSelected((cur) => {
          const next = { ...cur }
          for (const p of PLATFORMS) {
            if (!next[p.id]) next[p.id] = ch.find((c) => c.platform === p.id)?.id || ""
          }
          return next
        })
      } else setChannelsError(data.error || "Could not load Buffer channels.")
    } catch { setChannelsError("Could not reach Buffer.") }
  }

  async function loadQueue() {
    try {
      const res = await fetch("/api/admin/social/queue")
      if (res.ok) setQueue((await res.json()).items || [])
    } catch { /* ignore */ }
  }

  async function compose() {
    if (!topic.trim()) { setMsg({ type: "error", text: "Enter a topic first." }); return }
    setComposing(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/compose-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone }),
      })
      const d = await res.json()
      if (res.ok) {
        setTexts({ linkedin: d.linkedin, x: d.x, instagram: d.instagram })
        setImageQuery(d.image_query || ""); setImagePrompt(d.image_prompt || "")
        setMsg({ type: "success", text: "Drafted 3 platform posts. Generate an image, then post or queue." })
      } else setMsg({ type: "error", text: d.error || "Compose failed." })
    } catch { setMsg({ type: "error", text: "Compose failed." }) }
    finally { setComposing(false) }
  }

  async function genImage() {
    if (!imagePrompt && !imageQuery) { setMsg({ type: "error", text: "Compose first, or type an image query." }); return }
    setImgLoading(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, query: imageQuery, provider: imageProvider }),
      })
      const d = await res.json()
      if (res.ok) {
        setImageUrl(d.url)
        setImageCredit(d.credit ? { name: d.credit, link: d.creditLink } : null)
      } else setMsg({ type: "error", text: d.error || "Image generation failed." })
    } catch { setMsg({ type: "error", text: "Image generation failed." }) }
    finally { setImgLoading(false) }
  }

  // ── Saved image library ────────────────────────────────────────────────
  async function loadLibrary() {
    try {
      const res = await fetch("/api/admin/social/library")
      const d = await res.json()
      if (res.ok) setLibrary(d.images || [])
    } catch { /* ignore */ }
  }

  // Upload from the admin's device. We downscale in the browser first so big
  // phone photos stay under Vercel's request limit and are right-sized for social.
  async function uploadImage(file: File) {
    setUploading(true); setMsg(null)
    try {
      const blob = await downscaleImage(file)
      const fd = new FormData()
      fd.append("file", blob, (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg")
      const res = await fetch("/api/admin/social/library", { method: "POST", body: fd })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: "error", text: d.error || "Upload failed." }); return }
      setImageUrl(d.url); setImageCredit(null)
      loadLibrary()
      setMsg({ type: "success", text: "Image uploaded and saved to your library." })
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Could not process that image." })
    } finally { setUploading(false) }
  }

  // Persist the current image (e.g. a generated AI/Unsplash one) into the library.
  async function saveCurrentToLibrary() {
    if (!imageUrl) return
    setUploading(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/library", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl, source: imageProvider === "unsplash" ? "unsplash" : "ai" }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: "error", text: d.error || "Could not save image." }); return }
      loadLibrary()
      setMsg({ type: "success", text: "Saved to your library." })
    } catch { setMsg({ type: "error", text: "Could not save image." }) }
    finally { setUploading(false) }
  }

  async function deleteLibraryImage(id: string) {
    try { await fetch(`/api/admin/social/library?id=${id}`, { method: "DELETE" }); loadLibrary() } catch { /* ignore */ }
  }

  // Write per-platform posts FROM the current image (vision AI).
  async function captionFromImage() {
    if (!imageUrl) return
    setCaptioning(true); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/caption-from-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, tone }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: "error", text: d.error || "Could not read the image." }); return }
      setTexts({ linkedin: d.linkedin, x: d.x, instagram: d.instagram })
      setMsg({ type: "success", text: "Wrote 3 posts from your image — review and post." })
    } catch { setMsg({ type: "error", text: "Could not generate from image." }) }
    finally { setCaptioning(false) }
  }

  async function rewrite(platform: Platform, instr: string) {
    if (!texts[platform].trim()) return
    setRewriting(platform); setMsg(null)
    try {
      const res = await fetch("/api/admin/social-rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts[platform], instruction: instr, platform }),
      })
      const d = await res.json()
      if (res.ok) setTexts((t) => ({ ...t, [platform]: d.text }))
      else setMsg({ type: "error", text: d.error || "Rewrite failed." })
    } catch { setMsg({ type: "error", text: "Rewrite failed." }) }
    finally { setRewriting(null) }
  }

  function validate(platform: Platform): string | null {
    if (!texts[platform].trim()) return "Nothing to post."
    if (!selected[platform]) return `No ${platform === "x" ? "X" : platform} channel connected in Buffer.`
    if (platform === "instagram" && !imageUrl) return "Instagram needs an image."
    return null
  }

  async function postNow(platform: Platform) {
    const err = validate(platform)
    if (err) { setMsg({ type: "error", text: err }); return }
    setBusy((b) => ({ ...b, [platform]: true })); setMsg(null)
    try {
      const res = await fetch("/api/admin/buffer/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected[platform], text: texts[platform], imageUrl: imageUrl || undefined, mode: "shareNow", instagramType: platform === "instagram" ? igType : undefined }),
      })
      const d = await res.json()
      setMsg(res.ok
        ? { type: "success", text: `Posted to ${platform === "x" ? "X" : platform}.` }
        : { type: "error", text: d.error || "Post failed." })
    } catch { setMsg({ type: "error", text: "Post failed." }) }
    finally { setBusy((b) => ({ ...b, [platform]: false })) }
  }

  async function enqueue(platform: Platform, dueAt: string) {
    const err = validate(platform)
    if (err) { setMsg({ type: "error", text: err }); return }
    const ch = channels.find((c) => c.id === selected[platform])
    setBusy((b) => ({ ...b, [platform]: true })); setMsg(null)
    try {
      const res = await fetch("/api/admin/social/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", items: [{
          text: texts[platform], platform, channel_id: selected[platform],
          channel_name: ch?.name, image_url: imageUrl || null, due_at: dueAt,
          instagram_type: platform === "instagram" ? igType : null,
        }] }),
      })
      const d = await res.json()
      if (res.ok) { setMsg({ type: "success", text: "Added to queue." }); loadQueue() }
      else setMsg({ type: "error", text: d.error || "Queue failed." })
    } catch { setMsg({ type: "error", text: "Queue failed." }) }
    finally { setBusy((b) => ({ ...b, [platform]: false })) }
  }

  const inOneMinute = () => new Date(Date.now() + 60_000).toISOString()

  async function postAll() {
    for (const p of PLATFORMS) if (texts[p.id].trim() && selected[p.id] && !(p.id === "instagram" && !imageUrl)) await postNow(p.id)
  }
  async function queueAll() {
    for (const p of PLATFORMS) if (texts[p.id].trim() && selected[p.id] && !(p.id === "instagram" && !imageUrl)) await enqueue(p.id, inOneMinute())
  }

  async function queueAction(action: string, id?: string) {
    if (action === "process-due") setProcessing(true)
    try {
      const res = await fetch("/api/admin/social/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ type: "error", text: d.error || "Queue action failed." })
      else if (action === "process-due") setMsg({ type: "info", text: `Processed ${d.processed}: ${d.sent} sent, ${d.failed} failed.` })
      loadQueue()
    } finally { setProcessing(false) }
  }

  // Drafts (localStorage)
  function readDrafts(): any[] { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]") } catch { return [] } }
  function saveDraft() {
    if (!topic.trim() && !texts.linkedin) return
    const d = { id: String(Date.now()), topic, texts, imageUrl, imageQuery, imagePrompt }
    const next = [d, ...readDrafts()].slice(0, 20)
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(next)); setDrafts(next)
    setMsg({ type: "success", text: "Draft saved." })
  }
  function loadDraft(d: any) {
    setTopic(d.topic || ""); setTexts(d.texts || { linkedin: "", x: "", instagram: "" })
    setImageUrl(d.imageUrl || ""); setImageQuery(d.imageQuery || ""); setImagePrompt(d.imagePrompt || "")
    setImageCredit(null)
  }
  function deleteDraft(id: string) {
    const next = readDrafts().filter((x: any) => x.id !== id)
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(next)); setDrafts(next)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><Share2 className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Social Media Editor</h1>
            <p className="text-sm text-gray-500">Draft per-platform posts with AI, add an image, and post or schedule via Buffer.</p>
          </div>
        </div>
        <button onClick={saveDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><Save className="h-4 w-4" /> Save draft</button>
      </div>

      {channelsError && (
        <Banner type="error" text={`Buffer: ${channelsError} Add a connectors row { id:'buffer', bearer_token } in Supabase.`} />
      )}
      {msg && <Banner type={msg.type} text={msg.text} />}

      {/* Compose */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. why medication reviews matter for seniors"
              onKeyDown={(e) => e.key === "Enter" && compose()}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={compose} disabled={composing} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
            {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI compose
          </button>
        </div>

        {/* Image row */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="flex flex-wrap items-start gap-3">
            {imageUrl ? (
              <button type="button" onClick={() => setLightboxUrl(imageUrl)} title="View full image"
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-20 w-20 object-cover" />
                <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><ZoomIn className="h-5 w-5" /></span>
              </button>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400"><ImageIcon className="h-5 w-5" /></div>
            )}
            <div className="flex-1 min-w-[220px] space-y-2">
              <input value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} placeholder="image search words (Unsplash)"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="AI image prompt (fal.ai)"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {imageCredit && <p className="text-[11px] text-gray-400">Photo: {imageCredit.name}{imageCredit.link ? " · Unsplash" : ""}</p>}
            </div>
            <div className="flex flex-col gap-2">
              {/* Create with AI / find on Unsplash */}
              <div className="flex items-center gap-2">
                <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value as any)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
                  <option value="auto">Auto</option><option value="fal">AI (fal.ai)</option><option value="unsplash">Unsplash</option>
                </select>
                <button onClick={genImage} disabled={imgLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">
                  {imgLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Image
                </button>
              </div>
              {/* Upload your own / pick from saved */}
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = "" }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
                </button>
                <button onClick={() => { if (!showLibrary) loadLibrary(); setShowLibrary((v) => !v) }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <FolderOpen className="h-3.5 w-3.5" /> Saved ({library.length})
                </button>
                {imageUrl && (
                  <button onClick={captionFromImage} disabled={captioning} title="Write posts based on this image"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60">
                    {captioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Post from image
                  </button>
                )}
                {imageUrl && (
                  <button onClick={saveCurrentToLibrary} disabled={uploading} title="Save this image to your library"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                )}
                {imageUrl && <button onClick={() => { setImageUrl(""); setImageCredit(null) }} title="Remove image" className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          </div>

          {/* Saved library gallery */}
          {showLibrary && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              {library.length === 0 ? (
                <p className="text-xs text-gray-400">No saved images yet. Upload one, or generate/find an image and click <span className="font-medium">Save</span>.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {library.map((img) => (
                    <div key={img.id} className="group relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.filename || ""} onClick={() => { setImageUrl(img.url); setImageCredit(null) }}
                        className={`h-16 w-16 cursor-pointer rounded-lg object-cover ring-2 ${imageUrl === img.url ? "ring-emerald-500" : "ring-transparent hover:ring-gray-300"}`} />
                      <button onClick={() => setLightboxUrl(img.url)} title="View full image"
                        className="absolute -left-1.5 -top-1.5 hidden rounded-full bg-white p-0.5 text-gray-600 shadow ring-1 ring-gray-200 group-hover:block">
                        <ZoomIn className="h-3 w-3" />
                      </button>
                      <button onClick={() => deleteLibraryImage(img.id)} title="Delete from library"
                        className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-white p-0.5 text-red-500 shadow ring-1 ring-gray-200 group-hover:block">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full-image lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <button onClick={() => setLightboxUrl(null)} title="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}

      {/* Platform cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLATFORMS.map((p) => (
          <PlatformCard
            key={p.id} p={p} text={texts[p.id]} onText={(v) => setTexts((t) => ({ ...t, [p.id]: v }))}
            channels={channels.filter((c) => c.platform === p.id)} selected={selected[p.id]}
            onSelect={(id) => setSelected((s) => ({ ...s, [p.id]: id }))}
            rewriting={rewriting === p.id} onRewrite={(instr) => rewrite(p.id, instr)}
            busy={!!busy[p.id]} onPostNow={() => postNow(p.id)}
            onQueue={() => enqueue(p.id, inOneMinute())}
            scheduleValue={scheduleAt[p.id]} onSchedule={(v) => setScheduleAt((s) => ({ ...s, [p.id]: v }))}
            onScheduleSubmit={() => { const v = scheduleAt[p.id]; if (!v) { setMsg({ type: "error", text: "Pick a date & time." }); return } enqueue(p.id, new Date(v).toISOString()) }}
            igType={igType} onIgType={(v) => setIgType(v as "post" | "story" | "reel")} hasImage={!!imageUrl}
          />
        ))}
      </div>

      {/* Batch footer */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <span className="mr-auto text-sm text-gray-500">Post everything at once:</span>
        <button onClick={queueAll} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><Clock className="h-4 w-4" /> Queue all</button>
        <button onClick={postAll} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"><Send className="h-4 w-4" /> Post all now</button>
      </div>

      {/* Queue + drafts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Queue ({queue.filter((q) => q.status === "pending").length} pending)</h2>
            <div className="flex gap-2">
              <button onClick={loadQueue} className="text-gray-400 hover:text-gray-700"><RefreshCw className="h-4 w-4" /></button>
              <button onClick={() => queueAction("process-due")} disabled={processing} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Process due
              </button>
            </div>
          </div>
          {queue.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Queue is empty.</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((q) => (
                <li key={q.id} className="flex items-start gap-3 border-b border-gray-100 pb-2 last:border-0">
                  {q.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800">{q.text}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <QueueStatus status={q.status} />
                      <span className="uppercase">{q.platform}</span>
                      <span>· {new Date(q.due_at).toLocaleString()}</span>
                      {q.error && <span className="text-red-500">· {q.error.slice(0, 40)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {q.status !== "sent" && <button onClick={() => queueAction("post-now", q.id)} title="Post now" className="text-emerald-600 hover:text-emerald-800"><Send className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => queueAction("delete", q.id)} title="Delete" className="text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><FolderOpen className="h-4 w-4" /> Drafts</h2>
          {drafts.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">No saved drafts.</p> : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 border-b border-gray-100 pb-2 last:border-0">
                  <button onClick={() => loadDraft(d)} className="min-w-0 flex-1 truncate text-left text-sm text-gray-700 hover:text-emerald-700">{d.topic || "(untitled)"}</button>
                  <button onClick={() => deleteDraft(d.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function PlatformCard(props: {
  p: { id: Platform; label: string; icon: any; limit: number }
  text: string; onText: (v: string) => void
  channels: Channel[]; selected: string; onSelect: (id: string) => void
  rewriting: boolean; onRewrite: (instr: string) => void
  busy: boolean; onPostNow: () => void; onQueue: () => void
  scheduleValue: string; onSchedule: (v: string) => void; onScheduleSubmit: () => void
  igType?: string; onIgType?: (v: string) => void; hasImage?: boolean
}) {
  const { p, text, channels, selected, busy } = props
  const Icon = p.icon
  const over = text.length > p.limit
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"><Icon className="h-4 w-4 text-emerald-700" /> {p.label}</span>
        <span className={`text-xs tabular-nums ${over ? "text-red-500 font-semibold" : "text-gray-400"}`}>{text.length}/{p.limit}</span>
      </div>

      <select value={selected} onChange={(e) => props.onSelect(e.target.value)} className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
        {channels.length === 0 ? <option value="">No channel connected</option> : channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {p.id === "instagram" && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">Post as</span>
          {["post", "story", "reel"].map((t) => {
            const disabled = t !== "post" && !props.hasImage
            return (
              <button key={t} type="button" disabled={disabled}
                onClick={() => props.onIgType?.(t)}
                title={disabled ? "Add an image or video first" : undefined}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${props.igType === t ? "bg-emerald-700 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}>
                {t}
              </button>
            )
          })}
        </div>
      )}

      <textarea value={text} onChange={(e) => props.onText(e.target.value)} rows={7}
        placeholder={`${p.label} post…`}
        className="w-full flex-1 resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />

      <div className="mt-2 flex flex-wrap gap-1">
        {REWRITES.map((r) => (
          <button key={r.label} onClick={() => props.onRewrite(r.instr)} disabled={props.rewriting || !text.trim()}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40">
            {props.rewriting ? "…" : r.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={props.onPostNow} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post now
        </button>
        <button onClick={props.onQueue} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60" title="Queue in 1 minute"><Clock className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input type="datetime-local" value={props.scheduleValue} onChange={(e) => props.onSchedule(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px]" />
        <button onClick={props.onScheduleSubmit} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-60"><CalendarClock className="h-3.5 w-3.5" /> Schedule</button>
      </div>
    </div>
  )
}

function Banner({ type, text }: { type: "success" | "error" | "info"; text: string }) {
  const cls = type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : type === "info" ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-red-50 text-red-700 border-red-200"
  const Icon = type === "success" ? CheckCircle2 : AlertCircle
  return <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${cls}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{text}</span></div>
}

function QueueStatus({ status }: { status: string }) {
  const map: Record<string, string> = { pending: "text-amber-600", sent: "text-emerald-600", failed: "text-red-600" }
  return <span className={`font-medium uppercase ${map[status] || "text-gray-400"}`}>{status}</span>
}
