"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Users, Plus, Pencil, Trash2, Loader2, Shield, Key, X, Check } from "lucide-react"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", crm: "CRM / Customers", statements: "Statements",
  "medication-tasks": "Medication Tasks", chats: "Chats", blog: "Blog",
  enrollments: "Enrollments", contacts: "Contacts", "credit-cards": "Credit Cards",
  assistant: "AI Assistant", users: "User Management",
}

interface AdminUser {
  id: string; email: string; name: string; role: string
  allowed_pages: string[]; active: boolean; last_login: string | null; created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [allPages, setAllPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [msg, setMsg] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try { const r = await fetch("/api/admin/users"); const d = await r.json(); setUsers(d.users || []); setAllPages(d.all_pages || []) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load(); fetch("/api/admin/users/me").then(r => r.json()).then(d => setCurrentUser(d.user)).catch(() => {}) }, [])

  const isAdmin = currentUser?.role === "admin"
  const deleteUser = async (u: AdminUser) => {
    if (!confirm("Delete " + u.name + "?")) return
    const r = await fetch("/api/admin/users?id=" + u.id, { method: "DELETE" })
    const d = await r.json()
    if (!r.ok) { setMsg(d.error || "Failed"); return }
    setMsg("User deleted"); load()
  }

  if (!isAdmin && currentUser) return (
    <main className="min-h-screen bg-[#F7F5EF] p-8">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm">
        <Shield className="mx-auto mb-3 h-12 w-12 text-gray-400" />
        <h2 className="text-lg font-semibold">Admin Only</h2>
        <p className="mt-2 text-sm text-gray-500">You don't have permission to manage users.</p>
        <div className="mt-6 text-left"><ChangePasswordForm /></div>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Users className="h-7 w-7" /> User Management</h1>
            <button onClick={() => { setShowModal(true); setEditing(null) }} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#0B7C79]"><Plus className="h-4 w-4" /> Add User</button>
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-6 py-6">
        {msg && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={"flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white " + (u.role === "admin" ? "bg-purple-600" : "bg-[#0B7C79]")}>{u.name[0].toUpperCase()}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{u.name}</h3>
                        <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + (u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600")}>{u.role === "admin" ? "Admin" : "Staff"}</span>
                        {!u.active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Disabled</span>}
                      </div>
                      <p className="text-sm text-gray-500">{u.email}</p>
                      <p className="mt-0.5 text-xs text-gray-400">Last login: {u.last_login ? new Date(u.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(u); setShowModal(true) }} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-[#0B7C79]"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteUser(u)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {u.role !== "admin" ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {u.allowed_pages.length > 0 ? u.allowed_pages.map(p => <span key={p} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{PAGE_LABELS[p] || p}</span>) : <span className="text-xs italic text-gray-400">No pages assigned</span>}
                  </div>
                ) : <p className="mt-2 text-xs text-purple-600">Full access to all pages</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><Key className="h-4 w-4" /> Change My Password</h3>
          <ChangePasswordForm />
        </div>
      </section>
      {showModal && <UserModal user={editing} allPages={allPages} onClose={() => { setShowModal(false); setEditing(null) }} onSaved={m => { setShowModal(false); setEditing(null); setMsg(m); load() }} />}
    </main>
  )
}

function UserModal({ user, allPages, onClose, onSaved }: { user: AdminUser | null; allPages: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const isEdit = Boolean(user)
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState(user?.role || "staff")
  const [pages, setPages] = useState<Set<string>>(new Set(user?.allowed_pages || []))
  const [active, setActive] = useState(user?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const togglePage = (p: string) => setPages(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })

  const submit = async () => {
    if (!name.trim() || (!isEdit && !email.trim())) { setError("Name and email required"); return }
    if (!isEdit && password.length < 6) { setError("Password must be at least 6 characters"); return }
    setSaving(true); setError("")
    try {
      if (isEdit) {
        const body: any = { id: user!.id, name, role, allowed_pages: [...pages], active }
        if (password) body.reset_password = password
        const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!r.ok) { const d = await r.json(); setError(d.error || "Failed"); return }
        onSaved("User updated")
      } else {
        const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, password, role, allowed_pages: [...pages] }) })
        if (!r.ok) { const d = await r.json(); setError(d.error || "Failed"); return }
        onSaved("User created")
      }
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{isEdit ? "Edit User" : "Add New User"}</h2><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-gray-500">Name *</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-500">Email *</label><input value={email} onChange={e => setEmail(e.target.value)} disabled={isEdit} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-gray-500">{isEdit ? "Reset Password" : "Password *"}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-500">Role</label><div className="flex gap-2"><button onClick={() => setRole("staff")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-medium " + (role === "staff" ? "bg-[#0B7C79] text-white" : "border border-gray-200 text-gray-600")}>Staff</button><button onClick={() => setRole("admin")} className={"flex-1 rounded-lg px-3 py-2 text-sm font-medium " + (role === "admin" ? "bg-purple-600 text-white" : "border border-gray-200 text-gray-600")}>Admin</button></div></div>
          </div>
          {role === "staff" && <div><label className="mb-2 block text-xs font-medium text-gray-500">Assign Pages</label><div className="grid grid-cols-2 gap-1.5">{allPages.filter(p => p !== "users").map(p => <button key={p} onClick={() => togglePage(p)} className={"flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium " + (pages.has(p) ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "border border-gray-200 text-gray-500 hover:bg-gray-50")}>{pages.has(p) ? <Check className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5" />}{PAGE_LABELS[p] || p}</button>)}</div></div>}
          {role === "admin" && <p className="text-xs text-purple-600">Admins have full access to all pages.</p>}
          {isEdit && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Account active</label>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button><button onClick={submit} disabled={saving} className="rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving..." : isEdit ? "Save Changes" : "Create User"}</button></div>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const [pw, setPw] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const change = async () => {
    if (pw.length < 6) { setMsg("Min 6 characters"); return }
    setSaving(true); setMsg("")
    try { const r = await fetch("/api/admin/users/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_password: pw }) }); const d = await r.json(); if (r.ok) { setMsg("Password updated"); setPw("") } else setMsg(d.error || "Failed") }
    catch { setMsg("Network error") } finally { setSaving(false) }
  }
  return <div className="flex items-end gap-2"><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password (min 6)" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" /><button onClick={change} disabled={saving} className="rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white">{saving ? "..." : "Update"}</button>{msg && <span className="text-xs text-gray-600">{msg}</span>}</div>
}
