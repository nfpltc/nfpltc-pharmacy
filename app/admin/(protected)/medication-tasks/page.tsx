"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Pill, Plus, X, Loader2, CheckCircle2, Clock, Ban, Trash2, Mail, Users, Search, Sparkles, Pencil, Download, Upload } from "lucide-react"

interface Recipient { email: string; name?: string; notified_at?: string; clicked_at?: string }
interface Task {
  id: string
  patient_name: string
  patient_account: string | null
  medication: string
  medications?: { name: string; dose?: string; due_at?: string; instructions?: string }[]
  comments?: string | null
  instructions: string | null
  priority: string
  status: string
  created_at: string
  completed_at: string | null
  completed_by: string | null
  completed_via: string | null
  follow_up_count?: number
  last_notified_at?: string | null
  recipients: Recipient[]
}

export default function MedicationTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [counts, setCounts] = useState({ pending: 0, completed: 0, cancelled: 0 })
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDefaults, setShowDefaults] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
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
  const deleteTask = async (id: string) => {
    if (!confirm("Permanently delete this task? This cannot be undone.")) return
    const r = await fetch(`/api/admin/medication-tasks?id=${id}`, { method: "DELETE" })
    if (r.ok) { setMsg("Task deleted"); load() }
  }

  const exportCSV = () => {
    if (tasks.length === 0) { setMsg("No tasks to export"); return }
    const header = "patient_name,patient_account,medication,dose,due_at,instructions,priority,comments,status,created_at,completed_at,completed_by"
    const rows = tasks.flatMap(t => {
      const meds = Array.isArray(t.medications) && t.medications.length > 0
        ? t.medications
        : [{ name: t.medication, dose: "", due_at: "", instructions: "" }]
      return meds.map(m => [
        csvVal(t.patient_name), csvVal(t.patient_account), csvVal(m.name),
        csvVal(m.dose), csvVal(m.due_at), csvVal(m.instructions),
        csvVal(t.priority), csvVal(t.comments), csvVal(t.status),
        csvVal(t.created_at), csvVal(t.completed_at), csvVal(t.completed_by),
      ].join(","))
    })
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `medication-tasks-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const downloadSample = () => {
    const sample = `patient_name,patient_account,medication,dose,due_at,instructions,priority,comments
Jane Doe,10011791,Metformin 500mg,1 tablet,2026-07-01 14:00,Take with food,normal,Please administer after lunch
Jane Doe,10011791,Amlodipine 5mg,1 tablet,2026-07-01 08:00,Morning dose,normal,
John Smith,10012345,Omeprazole 20mg,1 capsule,2026-07-01 07:00,Before breakfast,urgent,High priority patient`
    const blob = new Blob([sample], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "medication-tasks-template.csv"
    a.click()
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
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowDefaults(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25">
                <Users className="h-4 w-4" /> Recipients
              </button>
              <button onClick={() => setShowCatalog(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25">
                <Pill className="h-4 w-4" /> Medications
              </button>
              <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25">
                <Download className="h-4 w-4" /> Export
              </button>
              <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25">
                <Upload className="h-4 w-4" /> Import
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
            {tasks.map(t => <TaskCard key={t.id} t={t} onComplete={() => markComplete(t.id)} onCancel={() => cancelTask(t.id)} onEdit={() => setEditing(t)} onDelete={() => deleteTask(t.id)} />)}
          </div>
        )}
      </section>

      {showForm && <NewTaskModal onClose={() => setShowForm(false)} onCreated={(m) => { setShowForm(false); setMsg(m); setFilter("pending"); load() }} />}
      {editing && <EditTaskModal task={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg("Task updated ✓"); load() }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={(m) => { setShowImport(false); setMsg(m); load() }} onDownloadSample={downloadSample} />}
      {showCatalog && <CatalogModal onClose={() => setShowCatalog(false)} />}
      {showDefaults && <DefaultsModal onClose={() => setShowDefaults(false)} />}
    </main>
  )
}

function TaskCard({ t, onComplete, onCancel, onEdit, onDelete }: { t: Task; onComplete: () => void; onCancel: () => void; onEdit: () => void; onDelete: () => void }) {
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
          {Array.isArray(t.medications) && t.medications.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {t.medications.map((m: any, i: number) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium">{m.name}</span>
                  {m.dose ? ` · ${m.dose}` : ""}
                  {m.due_at ? <span className="text-gray-500"> · {new Date(m.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> : ""}
                  {m.instructions ? <span className="text-gray-500"> · {m.instructions}</span> : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-700"><span className="text-gray-500">Medication:</span> {t.medication}</p>
          )}
          {t.comments && <p className="mt-1 text-sm text-gray-600"><span className="text-gray-500">Note:</span> {t.comments}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {t.recipients?.length || 0} notified</span>
            {(t.follow_up_count || 0) > 0 && <span className="text-amber-600">⏰ {t.follow_up_count} reminder{(t.follow_up_count || 0) > 1 ? "s" : ""} sent</span>}
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

        <div className="flex flex-wrap gap-2">
          {t.status === "pending" && (
            <>
              <button onClick={onComplete} className="inline-flex items-center gap-1 rounded-lg bg-[#0B7C79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a6b68]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
              </button>
              <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Ban className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          )}
          <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Completed</span>
  if (status === "cancelled") return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"><Ban className="h-3 w-3" /> Cancelled</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"><Clock className="h-3 w-3" /> Pending</span>
}

interface MedLine { name: string; dose: string; due_at: string; instructions: string }

function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [patient, setPatient] = useState("")
  const [account, setAccount] = useState("")
  const [meds, setMeds] = useState<MedLine[]>([{ name: "", dose: "", due_at: "", instructions: "" }])
  const [comments, setComments] = useState("")
  const [urgent, setUrgent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [error, setError] = useState("")

  // Default recipients — loaded on mount, shown as removable chips
  const [defaultRecipients, setDefaultRecipients] = useState<{ email: string; name: string | null }[]>([])
  const [extraRecipients, setExtraRecipients] = useState<{ email: string; name: string }[]>([])
  const [removedDefaults, setRemovedDefaults] = useState<Set<number>>(new Set())
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")

  // CRM customer search
  const [custQuery, setCustQuery] = useState("")
  const [custResults, setCustResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showCustResults, setShowCustResults] = useState(false)

  // Medication catalog search
  const [medSearchIdx, setMedSearchIdx] = useState<number | null>(null)
  const [medSearchResults, setMedSearchResults] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/medication-tasks/defaults")
        const d = await r.json()
        setDefaultRecipients((d.defaults || []).filter((d: any) => d.active !== false).map((d: any) => ({ email: d.email, name: d.name })))
      } catch {}
    })()
  }, [])

  const searchCustomers = async (q: string) => {
    setCustQuery(q)
    if (q.trim().length < 2) { setCustResults([]); setShowCustResults(false); return }
    setSearching(true)
    try {
      const r = await fetch(`/api/admin/customers?search=${encodeURIComponent(q.trim())}`)
      const d = await r.json()
      setCustResults(d.customers || d.data || [])
      setShowCustResults(true)
    } catch {}
    finally { setSearching(false) }
  }
  const pickCustomer = (c: any) => {
    const name = `${c.first_name} ${c.last_name}`.trim()
    setPatient(name)
    setAccount(c.account_number || "")
    setCustQuery(name)
    setShowCustResults(false)
    setCustResults([])
  }

  const updateMed = (i: number, key: keyof MedLine, val: string) => {
    setMeds(prev => prev.map((m, j) => j === i ? { ...m, [key]: val } : m))
    if (key === "name" && val.trim().length >= 2) searchMedCatalog(val, i)
    else if (key === "name") { setMedSearchIdx(null); setMedSearchResults([]) }
  }
  const addMed = () => setMeds(prev => [...prev, { name: "", dose: "", due_at: "", instructions: "" }])
  const removeMed = (i: number) => setMeds(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)

  const searchMedCatalog = async (q: string, idx: number) => {
    setMedSearchIdx(idx)
    try {
      const r = await fetch(`/api/admin/medication-tasks/catalog?search=${encodeURIComponent(q.trim())}`)
      const d = await r.json()
      setMedSearchResults(d.medications || [])
    } catch { setMedSearchResults([]) }
  }
  const pickMed = (idx: number, med: any) => {
    setMeds(prev => prev.map((m, j) => j === idx ? {
      ...m, name: med.name, dose: med.default_dose || m.dose, instructions: med.instructions || m.instructions,
    } : m))
    setMedSearchIdx(null); setMedSearchResults([])
  }

  const removeDefault = (idx: number) => setRemovedDefaults(prev => new Set(prev).add(idx))
  const addRecipient = () => {
    const e = newEmail.trim().toLowerCase()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setError("Enter a valid email"); return }
    setExtraRecipients(prev => [...prev, { email: e, name: newName.trim() }])
    setNewEmail(""); setNewName(""); setError("")
  }

  const polishComment = async () => {
    if (!comments.trim()) { setError("Type a comment first"); return }
    setPolishing(true); setError("")
    try {
      const r = await fetch("/api/admin/customers/polish-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: comments, mode: "polish" }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "AI could not help"); return }
      if (d.body) setComments(d.body)
    } catch { setError("Network error") }
    finally { setPolishing(false) }
  }

  const activeDefaults = defaultRecipients.filter((_, i) => !removedDefaults.has(i))

  const submit = async () => {
    const cleanMeds = meds.filter(m => m.name.trim())
    if (!patient.trim() || cleanMeds.length === 0) { setError("Patient and at least one medication are required"); return }
    setSaving(true); setError("")
    try {
      const allRecipients = [
        ...activeDefaults.map(d => ({ email: d.email, name: d.name || "" })),
        ...extraRecipients,
      ]
      const r = await fetch("/api/admin/medication-tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: patient, patient_account: account,
          medications: cleanMeds.map(m => ({
            name: m.name, dose: m.dose || null,
            due_at: m.due_at ? new Date(m.due_at).toISOString() : null,
            instructions: m.instructions || null,
          })),
          comments, priority: urgent ? "urgent" : "normal", recipients: allRecipients,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not create task"); return }
      const note = d.email_errors?.length ? ` (${d.emailed} emailed, ${d.email_errors.length} failed)` : ` (${d.emailed} notified)`
      onCreated(`Task created${note}`)
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} title="New Medication Task">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Field label="Patient Name *">
              <input value={patient} onChange={e => { setPatient(e.target.value); searchCustomers(e.target.value) }}
                onFocus={() => { if (patient.trim().length >= 2) searchCustomers(patient) }}
                onBlur={() => setTimeout(() => setShowCustResults(false), 200)}
                className={inputCls} placeholder="Type to search CRM…" />
            </Field>
            {showCustResults && custResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {custResults.slice(0, 8).map((c: any) => (
                  <button key={c.account_number} onClick={() => pickCustomer(c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <span className="font-medium">{c.last_name?.toUpperCase()}, {c.first_name}</span>
                    <span className="text-gray-400"> · {c.account_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Field label="Account #"><input value={account} onChange={e => setAccount(e.target.value)} className={inputCls} placeholder="10011791" /></Field>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Medications * — type to search your catalog</label>
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={i} className="relative rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input value={m.name} onChange={e => updateMed(i, "name", e.target.value)}
                      onFocus={() => { if (m.name.trim().length >= 2) searchMedCatalog(m.name, i) }}
                      onBlur={() => setTimeout(() => { if (medSearchIdx === i) setMedSearchIdx(null) }, 200)}
                      placeholder="Medication name" className={`${inputCls} w-full`} />
                    {medSearchIdx === i && medSearchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {medSearchResults.map(med => (
                          <button key={med.id} onClick={() => pickMed(i, med)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                            <span className="font-medium">{med.name}</span>
                            {med.default_dose && <span className="text-gray-400"> · {med.default_dose}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={m.dose} onChange={e => updateMed(i, "dose", e.target.value)} placeholder="Dose" className={`${inputCls} w-24`} />
                  {meds.length > 1 && <button onClick={() => removeMed(i)} className="px-1 text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>}
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-400">Date / time (optional)</label>
                    <input type="datetime-local" value={m.due_at} onChange={e => updateMed(i, "due_at", e.target.value)} className={`${inputCls} w-full`} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-400">Instructions (optional)</label>
                    <input value={m.instructions} onChange={e => updateMed(i, "instructions", e.target.value)} placeholder="with food…" className={`${inputCls} w-full`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addMed} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0B7C79] hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add another medication
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Comment to include in the email (optional)</label>
          <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} className={`${inputCls} w-full`} placeholder="Any note for the recipients…" />
          <button onClick={polishComment} disabled={polishing}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
            {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Polish with AI
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Mark as urgent
        </label>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">Who will be notified</p>
          {defaultRecipients.length > 0 && (
            <div className="mb-2 space-y-1">
              {defaultRecipients.map((d, di) => (
                <div key={`${d.email}-${di}`} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${removedDefaults.has(di) ? "bg-gray-100 text-gray-400 line-through" : "bg-emerald-50 text-emerald-700"}`}>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {d.name ? `${d.name} · ` : ""}{d.email}
                    <span className="text-[10px] text-gray-400">(default)</span>
                  </span>
                  {removedDefaults.has(di) ? (
                    <button onClick={() => setRemovedDefaults(prev => { const n = new Set(prev); n.delete(di); return n })} className="text-emerald-600 hover:underline text-[11px]">add back</button>
                  ) : (
                    <button onClick={() => removeDefault(di)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {defaultRecipients.length === 0 && (
            <p className="mb-2 text-xs text-amber-600">No default recipients set up. Add some via the Recipients button, or add below.</p>
          )}
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
function EditTaskModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [patient, setPatient] = useState(task.patient_name)
  const [account, setAccount] = useState(task.patient_account || "")
  const [meds, setMeds] = useState<MedLine[]>(
    Array.isArray(task.medications) && task.medications.length > 0
      ? task.medications.map(m => ({
          name: m.name || "",
          dose: m.dose || "",
          due_at: m.due_at ? m.due_at.slice(0, 16) : "",  // datetime-local needs YYYY-MM-DDTHH:MM
          instructions: m.instructions || "",
        }))
      : [{ name: task.medication || "", dose: "", due_at: "", instructions: "" }]
  )
  const [comments, setComments] = useState(task.comments || "")
  const [urgent, setUrgent] = useState(task.priority === "urgent")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const updateMed = (i: number, key: keyof MedLine, val: string) =>
    setMeds(prev => prev.map((m, j) => j === i ? { ...m, [key]: val } : m))
  const addMed = () => setMeds(prev => [...prev, { name: "", dose: "", due_at: "", instructions: "" }])
  const removeMed = (i: number) => setMeds(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)

  const submit = async () => {
    const cleanMeds = meds.filter(m => m.name.trim())
    if (!patient.trim() || cleanMeds.length === 0) { setError("Patient and at least one medication are required"); return }
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/admin/medication-tasks", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          action: "edit",
          patient_name: patient,
          patient_account: account || null,
          priority: urgent ? "urgent" : "normal",
          comments: comments || null,
          medications: cleanMeds.map(m => ({
            name: m.name, dose: m.dose || null,
            due_at: m.due_at ? new Date(m.due_at).toISOString() : null,
            instructions: m.instructions || null,
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not save"); return }
      onSaved()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Edit Task">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Patient Name *"><input value={patient} onChange={e => setPatient(e.target.value)} className={inputCls} /></Field>
          <Field label="Account #"><input value={account} onChange={e => setAccount(e.target.value)} className={inputCls} /></Field>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Medications *</label>
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <div className="flex gap-2">
                  <input value={m.name} onChange={e => updateMed(i, "name", e.target.value)} placeholder="Medication name" className={`${inputCls} flex-1`} />
                  <input value={m.dose} onChange={e => updateMed(i, "dose", e.target.value)} placeholder="Dose" className={`${inputCls} w-24`} />
                  {meds.length > 1 && <button onClick={() => removeMed(i)} className="px-1 text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>}
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-400">Date / time</label>
                    <input type="datetime-local" value={m.due_at} onChange={e => updateMed(i, "due_at", e.target.value)} className={`${inputCls} w-full`} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-400">Instructions</label>
                    <input value={m.instructions} onChange={e => updateMed(i, "instructions", e.target.value)} placeholder="with food…" className={`${inputCls} w-full`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addMed} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0B7C79] hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add another medication
          </button>
        </div>

        <Field label="Comments"><textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} className={`${inputCls} w-full`} /></Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Mark as urgent
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Save Changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ImportModal({ onClose, onDone, onDownloadSample }: { onClose: () => void; onDone: (msg: string) => void; onDownloadSample: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const handleUpload = async () => {
    if (!file) { setError("Select a CSV file first"); return }
    setUploading(true); setError("")
    try {
      const text = await file.text()
      const r = await fetch("/api/admin/medication-tasks/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Import failed"); return }
      const errs = d.errors?.length ? ` (${d.errors.length} errors)` : ""
      onDone(`Imported ${d.tasks_created} tasks from ${d.rows_parsed} rows${errs}`)
    } catch {
      setError("Network error")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Import Medication Tasks">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Upload a CSV file to bulk-create medication tasks. Rows with the same patient name and account are grouped into one task with multiple medications.
        </p>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-700">Required columns</p>
          <div className="flex flex-wrap gap-1.5">
            {["patient_name", "medication"].map(c => (
              <span key={c} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{c}</span>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-gray-700">Optional columns</p>
          <div className="flex flex-wrap gap-1.5">
            {["patient_account", "dose", "due_at", "instructions", "priority", "comments"].map(c => (
              <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{c}</span>
            ))}
          </div>
        </div>

        <button onClick={onDownloadSample} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B7C79] hover:underline">
          <Download className="h-4 w-4" /> Download sample template
        </button>

        <div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !file}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
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

function CatalogModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([])
  const [name, setName] = useState("")
  const [dose, setDose] = useState("")
  const [instr, setInstr] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try { const r = await fetch("/api/admin/medication-tasks/catalog"); const d = await r.json(); if (r.ok) setList(d.medications || []) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!name.trim()) { setError("Name is required"); return }
    setError("")
    const r = await fetch("/api/admin/medication-tasks/catalog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), default_dose: dose.trim() || null, instructions: instr.trim() || null }),
    })
    if (r.ok) { setName(""); setDose(""); setInstr(""); load() }
    else { const d = await r.json(); setError(d.error || "Could not add") }
  }
  const remove = async (id: string) => {
    await fetch(`/api/admin/medication-tasks/catalog?id=${id}`, { method: "DELETE" })
    load()
  }

  return (
    <Modal onClose={onClose} title="Medication Catalog">
      <p className="mb-3 text-sm text-gray-500">Pre-add common medications so you can search and select them when creating tasks.</p>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="mb-3 max-h-64 space-y-1 overflow-y-auto">
          {list.length === 0 ? <p className="text-sm italic text-gray-400">No medications in the catalog yet.</p> :
            list.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{m.name}</span>
                  {m.default_dose && <span className="text-gray-500"> · {m.default_dose}</span>}
                  {m.instructions && <span className="text-gray-400"> · {m.instructions}</span>}
                </div>
                <button onClick={() => remove(m.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Medication name *" className={`${inputCls} flex-1`} />
          <input value={dose} onChange={e => setDose(e.target.value)} placeholder="Default dose" className={`${inputCls} w-28`} />
        </div>
        <div className="flex gap-2">
          <input value={instr} onChange={e => setInstr(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add() }} placeholder="Default instructions (optional)" className={`${inputCls} flex-1`} />
          <button onClick={add} className="rounded-lg bg-[#0B7C79] px-3 text-sm font-medium text-white hover:bg-[#0a6b68]">Add</button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}

function csvVal(v: any): string {
  if (v == null) return ""
  const s = String(v)
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
}

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
