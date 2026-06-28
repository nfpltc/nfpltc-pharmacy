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
// Accepts CSV text. Creates tasks + sends notification emails to default recipients.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const csv = String(body.csv || "").trim()
    if (!csv) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })

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

    // Group rows by patient
    const taskMap = new Map<string, { patient_name: string; patient_account: string | null; medications: any[]; priority: string; comments: string | null }>()
    let rowsParsed = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const patient = (cols[nameIdx] || "").trim()
      const medication = (cols[medIdx] || "").trim()
      if (!patient || !medication) continue

      const account = acctIdx >= 0 ? (cols[acctIdx] || "").trim() || null : null
      const key = `${patient}||${account || ""}`

      if (!taskMap.has(key)) {
        taskMap.set(key, {
          patient_name: patient,
          patient_account: account,
          medications: [],
          priority: prioIdx >= 0 && (cols[prioIdx] || "").trim().toLowerCase() === "urgent" ? "urgent" : "normal",
          comments: commIdx >= 0 ? (cols[commIdx] || "").trim() || null : null,
        })
      }

      taskMap.get(key)!.medications.push({
        name: medication,
        dose: doseIdx >= 0 ? (cols[doseIdx] || "").trim() || null : null,
        due_at: dueIdx >= 0 ? parseDateFlex(cols[dueIdx]) : null,
        instructions: instrIdx >= 0 ? (cols[instrIdx] || "").trim() || null : null,
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
        medication: medSummary,
        medications: t.medications,
        priority: t.priority,
        comments: t.comments,
        status: "pending",
        follow_up_count: 0,
        last_notified_at: new Date().toISOString(),
      }).select("id, patient_name, patient_account, medication, medications, comments, priority").single()

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

function parseDateFlex(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}
