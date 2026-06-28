"use client"
import { useState, useEffect, useCallback } from "react"
import { Mail, FileText, Save, Loader2, MapPin, Phone, Calendar, StickyNote, Send, Sparkles, Wand2, Pill } from "lucide-react"

// Shown inline when an admin clicks a customer row to expand it.
// Three sections: editable contact profile, statement history, email history.
// Phase 3 will add the action buttons (send statement/email/blog) — for now
// the contact editing and history display are fully functional.

interface CustomerProfile {
  account_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  email_opt_in: boolean
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  date_of_birth: string | null
  secondary_contact: string | null
}

interface StatementRow {
  id: string
  billing_period: string
  file_name: string
  bill_date: string | null
  amount_due: number
  created_at: string
}

interface EmailRow {
  id: string
  billing_period: string | null
  email_to: string | null
  status: string | null
  error_message: string | null
  sent_at: string | null
}

export default function CustomerDetailPanel({
  accountNumber,
  onSaved,
}: {
  accountNumber: string
  onSaved?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [emailHistory, setEmailHistory] = useState<EmailRow[]>([])
  const [medTasks, setMedTasks] = useState<any[]>([])
  const [error, setError] = useState("")

  // Editable form state (mirrors profile fields)
  const [form, setForm] = useState<Partial<CustomerProfile>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [openingId, setOpeningId] = useState<string | null>(null)

  // Phase 3 — actions
  const [sendingBlog, setSendingBlog] = useState(false)
  const [actionMsg, setActionMsg] = useState("")
  const [showCustomEmail, setShowCustomEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [polishing, setPolishing] = useState(false)

  // AI: polish the current draft, or write from a short instruction
  const aiAssist = async (mode: "polish" | "write") => {
    if (!emailBody.trim()) {
      setActionMsg(mode === "write" ? "Type a quick note of what to say first" : "Type a draft to polish first")
      return
    }
    setPolishing(true)
    setActionMsg("")
    try {
      const r = await fetch("/api/admin/customers/polish-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: emailBody, subject: emailSubject, mode }),
      })
      const d = await r.json()
      if (!r.ok) { setActionMsg(d.error || "AI could not help right now"); return }
      if (d.subject) setEmailSubject(d.subject)
      if (d.body) setEmailBody(d.body)
    } catch {
      setActionMsg("Network error")
    } finally {
      setPolishing(false)
    }
  }

  const canEmail = Boolean(profile?.email && profile?.email_opt_in)

  const sendBlog = async () => {
    setSendingBlog(true)
    setActionMsg("")
    try {
      const r = await fetch("/api/admin/customers/send-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber }),
      })
      const d = await r.json()
      if (!r.ok) { setActionMsg(d.error || "Failed to send blog"); return }
      setActionMsg(`Sent "${d.blog_title}" ✓`)
      fetchDetail()  // refresh email history
    } catch {
      setActionMsg("Network error")
    } finally {
      setSendingBlog(false)
    }
  }

  const sendCustomEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      setActionMsg("Subject and message are required")
      return
    }
    setSendingEmail(true)
    setActionMsg("")
    try {
      const r = await fetch("/api/admin/customers/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber, subject: emailSubject, message: emailBody }),
      })
      const d = await r.json()
      if (!r.ok) { setActionMsg(d.error || "Failed to send email"); return }
      setActionMsg("Email sent ✓")
      setEmailSubject(""); setEmailBody(""); setShowCustomEmail(false)
      fetchDetail()
    } catch {
      setActionMsg("Network error")
    } finally {
      setSendingEmail(false)
    }
  }

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const r = await fetch(`/api/admin/customers/detail?account_number=${encodeURIComponent(accountNumber)}`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not load details"); return }
      setProfile(d.profile)
      setStatements(d.statements || [])
      setEmailHistory(d.email_history || [])

      // Fetch medication tasks for this account
      try {
        const mt = await fetch(`/api/admin/medication-tasks?account=${encodeURIComponent(accountNumber)}&status=all`)
        const mtd = await mt.json()
        setMedTasks(mtd.tasks || [])
      } catch { setMedTasks([]) }

      setForm(d.profile || {})
    } catch (e: any) {
      setError(e.message || "Network error")
    } finally {
      setLoading(false)
    }
  }, [accountNumber])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const updateField = (key: keyof CustomerProfile, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg("")
    try {
      const r = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_number: accountNumber,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          date_of_birth: form.date_of_birth,
          secondary_contact: form.secondary_contact,
          notes: form.notes,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setSaveMsg(d.error || "Save failed"); return }
      setSaveMsg("Saved ✓")
      onSaved?.()
      setTimeout(() => setSaveMsg(""), 2500)
    } catch {
      setSaveMsg("Network error")
    } finally {
      setSaving(false)
    }
  }

  const openStatement = async (id: string) => {
    setOpeningId(id)
    try {
      const r = await fetch(`/api/admin/statements/sign?id=${id}`)
      const d = await r.json()
      if (r.ok && d.url) window.open(d.url, "_blank", "noopener,noreferrer")
      else alert(d.error || "Could not open statement")
    } catch {
      alert("Could not open statement")
    } finally {
      setOpeningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading customer details…
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="grid gap-6 p-5 md:grid-cols-2">
      {/* ── Contact profile (editable) ──────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <MapPin className="h-4 w-4 text-[#0B7C79]" /> Contact Details
        </h4>

        <div className="grid grid-cols-2 gap-2">
          <Field label="First Name" value={form.first_name || ""} onChange={v => updateField("first_name", v)} />
          <Field label="Last Name" value={form.last_name || ""} onChange={v => updateField("last_name", v)} />
        </div>

        <Field label="Email" type="email" value={form.email || ""} onChange={v => updateField("email", v)} icon={<Mail className="h-3.5 w-3.5" />} />
        <Field label="Phone" value={form.phone || ""} onChange={v => updateField("phone", v)} icon={<Phone className="h-3.5 w-3.5" />} />
        <Field label="Date of Birth" type="date" value={form.date_of_birth || ""} onChange={v => updateField("date_of_birth", v)} icon={<Calendar className="h-3.5 w-3.5" />} />

        <Field label="Street Address" value={form.address || ""} onChange={v => updateField("address", v)} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="City" value={form.city || ""} onChange={v => updateField("city", v)} />
          <Field label="State" value={form.state || ""} onChange={v => updateField("state", v)} />
          <Field label="Zip" value={form.zip || ""} onChange={v => updateField("zip", v)} />
        </div>

        <Field label="Secondary Contact" value={form.secondary_contact || ""} onChange={v => updateField("secondary_contact", v)} placeholder="e.g. caregiver name & phone" />

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </label>
          <textarea
            value={form.notes || ""}
            onChange={e => updateField("notes", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Internal notes about this customer…"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          {saveMsg && <span className="text-sm text-emerald-600">{saveMsg}</span>}
        </div>
      </div>

      {/* ── History (statements + emails) ───────────────────────────── */}
      <div className="space-y-5">
        {/* Statements */}
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText className="h-4 w-4 text-[#0B7C79]" /> Statements ({statements.length})
          </h4>
          {statements.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No statements on file.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Bill Date</th>
                    <th className="px-3 py-2 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statements.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{formatPeriod(s.billing_period)}</td>
                      <td className="px-3 py-2 text-gray-500">{s.bill_date || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => openStatement(s.id)}
                          disabled={openingId === s.id}
                          className="text-[#0B7C79] hover:underline disabled:opacity-50"
                        >
                          {openingId === s.id ? "…" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Email history */}
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Send className="h-4 w-4 text-[#0B7C79]" /> Email History ({emailHistory.length})
          </h4>
          {emailHistory.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No emails sent yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Sent</th>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emailHistory.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{e.sent_at ? formatDateTime(e.sent_at) : "—"}</td>
                      <td className="px-3 py-2">{e.billing_period ? formatPeriod(e.billing_period) : "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Medication Tasks */}
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Pill className="h-4 w-4 text-[#0B7C79]" /> Medication Tasks ({medTasks.length})
          </h4>
          {medTasks.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No medication tasks for this customer.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Medication</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medTasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {Array.isArray(t.medications) && t.medications.length > 0
                          ? t.medications.map((m: any, i: number) => (
                              <div key={i}>
                                <span className="font-medium">{m.name}</span>
                                {m.dose ? <span className="text-gray-400"> · {m.dose}</span> : ""}
                              </div>
                            ))
                          : <span>{t.medication || "—"}</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          t.status === "completed" ? "bg-emerald-50 text-emerald-700"
                            : t.status === "cancelled" ? "bg-gray-100 text-gray-500"
                            : "bg-amber-50 text-amber-700"
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {t.completed_by && <div className="text-[10px] text-emerald-600">by {t.completed_by}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Send className="h-4 w-4 text-[#0B7C79]" /> Actions
          </h4>

          {!canEmail && (
            <p className="mb-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {profile?.email ? "Customer has opted out of emails." : "No email on file — add one above and save to enable sending."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={sendBlog}
              disabled={!canEmail || sendingBlog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B7C79] px-3 py-1.5 text-xs font-medium text-[#0B7C79] hover:bg-emerald-50 disabled:opacity-40"
            >
              {sendingBlog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Send Latest Blog
            </button>
            <button
              onClick={() => setShowCustomEmail(v => !v)}
              disabled={!canEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <Mail className="h-3.5 w-3.5" /> {showCustomEmail ? "Cancel" : "Send Custom Email"}
            </button>
          </div>

          {/* Custom email form */}
          {showCustomEmail && canEmail && (
            <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={4}
                placeholder="Type a rough draft or a quick note of what to say, then use AI to polish it…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              {/* AI writing assistant */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => aiAssist("polish")}
                  disabled={polishing || sendingEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                  title="Clean up grammar and make it professional"
                >
                  {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Polish with AI
                </button>
                <button
                  onClick={() => aiAssist("write")}
                  disabled={polishing || sendingEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                  title="Turn a short note into a full email"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Write for me
                </button>
                <span className="text-[11px] text-gray-400">AI drafts — review before sending</span>
              </div>

              <button
                onClick={sendCustomEmail}
                disabled={sendingEmail || polishing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60"
              >
                {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Email
              </button>
            </div>
          )}

          {actionMsg && (
            <p className={`mt-2 text-xs ${actionMsg.includes("✓") ? "text-emerald-600" : "text-red-600"}`}>
              {actionMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = "text", icon, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; icon?: React.ReactNode; placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
        {icon}{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase()
  if (s === "sent" || s === "delivered") {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Sent</span>
  }
  if (s === "failed" || s === "bounced" || s === "error") {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{status}</span>
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{status || "—"}</span>
}

function formatPeriod(p: string): string {
  if (!p) return "—"
  const [y, m] = p.split("-")
  if (!y || !m) return p
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { year: "numeric", month: "short" })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}
