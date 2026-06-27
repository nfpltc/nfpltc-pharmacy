import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import crypto from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

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

// ── GET: list tasks (optional ?status=pending|completed|cancelled) ─────────
export async function GET(req: NextRequest) {
  try {
    const sb = admin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let q = sb.from("medication_tasks").select("*").order("created_at", { ascending: false }).limit(200)
    if (status && status !== "all") q = q.eq("status", status)
    const { data: tasks, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Attach recipients for each task
    const ids = (tasks || []).map((t: any) => t.id)
    let recipients: any[] = []
    if (ids.length > 0) {
      const { data: recs } = await sb
        .from("medication_task_recipients")
        .select("task_id, email, name, notified_at, clicked_at")
        .in("task_id", ids)
      recipients = recs || []
    }
    const withRecs = (tasks || []).map((t: any) => ({
      ...t,
      recipients: recipients.filter(r => r.task_id === t.id),
    }))

    // Counts for the stat cards
    const counts = { pending: 0, completed: 0, cancelled: 0 }
    for (const t of (tasks || [])) {
      if (t.status in counts) (counts as any)[t.status]++
    }

    return NextResponse.json({ tasks: withRecs, counts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// ── POST: create a task + notify recipients ────────────────────────────────
// Body: { patient_name, patient_account?, medications: [{name, dose?, due_at?, instructions?}],
//         comments?, priority?, recipients: [{email, name?}], created_by? }
// (Legacy: a single `medication` string is still accepted and wrapped.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const patient_name = String(body.patient_name || "").trim()

    // Normalize medications into an array of {name, dose, due_at, instructions}
    let medications: any[] = Array.isArray(body.medications) ? body.medications : []
    medications = medications
      .map((m: any) => ({
        name: String(m.name || "").trim(),
        dose: m.dose ? String(m.dose).trim() : null,
        due_at: m.due_at ? String(m.due_at) : null,
        instructions: m.instructions ? String(m.instructions).trim() : null,
      }))
      .filter((m: any) => m.name)
    // Back-compat: single medication string
    if (medications.length === 0 && body.medication) {
      medications = [{ name: String(body.medication).trim(), dose: null, due_at: null, instructions: null }]
    }

    if (!patient_name || medications.length === 0) {
      return NextResponse.json({ error: "Patient name and at least one medication are required" }, { status: 400 })
    }

    // Readable summary for the legacy `medication` column + list views
    const medicationSummary = medications.map(m => m.name).join(", ")

    const sb = admin()

    // Resolve recipients: provided list + active defaults, de-duped by email
    const provided: any[] = Array.isArray(body.recipients) ? body.recipients : []
    const { data: defaults } = await sb
      .from("medication_notify_defaults")
      .select("email, name")
      .eq("active", true)

    const map = new Map<string, { email: string; name: string | null }>()
    for (const d of (defaults || [])) {
      const e = String(d.email || "").trim().toLowerCase()
      if (e) map.set(e, { email: e, name: d.name || null })
    }
    for (const r of provided) {
      const e = String(r.email || "").trim().toLowerCase()
      if (e) map.set(e, { email: e, name: r.name || null })
    }
    const finalRecipients = Array.from(map.values())

    if (finalRecipients.length === 0) {
      return NextResponse.json({ error: "No recipients — add at least one, or set up a default list" }, { status: 400 })
    }

    // Create the task
    const { data: task, error: tErr } = await sb
      .from("medication_tasks")
      .insert({
        patient_name,
        patient_account: body.patient_account ? String(body.patient_account).trim() : null,
        medication: medicationSummary,
        medications,
        comments: body.comments ? String(body.comments).trim() : null,
        instructions: body.instructions ? String(body.instructions).trim() : null,
        priority: body.priority === "urgent" ? "urgent" : "normal",
        status: "pending",
        created_by: body.created_by ? String(body.created_by).trim() : null,
      })
      .select()
      .single()
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

    // Create recipient rows with unique tokens
    const recipientRows = finalRecipients.map(r => ({
      task_id: task.id,
      email: r.email,
      name: r.name,
      token: crypto.randomBytes(24).toString("hex"),
      notified_at: new Date().toISOString(),
    }))
    const { data: insertedRecs, error: rErr } = await sb
      .from("medication_task_recipients")
      .insert(recipientRows)
      .select()
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    // Send emails (best-effort)
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    let emailed = 0
    const emailErrors: string[] = []

    if (RESEND_API_KEY && FROM_EMAIL) {
      const resend = new Resend(RESEND_API_KEY)
      const base = publicBaseUrl(req)
      for (const rec of (insertedRecs || [])) {
        try {
          const completeUrl = `${base}/medication-task/complete?token=${rec.token}`
          const html = renderTaskEmail(task, rec.name || "team member", completeUrl, base)
          const medsText = (Array.isArray(task.medications) && task.medications.length ? task.medications : [{ name: task.medication }])
            .map((m: any) => `- ${m.name}${m.dose ? ` (${m.dose})` : ""}${m.due_at ? ` — due ${m.due_at}` : ""}${m.instructions ? ` — ${m.instructions}` : ""}`)
            .join("\n")
          const text = `New medication task\n\nPatient: ${task.patient_name}\nMedications:\n${medsText}\n${task.comments ? `\nNote: ${task.comments}\n` : ""}\nMark completed: ${completeUrl}`
          const r = await resend.emails.send({
            from: FROM_EMAIL,
            to: rec.email,
            subject: `${task.priority === "urgent" ? "[URGENT] " : ""}Medication task: ${task.patient_name}`,
            html,
            text,
          })
          if ((r as any).error) throw new Error((r as any).error.message)
          emailed++
        } catch (e: any) {
          emailErrors.push(`${rec.email}: ${e.message || "failed"}`)
        }
        await new Promise(res => setTimeout(res, 80))
      }
    } else {
      emailErrors.push("Email not configured (RESEND_API_KEY/FROM_EMAIL)")
    }

    return NextResponse.json({
      success: true,
      task_id: task.id,
      recipients: finalRecipients.length,
      emailed,
      email_errors: emailErrors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// ── PATCH: admin actions — complete, cancel, or edit a task ────────────────
// Body: { id, action: "complete" | "cancel" | "edit", by?, ...editFields }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || "").trim()
    const action = body.action
    if (!id || !["complete", "cancel", "edit"].includes(action)) {
      return NextResponse.json({ error: "id and a valid action (complete/cancel/edit) are required" }, { status: 400 })
    }

    const sb = admin()

    if (action === "complete") {
      const { data, error } = await sb
        .from("medication_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: body.by ? String(body.by) : "Admin", completed_via: "admin" })
        .eq("id", id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, task: data })
    }

    if (action === "cancel") {
      const { data, error } = await sb
        .from("medication_tasks")
        .update({ status: "cancelled" })
        .eq("id", id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, task: data })
    }

    // action === "edit"
    const updates: Record<string, any> = {}
    if ("patient_name" in body) updates.patient_name = String(body.patient_name || "").trim()
    if ("patient_account" in body) updates.patient_account = body.patient_account ? String(body.patient_account).trim() : null
    if ("priority" in body) updates.priority = body.priority === "urgent" ? "urgent" : "normal"
    if ("instructions" in body) updates.instructions = body.instructions ? String(body.instructions).trim() : null
    if ("comments" in body) updates.comments = body.comments ? String(body.comments).trim() : null
    if ("medications" in body && Array.isArray(body.medications)) {
      const meds = body.medications
        .map((m: any) => ({
          name: String(m.name || "").trim(),
          dose: m.dose ? String(m.dose).trim() : null,
          due_at: m.due_at ? String(m.due_at) : null,
          instructions: m.instructions ? String(m.instructions).trim() : null,
        }))
        .filter((m: any) => m.name)
      updates.medications = meds
      updates.medication = meds.map((m: any) => m.name).join(", ")
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await sb
      .from("medication_tasks").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, task: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// ── DELETE: remove a task + its recipients ─────────────────────────────────
// Query: ?id=XXX
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const sb = admin()
    // Recipients cascade-delete via foreign key, but let's be explicit
    await sb.from("medication_task_recipients").delete().eq("task_id", id)
    const { error } = await sb.from("medication_tasks").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function renderTaskEmail(task: any, recipientName: string, completeUrl: string, base: string): string {
  const urgent = task.priority === "urgent"
  const meds: any[] = Array.isArray(task.medications) && task.medications.length
    ? task.medications
    : [{ name: task.medication }]

  const medRows = meds.map(m => {
    const parts: string[] = []
    if (m.dose) parts.push(escapeHtml(m.dose))
    if (m.due_at) parts.push(`due ${formatDateTime(m.due_at)}`)
    if (m.instructions) parts.push(escapeHtml(m.instructions))
    const sub = parts.length ? `<div style="color:#6B7280;font-size:13px">${parts.join(" · ")}</div>` : ""
    return `<li style="margin-bottom:8px"><span style="color:#111827;font-weight:600">${escapeHtml(m.name)}</span>${sub}</li>`
  }).join("")

  return `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
        <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Medication Task</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
        ${urgent ? `<div style="background:#FEE2E2;color:#B91C1C;font-weight:600;padding:8px 12px;border-radius:8px;margin-bottom:16px;font-size:14px">⚠ URGENT</div>` : ""}
        <p style="margin:0 0 16px;color:#111827">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 12px;color:#374151">A medication task has been assigned:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
          <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:120px">Patient</td><td style="padding:6px 0;color:#111827;font-weight:600">${escapeHtml(task.patient_name)}</td></tr>
          ${task.patient_account ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Account</td><td style="padding:6px 0;color:#111827">${escapeHtml(task.patient_account)}</td></tr>` : ""}
        </table>
        <p style="margin:0 0 4px;color:#6B7280;font-size:13px">Medications</p>
        <ul style="margin:0 0 16px;padding-left:20px">${medRows}</ul>
        ${task.comments ? `<div style="background:#F0FDF9;border-left:3px solid #0B7C79;padding:10px 14px;border-radius:6px;margin-bottom:16px"><p style="margin:0;color:#374151;font-size:14px"><strong>Note:</strong> ${escapeHtml(task.comments)}</p></div>` : ""}
        <a href="${completeUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">✓ Mark as Completed</a>
        <p style="margin:20px 0 0;color:#9CA3AF;font-size:12px">Click the button when this task is done. North Falmouth Pharmacy · (508) 564-4459</p>
      </div>
    </div>
  </body></html>`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  } catch { return iso }
}
