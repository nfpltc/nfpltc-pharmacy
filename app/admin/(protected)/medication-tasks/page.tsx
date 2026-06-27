"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Pill, Plus, X, Loader2, CheckCircle2, Clock, Ban, Trash2, Mail, Users } from "lucide-react"

interface Recipient { email: string; name?: string; notified_at?: string; clicked_at?: string }
interface Task {
  id: string
  patient_name: string
  patient_account: string | null
  medication: string
  instructions: string | null
  priority: string
  status: string
  created_at: string
  completed_at: string | null
  completed_by: string | null
  completed_via: string | null
  recipients: Recipient[]
}

export default function MedicationTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [counts, setCounts] = useState({ pending: 0, completed: 0, cancelled: 0 })
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDefaults, setShowDefaults] = useState(false)
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/medication-tasks?status=${filter}`)
      const d = await r.json()
      if (r.ok) { setTasks(d.tasks || []); setCounts(d.counts || counts) }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filter]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const markComplete = async (id: string) => {
    const r = await fetch("/api/admin/medication-tasks", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "complete" }),
    })
    if (r.ok) { setMsg("Marked completed ✓"); load() }
  }
  const cancelTask = async (id: string) => {
    if (!confirm("Cancel this task?")) return
    const r = await fetch("/api/admin/medication-tasks", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel" }),
    })
    if (r.ok) { setMsg("Task cancelled"); load() }
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-white md:text-3xl">
                <Pill className="h-7 w-7" /> Medication Tasks
              </h1>
              <p className="mt-1 text-sm text-white/85">Assign medication tasks and track completion.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDefaults(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25">
                <Users className="h-4 w-4" /> Default Recipients
              </button>
              <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#0B7C79] hover:bg-gray-50">
                <Plus className="h-4 w-4" /> New Task
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-6">
        {msg && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            <span>{msg}</span><button onClick={() => setMsg("")}>×</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-3 gap-4">
          {[
            { l: "Pending", v: counts.pending, cl: "text-amber-600", f: "pending" },
            { l: "Completed", v: counts.completed, cl: "text-emerald-600", f: "completed" },
            { l: "Cancelled", v: counts.cancelled, cl: "text-gray-500", f: "cancelled" },
          ].map(s => (
            <button key={s.l} onClick={() => setFilter(s.f)}
              className={`rounded-xl border bg-white p-4 text-left ${filter === s.f ? "border-[#0B7C79] ring-1 ring-[#0B7C79]" : "border-gray-200"}`}>
              <div className={`text-2xl font-bold ${s.cl}`}>{s.v}</div>
              <div className="text-sm text-gray-500">{s.l}</div>
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">No {filter} tasks.</div>
        ) : (
          <div className="space-y-3">
            {tasks.map(t => <TaskCard key={t.id} t={t} onComplete={() => markComplete(t.id)} onCancel={() => cancelTask(t.id)} />)}
          </div>
        )}
      </section>

      {showForm && <NewTaskModal onClose={() => setShowForm(false)} onCreated={(m) => { setShowForm(false); setMsg(m); setFilter("pending"); load() }} />}
      {showDefaults && <DefaultsModal onClose={() => setShowDefaults(false)} />}
    </main>
  )
}

function TaskCard({ t, onComplete, onCancel }: { t: Task; onComplete: () => void; onCancel: () => void }) {
  const clicked = t.recipients?.filter(r => r.clicked_at).length || 0
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {t.priority === "urgent" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Urgent</span>}
            <StatusBadge status={t.status} />
          </div>
          <h3 className="mt-1.5 font-semibold text-gray-900">{t.patient_name}{t.patient_account ? ` · ${t.patient_account}` : ""}</h3>
          <p className="text-sm text-gray-700"><span className="text-gray-500">Medication:</span> {t.medication}</p>
          {t.instructions && <p className="mt-0.5 text-sm text-gray-600"><span className="text-gray-500">Instructions:</span> {t.instructions}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {t.recipients?.length || 0} notified</span>
            {clicked > 0 && <span className="text-emerald-600">{clicked} opened the link</span>}
            <span>{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </div>

          {t.status === "completed" && (
            <p className="mt-2 text-xs text-emerald-600">
              ✓ Completed by {t.completed_by}{t.completed_via === "link" ? " (via email link)" : " (manually)"}
              {t.completed_at ? ` · ${new Date(t.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          )}
        </div>

        {t.status === "pending" && (
          <div className="flex gap-2">
            <button onClick={onComplete} className="inline-flex items-center gap-1 rounded-lg bg-[#0B7C79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a6b68]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
            </button>
            <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Ban className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Completed</span>
  if (status === "cancelled") return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"><Ban className="h-3 w-3" /> Cancelled</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"><Clock className="h-3 w-3" /> Pending</span>
}

function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [patient, setPatient] = useState("")
  const [account, setAccount] = useState("")
  const [medication, setMedication] = useState("")
  const [instructions, setInstructions] = useState("")
  const [urgent, setUrgent] = useState(false)
  const [extraRecipients, setExtraRecipients] = useState<{ email: string; name: string }[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const addRecipient = () => {
    const e = newEmail.trim().toLowerCase()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setError("Enter a valid email"); return }
    setExtraRecipients(prev => [...prev, { email: e, name: newName.trim() }])
    setNewEmail(""); setNewName(""); setError("")
  }

  const submit = async () => {
    if (!patient.trim() || !medication.trim()) { setError("Patient and medication are required"); return }
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/admin/medication-tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: patient, patient_account: account, medication, instructions,
          priority: urgent ? "urgent" : "normal", recipients: extraRecipients,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not create task"); return }
      const note = d.email_errors?.length ? ` (${d.emailed} emailed, ${d.email_errors.length} failed)` : ` (${d.emailed} notified)`
      onCreated(`Task created${note}`)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="New Medication Task">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Patient Name *"><input value={patient} onChange={e => setPatient(e.target.value)} className={inputCls} placeholder="Jane Doe" /></Field>
          <Field label="Account # (optional)"><input value={account} onChange={e => setAccount(e.target.value)} className={inputCls} placeholder="10011791" /></Field>
        </div>
        <Field label="Medication *"><input value={medication} onChange={e => setMedication(e.target.value)} className={inputCls} placeholder="Metformin 500mg" /></Field>
        <Field label="Instructions (optional)"><textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} className={inputCls} placeholder="Take with food, twice daily…" /></Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Mark as urgent
        </label>

        {/* Extra recipients */}
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">Notify (in addition to your default list)</p>
          {extraRecipients.length > 0 && (
            <div className="mb-2 space-y-1">
              {extraRecipients.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs">
                  <span>{r.name ? `${r.name} · ` : ""}{r.email}</span>
                  <button onClick={() => setExtraRecipients(prev => prev.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-gray-400" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className={`${inputCls} w-24`} />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRecipient() } }} placeholder="email@example.com" className={`${inputCls} flex-1`} />
            <button onClick={addRecipient} className="rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-100">Add</button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">Your default recipients are always notified automatically.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Create & Notify
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DefaultsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try { const r = await fetch("/api/admin/medication-tasks/defaults"); const d = await r.json(); if (r.ok) setList(d.defaults || []) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    const e = email.trim().toLowerCase()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setError("Enter a valid email"); return }
    setError("")
    const r = await fetch("/api/admin/medication-tasks/defaults", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, name }),
    })
    if (r.ok) { setEmail(""); setName(""); load() }
    else { const d = await r.json(); setError(d.error || "Could not add") }
  }
  const remove = async (id: string) => {
    const r = await fetch(`/api/admin/medication-tasks/defaults?id=${id}`, { method: "DELETE" })
    if (r.ok) load()
  }

  return (
    <Modal onClose={onClose} title="Default Recipients">
      <p className="mb-3 text-sm text-gray-500">These people are notified for every medication task automatically.</p>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="mb-3 space-y-1">
          {list.length === 0 ? <p className="text-sm italic text-gray-400">No default recipients yet.</p> :
            list.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span>{d.name ? `${d.name} · ` : ""}{d.email}</span>
                <button onClick={() => remove(d.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className={`${inputCls} w-24`} />
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add() }} placeholder="email@example.com" className={`${inputCls} flex-1`} />
        <button onClick={add} className="rounded-lg bg-[#0B7C79] px-3 text-sm font-medium text-white hover:bg-[#0a6b68]">Add</button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}

const inputCls = "rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>{children}</div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
