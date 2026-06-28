import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

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

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"
const MAX_FOLLOWUPS = 3
const MIN_HOURS = 12  // minimum hours between follow-ups

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// GET /api/cron/medication-followup
// Runs every 12 hours via Vercel cron. Finds pending tasks that haven't been
// completed AND have been notified 12+ hours ago AND have < 3 follow-ups.
// Re-sends reminder emails to recipients who haven't clicked "Mark Completed."
export async function GET(req: NextRequest) {
  try {
    // Auth
    const secret = process.env.CRON_SECRET
    const h = req.headers.get("authorization") || ""
    const url = new URL(req.url)
    const isTest = url.searchParams.get("test") === "1"
    if (!isTest && secret && h !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sb = admin()
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.nfpltc.com"
    const cutoff = new Date(Date.now() - MIN_HOURS * 3600000).toISOString()

    // Find pending tasks due for a follow-up
    const { data: tasks } = await sb
      .from("medication_tasks")
      .select("*")
      .eq("status", "pending")
      .lt("follow_up_count", MAX_FOLLOWUPS)
      .lt("last_notified_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(50)

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: "No tasks need follow-up", followed_up: 0 })
    }

    const resend = new Resend(RESEND_API_KEY)
    let totalEmailed = 0
    const results: any[] = []

    for (const task of tasks) {
      // Get recipients who haven't clicked (haven't completed via link)
      const { data: recipients } = await sb
        .from("medication_task_recipients")
        .select("id, email, name, token, clicked_at")
        .eq("task_id", task.id)
        .is("clicked_at", null)

      if (!recipients || recipients.length === 0) continue

      const followUpNum = (task.follow_up_count || 0) + 1
      let emailed = 0

      for (const rec of recipients) {
        try {
          const completeUrl = `${base}/medication-task/complete?token=${rec.token}`
          const html = renderFollowUpEmail(task, rec.name || "team member", completeUrl, followUpNum)
          const subject = `⏰ Reminder #${followUpNum}: Medication task — ${task.patient_name}`

          const r = await resend.emails.send({
            from: FROM_EMAIL,
            to: rec.email,
            subject,
            html,
            text: `REMINDER #${followUpNum}\n\nPatient: ${task.patient_name}\nMedication: ${task.medication || ""}\n\nThis task is still pending. Please mark it as completed:\n${completeUrl}`,
          })
          if ((r as any).error) throw new Error((r as any).error.message)
          emailed++
        } catch (e: any) {
          console.error(`followup email failed ${rec.email}:`, e.message)
        }
        await new Promise(res => setTimeout(res, 100))
      }

      // Update the task's follow-up tracking
      await sb.from("medication_tasks").update({
        follow_up_count: followUpNum,
        last_notified_at: new Date().toISOString(),
      }).eq("id", task.id)

      totalEmailed += emailed
      results.push({
        task_id: task.id,
        patient: task.patient_name,
        follow_up_num: followUpNum,
        recipients_emailed: emailed,
      })
    }

    return NextResponse.json({
      followed_up: results.length,
      total_emailed: totalEmailed,
      results: isTest ? results : undefined,
    })
  } catch (err: any) {
    console.error("medication-followup cron error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function renderFollowUpEmail(task: any, recipientName: string, completeUrl: string, followUpNum: number): string {
  const urgent = task.priority === "urgent"
  const meds: any[] = Array.isArray(task.medications) && task.medications.length
    ? task.medications : [{ name: task.medication }]

  const medList = meds.map(m =>
    `<li style="margin-bottom:4px"><strong>${escapeHtml(m.name)}</strong>${m.dose ? ` · ${escapeHtml(m.dose)}` : ""}</li>`
  ).join("")

  return `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
        <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Medication Task — Reminder #${followUpNum}</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
        <div style="background:#FEF3C7;color:#92400E;font-weight:600;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px">
          ⏰ Reminder #${followUpNum} — This task is still pending
        </div>
        ${urgent ? `<div style="background:#FEE2E2;color:#B91C1C;font-weight:600;padding:8px 12px;border-radius:8px;margin-bottom:12px;font-size:14px">⚠ URGENT</div>` : ""}
        <p style="margin:0 0 12px;color:#111827">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 12px;color:#374151">This medication task hasn't been marked as completed yet:</p>
        <table style="width:100%;margin-bottom:12px">
          <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:100px">Patient</td><td style="color:#111827;font-weight:600">${escapeHtml(task.patient_name)}</td></tr>
        </table>
        <p style="margin:0 0 4px;color:#6B7280;font-size:13px">Medications</p>
        <ul style="margin:0 0 16px;padding-left:20px">${medList}</ul>
        ${task.comments ? `<div style="background:#F0FDF9;border-left:3px solid #0B7C79;padding:8px 12px;border-radius:6px;margin-bottom:16px;font-size:13px"><strong>Note:</strong> ${escapeHtml(task.comments)}</div>` : ""}
        <a href="${completeUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">✓ Mark as Completed</a>
        <p style="margin:16px 0 0;color:#9CA3AF;font-size:12px">${followUpNum >= MAX_FOLLOWUPS ? "This is the final reminder." : `You'll receive another reminder if this isn't completed.`}</p>
      </div>
    </div>
  </body></html>`
}
