"use client"
import { useState, useEffect, useRef } from "react"
import { UserPlus, Eye, EyeOff, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react"
import type { TeamMember } from "@/lib/team-members"

const emptyForm = {
  name: "", credentials: "", role: "", slug: "",
  short_bio: "", long_bio: "", expertise: "", tagline: "", visible: true, show_bio_page: true,
}

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      const r = await fetch("/api/admin/team")
      const d = await r.json()
      if (r.ok) setMembers(d.members || [])
      else setMsg({ ok: false, text: d.error || "Failed to load" })
    } catch { setMsg({ ok: false, text: "Failed to load" }) }
    finally { setLoading(false) }
  }

  const genSlug = (s: string) => s.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-")

  const openNew = () => {
    setEditing(null); setForm(emptyForm); setPhotoFile(null); setPhotoPreview(null); setShowForm(true)
  }

  const openEdit = (m: TeamMember) => {
    setEditing(m)
    setForm({
      name: m.name, credentials: m.credentials || "", role: m.role, slug: m.slug,
      short_bio: m.short_bio || "", long_bio: m.long_bio || "",
      expertise: (m.expertise || []).join("\n"), tagline: m.tagline || "", visible: m.visible,
      // Rows saved before this column existed won't have it — default to on
      // (its own not-null default) rather than treating undefined as off.
      show_bio_page: m.show_bio_page !== false,
    })
    setPhotoFile(null); setPhotoPreview(m.photo_url || null)
    setShowForm(true)
  }

  const handlePhotoChange = (f: File | null) => {
    setPhotoFile(f)
    setPhotoPreview(f ? URL.createObjectURL(f) : editing?.photo_url || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (photoFile) fd.append("photo", photoFile)
      if (editing) fd.append("id", editing.id)

      const r = await fetch("/api/admin/team", { method: editing ? "PATCH" : "POST", body: fd })
      const d = await r.json()
      if (r.ok) {
        setMsg({ ok: true, text: editing ? "Team member updated." : "Team member added." })
        setShowForm(false); setEditing(null); setForm(emptyForm); setPhotoFile(null); setPhotoPreview(null)
        load()
      } else {
        setMsg({ ok: false, text: d.error || "Failed to save" })
      }
    } catch { setMsg({ ok: false, text: "Failed to save" }) }
    finally { setSaving(false) }
  }

  const toggleVisible = async (m: TeamMember) => {
    const fd = new FormData()
    fd.append("id", m.id)
    fd.append("visible", String(!m.visible))
    await fetch("/api/admin/team", { method: "PATCH", body: fd })
    load()
  }

  const handleDelete = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.name} from the team page? This can't be undone.`)) return
    try {
      const r = await fetch(`/api/admin/team?id=${m.id}`, { method: "DELETE" })
      if (r.ok) { setMsg({ ok: true, text: "Removed." }); load() }
      else { const d = await r.json(); setMsg({ ok: false, text: d.error || "Failed to remove" }) }
    } catch { setMsg({ ok: false, text: "Failed to remove" }) }
  }

  // Swap display_order with the neighbor above/below — the sidebar order is
  // exactly the public card order, so this is the whole reordering UI.
  const move = async (index: number, dir: -1 | 1) => {
    const target = members[index + dir]
    const current = members[index]
    if (!target) return
    setReordering(current.id)
    try {
      await Promise.all([
        fetch("/api/admin/team", { method: "PATCH", body: toFD({ id: current.id, display_order: target.display_order }) }),
        fetch("/api/admin/team", { method: "PATCH", body: toFD({ id: target.id, display_order: current.display_order }) }),
      ])
      await load()
    } finally { setReordering(null) }
  }
  const toFD = (obj: Record<string, any>) => { const fd = new FormData(); Object.entries(obj).forEach(([k, v]) => fd.append(k, String(v))); return fd }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500">Shown on the About page and each person's own bio page at /team/&lt;slug&gt;.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
          <UserPlus className="h-4 w-4" /> Add team member
        </button>
      </div>

      {msg && (
        <div className={`mb-6 flex items-center justify-between rounded-lg border p-4 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          <span>{msg.text}</span><button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <h3 className="mb-2 text-lg font-medium">No team members yet</h3>
          <button onClick={openNew} className="font-medium text-emerald-600">Add your first team member</button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={m.id} className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start gap-4">
                {m.photo_url ? (
                  <img src={m.photo_url} alt="" className="h-16 w-16 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-700">
                    {m.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{m.name}{m.credentials ? `, ${m.credentials}` : ""}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.visible ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {m.visible ? "Visible" : "Hidden"}
                    </span>
                    {m.visible && m.show_bio_page === false && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700" title="Listed on the About page, but /team/&lt;slug&gt; is not accessible">
                        No bio page
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-emerald-700/80">{m.role}</p>
                  {m.short_bio && <p className="mt-1 text-sm text-gray-500 line-clamp-1">{m.short_bio}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {m.show_bio_page === false ? "No public bio page" : `/team/${m.slug}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0 || !!reordering} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30" title="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === members.length - 1 || !!reordering} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30" title="Move down"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => toggleVisible(m)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title={m.visible ? "Hide from public site" : "Show on public site"}>
                    {m.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(m)} className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                  {m.visible && m.show_bio_page !== false && <a href={`/team/${m.slug}`} target="_blank" className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="View bio page"><ExternalLink className="h-4 w-4" /></a>}
                  <button onClick={() => handleDelete(m)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? "Edit Team Member" : "Add a Team Member"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_140px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Full name *</label>
                      <input required value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : genSlug(e.target.value) })}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Vrushank Patel" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Credentials</label>
                      <input value={form.credentials} onChange={e => setForm({ ...form, credentials: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Pharm.D, RPh" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Role / title *</label>
                    <input required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Owner & Pharmacy Manager" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Slug</label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">/team/</span>
                      <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="flex-1 rounded-lg border px-3 py-2.5 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Photo</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 text-center hover:bg-emerald-50">
                    {photoPreview ? (
                      <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <UserPlus className="h-6 w-6 text-emerald-400" />
                        <span className="px-2 text-xs text-emerald-600">Upload a photo</span>
                      </>
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handlePhotoChange(e.target.files?.[0] || null)} />
                  <p className="mt-1 text-xs text-gray-400">JPG or PNG, under 4MB</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Short bio <span className="font-normal text-gray-400">— one sentence, shown on the About page card</span></label>
                <textarea value={form.short_bio} onChange={e => setForm({ ...form, short_bio: e.target.value })} rows={2}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="A short hook that appears on the card." />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Long bio <span className="font-normal text-gray-400">— shown on their own page, separate paragraphs with a blank line</span></label>
                <textarea value={form.long_bio} onChange={e => setForm({ ...form, long_bio: e.target.value })} rows={6}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder={"First paragraph...\n\nSecond paragraph..."} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Areas of expertise <span className="font-normal text-gray-400">— one per line</span></label>
                  <textarea value={form.expertise} onChange={e => setForm({ ...form, expertise: e.target.value })} rows={4}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder={"Medication therapy management\nImmunizations\nLong-term care"} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Tagline <span className="font-normal text-gray-400">— caps phrase on their bio page</span></label>
                  <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="PROFESSIONAL CARE. PERSONAL TOUCH." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
                  Show on public site
                </label>
                <label className={`flex items-center gap-2 text-sm ${!form.visible ? "opacity-40" : ""}`}>
                  <input type="checkbox" checked={form.show_bio_page} disabled={!form.visible}
                    onChange={e => setForm({ ...form, show_bio_page: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
                  Have a public bio page (/team/&lt;slug&gt;)
                  <span className="font-normal text-gray-400">— uncheck to list them on the About page without a clickable bio</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="rounded-lg px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Save changes" : "Add team member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
