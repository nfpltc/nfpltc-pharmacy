import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import crypto from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function publicBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, "")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("host") || "www.nfpltc.com"
  return `${proto}://${host}`
}

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// POST /api/admin/medication-tasks/import
// Accepts EITHER:
//   { csv: "..." }              — legacy raw CSV text (patient_name,medication,... headers)
//   { rows: [{ patient_name, patient_account, medication, dose, due_at, instructions, comments, priority }] }
//   — structured rows, already mapped client-side (used by the XLSX/CSV uploader with column mapping)
// Creates tasks + sends notification emails to default recipients.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    type RawRow = {
      patient_name: string; patient_account?: string; facility?: string
      medication: string; dose?: string; form?: string; dose_timing?: string
      due_at?: any; start_date?: any; delivery_date?: any
      provider?: string; doctor_contacted?: string; notes?: string
      instructions?: string; comments?: string; priority?: string
    }
    let rawRows: RawRow[] = []

    if (Array.isArray(body.rows)) {
      // New structured path (from the file-upload UI with column mapping)
      rawRows = body.rows
    } else {
      // Legacy CSV text path
      const csv = String(body.csv || "").trim()
      if (!csv) return NextResponse.json({ error: "No data provided" }, { status: 400 })

      const lines = csv.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })

      const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
      const nameIdx = header.indexOf("patient_name")
      const acctIdx = header.indexOf("patient_account")
      const medIdx = header.indexOf("medication")
      const doseIdx = header.indexOf("dose")
      const dueIdx = header.indexOf("due_at")
      const instrIdx = header.indexOf("instructions")
      const prioIdx = header.indexOf("priority")
      const commIdx = header.indexOf("comments")

      if (nameIdx < 0 || medIdx < 0) {
        return NextResponse.json({ error: "CSV must have 'patient_name' and 'medication' columns" }, { status: 400 })
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i])
        rawRows.push({
          patient_name: cols[nameIdx] || "",
          patient_account: acctIdx >= 0 ? cols[acctIdx] : "",
          medication: cols[medIdx] || "",
          dose: doseIdx >= 0 ? cols[doseIdx] : "",
          due_at: dueIdx >= 0 ? cols[dueIdx] : "",
          instructions: instrIdx >= 0 ? cols[instrIdx] : "",
          comments: commIdx >= 0 ? cols[commIdx] : "",
          priority: prioIdx >= 0 ? cols[prioIdx] : "",
        })
      }
    }

    if (rawRows.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 })

    // Group rows by patient
    const taskMap = new Map<string, {
      patient_name: string; patient_account: string | null; facility: string | null
      medications: any[]; priority: string; comments: string | null
      provider: string | null; doctor_contacted: string | null; notes: string | null
      start_date: string | null; delivery_date: string | null
    }>()
    let rowsParsed = 0

    for (const row of rawRows) {
      const patient = String(row.patient_name || "").trim()
      const medication = String(row.medication || "").trim()
      if (!patient || !medication) continue

      const account = row.patient_account ? String(row.patient_account).trim() || null : null
      const facility = row.facility ? String(row.facility).trim() || null : null
      const key = `${patient}||${account || ""}||${facility || ""}`

      if (!taskMap.has(key)) {
        taskMap.set(key, {
          patient_name: patient,
          patient_account: account,
          facility,
          medications: [],
          priority: String(row.priority || "").trim().toLowerCase() === "urgent" ? "urgent" : "normal",
          comments: row.comments ? String(row.comments).trim() || null : null,
          provider: row.provider ? String(row.provider).trim() || null : null,
          doctor_contacted: row.doctor_contacted ? String(row.doctor_contacted).trim() || null : null,
          notes: row.notes ? String(row.notes).trim() || null : null,
          start_date: row.start_date ? parseDateOnly(row.start_date) : null,
          delivery_date: row.delivery_date ? parseDateOnly(row.delivery_date) : null,
        })
      }

      taskMap.get(key)!.medications.push({
        name: medication,
        dose: row.dose ? String(row.dose).trim() || null : null,
        form: row.form ? String(row.form).trim() || null : null,
        dose_timing: row.dose_timing ? String(row.dose_timing).trim() || null : null,
        due_at: row.due_at ? parseDateFlex(row.due_at) : null,
        instructions: row.instructions ? String(row.instructions).trim() || null : null,
      })
      rowsParsed++
    }

    if (taskMap.size === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 })
    }

    const sb = admin()

    // Load default recipients
    const { data: defaults } = await sb
      .from("medication_notify_defaults")
      .select("email, name")
      .eq("active", true)
    const defaultRecipients = (defaults || [])
      .map((d: any) => ({ email: String(d.email || "").trim().toLowerCase(), name: d.name || null }))
      .filter((d: any) => d.email)

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    const canEmail = Boolean(RESEND_API_KEY && FROM_EMAIL && defaultRecipients.length > 0)
    const resend = canEmail ? new Resend(RESEND_API_KEY!) : null
    const base = publicBaseUrl(req)

    let created = 0
    let emailed = 0
    const errors: string[] = []

    for (const t of taskMap.values()) {
      const medSummary = t.medications.map(m => m.name).join(", ")
      const { data: task, error: err } = await sb.from("medication_tasks").insert({
        patient_name: t.patient_name,
        patient_account: t.patient_account,
        facility: t.facility,
        medication: medSummary,
        medications: t.medications,
        priority: t.priority,
        comments: t.comments,
        provider: t.provider,
        doctor_contacted: t.doctor_contacted,
        notes: t.notes,
        start_date: t.start_date,
        delivery_date: t.delivery_date,
        status: "pending",
        follow_up_count: 0,
        last_notified_at: new Date().toISOString(),
      }).select("id, patient_name, patient_account, facility, medication, medications, comments, priority, provider, doctor_contacted, notes, start_date, delivery_date").single()

      if (err) {
        errors.push(`${t.patient_name}: ${err.message}`)
        continue
      }
      created++

      // Create recipient rows and send emails
      if (canEmail && resend && task) {
        for (const rec of defaultRecipients) {
          const token = crypto.randomBytes(24).toString("hex")
          await sb.from("medication_task_recipients").insert({
            task_id: task.id,
            email: rec.email,
            name: rec.name,
            token,
            notified_at: new Date().toISOString(),
          })

          try {
            const completeUrl = `${base}/medication-task/complete?token=${token}`
            const meds = Array.isArray(task.medications) && task.medications.length
              ? task.medications : [{ name: task.medication }]
            const medList = meds.map((m: any) =>
              `<li style="margin-bottom:4px"><strong>${escapeHtml(m.name)}</strong>${m.dose ? ` · ${escapeHtml(m.dose)}` : ""}</li>`
            ).join("")

            const html = `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
              <div style="max-width:560px;margin:0 auto;padding:24px">
                <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
                  <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
                  <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Medication Task</p>
                </div>
                <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
                  ${task.priority === "urgent" ? `<div style="background:#FEE2E2;color:#B91C1C;font-weight:600;padding:8px 12px;border-radius:8px;margin-bottom:16px;font-size:14px">⚠ URGENT</div>` : ""}
                  <p style="margin:0 0 12px;color:#111827">Hi ${escapeHtml(rec.name || "team member")},</p>
                  <p style="margin:0 0 12px;color:#374151">A medication task has been assigned:</p>
                  <table style="width:100%;margin-bottom:12px">
                    <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:100px">Patient</td><td style="color:#111827;font-weight:600">${escapeHtml(task.patient_name)}</td></tr>
                  </table>
                  <p style="margin:0 0 4px;color:#6B7280;font-size:13px">Medications</p>
                  <ul style="margin:0 0 16px;padding-left:20px">${medList}</ul>
                  ${task.comments ? `<div style="background:#F0FDF9;border-left:3px solid #0B7C79;padding:8px 12px;border-radius:6px;margin-bottom:16px;font-size:13px"><strong>Note:</strong> ${escapeHtml(task.comments)}</div>` : ""}
                  <a href="${completeUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">✓ Mark as Completed</a>
                </div>
              </div>
            </body></html>`

            const r = await resend.emails.send({
              from: FROM_EMAIL!,
              to: rec.email,
              subject: `${task.priority === "urgent" ? "[URGENT] " : ""}Medication task: ${task.patient_name}`,
              html,
              text: `Medication task\nPatient: ${task.patient_name}\nMedications: ${task.medication}\nMark completed: ${completeUrl}`,
            })
            if ((r as any).error) throw new Error((r as any).error.message)
            emailed++
          } catch (e: any) {
            errors.push(`email to ${rec.email} for ${t.patient_name}: ${e.message}`)
          }
          await new Promise(res => setTimeout(res, 80))
        }
      }
    }

    return NextResponse.json({
      success: true,
      rows_parsed: rowsParsed,
      tasks_created: created,
      emails_sent: emailed,
      default_recipients: defaultRecipients.length,
      errors: errors.slice(0, 20),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = "" }
      else current += ch
    }
  }
  result.push(current)
  return result
}

function parseDateFlex(raw: any): string | null {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString()
  const s = String(raw).trim()
  if (!s || s === "-") return null
  // Skip non-date free-text values common in tracking sheets (PRN CARD, DISCONTINUED, etc.)
  if (/^(prn|discontinued|n\/?a|none|tbd|pending)/i.test(s)) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}

// Like parseDateFlex but returns YYYY-MM-DD (for `date` typed columns like start_date)
function parseDateOnly(raw: any): string | null {
  const iso = parseDateFlex(raw)
  return iso ? iso.slice(0, 10) : null
}
