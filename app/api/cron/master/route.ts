import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { generateOneBlogPost, shouldGenerateNow } from "@/lib/blog-automation"
import { signUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// ============================================================================
// MASTER CRON — runs every 12 hours via Vercel.
// Handles three jobs, each with its own internal timing gate:
//   1. Blog generation    — checks settings (daily/weekly/monthly/paused)
//   2. Monthly newsletter — runs on the 1st of each month only
//   3. Medication follow-up — resends reminders for pending tasks
// ============================================================================

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get("authorization") || ""
  return h === `Bearer ${secret}`
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const isTest = url.searchParams.get("test") === "1"
  const force = url.searchParams.get("force") === "1"

  if (!isTest && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // ── Job 1: Blog Generation ───────────────────────────────────────────
  try {
    const gate = await shouldGenerateNow()
    if (force || gate.should) {
      const r = await generateOneBlogPost(gate.autoPublish)
      results.blog = r.success
        ? { generated: true, title: r.title, status: r.status }
        : { generated: false, error: r.error }
    } else {
      results.blog = { skipped: true, reason: gate.reason }
    }
  } catch (e: any) {
    results.blog = { error: e.message }
  }

  // ── Job 2: Monthly Newsletter ────────────────────────────────────────
  try {
    results.newsletter = await runNewsletter(req, force)
  } catch (e: any) {
    results.newsletter = { error: e.message }
  }

  // ── Job 3: Medication Follow-ups ─────────────────────────────────────
  try {
    results.medication_followup = await runMedicationFollowup(req)
  } catch (e: any) {
    results.medication_followup = { error: e.message }
  }

  // ── Job 4: Daily Task Digest to Admin ──────────────────────────────────
  try {
    results.daily_digest = await runDailyDigest()
  } catch (e: any) {
    results.daily_digest = { error: e.message }
  }

  return NextResponse.json({ timestamp: new Date().toISOString(), ...results })
}

// ── Newsletter: only on the 1st of each month ─────────────────────────────
async function runNewsletter(req: NextRequest, force: boolean): Promise<any> {
  const now = new Date()
  // Only run on the 1st of the month (or if forced)
  if (!force && now.getUTCDate() !== 1) {
    return { skipped: true, reason: "Not the 1st of the month" }
  }

  const sb = admin()

  // Check if we already sent this month
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const { count: alreadySent } = await sb
    .from("customer_email_log")
    .select("id", { count: "exact", head: true })
    .eq("email_type", "newsletter")
    .gte("sent_at", `${monthKey}-01`)
  if (!force && (alreadySent ?? 0) > 0) {
    return { skipped: true, reason: "Newsletter already sent this month" }
  }

  // Latest blog
  const { data: blogs } = await sb
    .from("blog_posts")
    .select("id, title, slug, excerpt, featured_image")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
  const blog = blogs?.[0]
  if (!blog) return { skipped: true, reason: "No published blog" }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  if (!RESEND_API_KEY || !FROM_EMAIL) return { skipped: true, reason: "Email not configured" }

  const resend = new Resend(RESEND_API_KEY)
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.nfpltc.com"
  const blogUrl = `${base}/blog/${blog.slug}`
  const secret = (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string

  // All opted-in customers with email
  const recipients: any[] = []
  let from = 0
  while (from < 200_000) {
    const { data: page } = await sb
      .from("customers")
      .select("account_number, first_name, email")
      .eq("email_opt_in", true)
      .not("email", "is", null).neq("email", "")
      .range(from, from + 999)
    if (!page || page.length === 0) break
    recipients.push(...page)
    if (page.length < 1000) break
    from += 1000
  }

  let sent = 0
  for (const c of recipients) {
    try {
      const unsubUrl = `${base}/unsubscribe?t=${signUnsubscribeToken(c.account_number, secret)}`
      const img = blog.featured_image ? `<img src="${blog.featured_image}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px" />` : ""
      const html = `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;padding:24px">
          <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
            <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Monthly Health Tips</p>
          </div>
          <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
            <p style="margin:0 0 16px;color:#111827">Hi ${escapeHtml(c.first_name || "there")},</p>
            ${img}
            <h2 style="margin:0 0 8px;color:#0B7C79;font-size:22px">${escapeHtml(blog.title)}</h2>
            <p style="margin:0 0 20px;line-height:1.6;color:#374151">${escapeHtml(blog.excerpt || "")}</p>
            <a href="${blogUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Read more</a>
          </div>
          <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:16px"><a href="${unsubUrl}" style="color:#9CA3AF">Unsubscribe</a></p>
        </div>
      </body></html>`

      await resend.emails.send({
        from: FROM_EMAIL, to: c.email,
        subject: `${blog.title} — North Falmouth Pharmacy`,
        html,
        text: `${blog.title}\n\n${blog.excerpt || ""}\n\nRead more: ${blogUrl}\n\nUnsubscribe: ${unsubUrl}`,
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      })

      try {
        await sb.from("customer_email_log").insert({
          account_number: c.account_number, email_to: c.email,
          email_type: "newsletter", subject: blog.title,
          status: "sent", sent_at: new Date().toISOString(),
        })
      } catch {}
      sent++
    } catch {}
    await new Promise(res => setTimeout(res, 110))
  }

  return { sent, total_recipients: recipients.length, blog_title: blog.title }
}

// ── Medication follow-ups: pending tasks needing reminders ────────────────
const MAX_FOLLOWUPS = 3

async function runMedicationFollowup(req: NextRequest): Promise<any> {
  const sb = admin()
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  if (!RESEND_API_KEY || !FROM_EMAIL) return { skipped: true, reason: "Email not configured" }

  // Fetch all pending tasks that haven't exceeded max follow-ups.
  // We check each task's individual interval in code since they vary.
  const { data: tasks } = await sb
    .from("medication_tasks")
    .select("*")
    .eq("status", "pending")
    .lt("follow_up_count", MAX_FOLLOWUPS)
    .order("created_at", { ascending: true })
    .limit(50)

  if (!tasks || tasks.length === 0) return { followed_up: 0, reason: "No tasks need follow-up" }

  const now = Date.now()
  const resend = new Resend(RESEND_API_KEY)
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.nfpltc.com"
  let totalEmailed = 0
  const followed: string[] = []

  for (const task of tasks) {
    // Per-task interval check (default 12 hours if not set)
    const intervalHours = task.follow_up_interval_hours || 12
    const lastNotified = task.last_notified_at ? new Date(task.last_notified_at).getTime() : 0
    const hoursSince = (now - lastNotified) / 3_600_000

    if (hoursSince < intervalHours) continue  // not due yet for THIS task
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
        const meds: any[] = Array.isArray(task.medications) && task.medications.length
          ? task.medications : [{ name: task.medication }]
        const medList = meds.map((m: any) =>
          `<li style="margin-bottom:4px"><strong>${escapeHtml(m.name)}</strong>${m.dose ? ` · ${escapeHtml(m.dose)}` : ""}</li>`
        ).join("")

        const html = `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
          <div style="max-width:560px;margin:0 auto;padding:24px">
            <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
              <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
              <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Medication Task — Reminder #${followUpNum}</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
              <div style="background:#FEF3C7;color:#92400E;font-weight:600;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px">
                ⏰ Reminder #${followUpNum} — This task is still pending
              </div>
              ${task.priority === "urgent" ? `<div style="background:#FEE2E2;color:#B91C1C;font-weight:600;padding:8px 12px;border-radius:8px;margin-bottom:12px;font-size:14px">⚠ URGENT</div>` : ""}
              <p style="margin:0 0 12px;color:#111827">Hi ${escapeHtml(rec.name || "team member")},</p>
              <p style="margin:0 0 12px;color:#374151">This medication task hasn't been completed yet:</p>
              <table style="width:100%;margin-bottom:12px">
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:100px">Patient</td><td style="color:#111827;font-weight:600">${escapeHtml(task.patient_name)}</td></tr>
              </table>
              <p style="margin:0 0 4px;color:#6B7280;font-size:13px">Medications</p>
              <ul style="margin:0 0 16px;padding-left:20px">${medList}</ul>
              ${task.comments ? `<div style="background:#F0FDF9;border-left:3px solid #0B7C79;padding:8px 12px;border-radius:6px;margin-bottom:16px;font-size:13px"><strong>Note:</strong> ${escapeHtml(task.comments)}</div>` : ""}
              <a href="${completeUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">✓ Mark as Completed</a>
              <p style="margin:16px 0 0;color:#9CA3AF;font-size:12px">${followUpNum >= MAX_FOLLOWUPS ? "This is the final reminder." : "You'll receive another reminder if this isn't completed."}</p>
            </div>
          </div>
        </body></html>`

        await resend.emails.send({
          from: FROM_EMAIL, to: rec.email,
          subject: `⏰ Reminder #${followUpNum}: Medication task — ${task.patient_name}`,
          html,
          text: `REMINDER #${followUpNum}\nPatient: ${task.patient_name}\nMedication: ${task.medication || ""}\nMark completed: ${completeUrl}`,
        })
        emailed++
      } catch (e: any) {
        console.error(`followup email failed ${rec.email}:`, e.message)
      }
      await new Promise(res => setTimeout(res, 100))
    }

    await sb.from("medication_tasks").update({
      follow_up_count: followUpNum,
      last_notified_at: new Date().toISOString(),
    }).eq("id", task.id)

    totalEmailed += emailed
    followed.push(task.patient_name)
  }

  return { followed_up: followed.length, total_emailed: totalEmailed, patients: followed }
}

// ── Daily Task Digest: sends admin a morning summary email ────────────────
async function runDailyDigest(): Promise<any> {
  const sb = admin()
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
  const ADMIN_EMAIL = process.env.TO_EMAIL || process.env.FROM_EMAIL
  if (!RESEND_API_KEY || !FROM_EMAIL || !ADMIN_EMAIL) {
    return { skipped: true, reason: "Email not configured" }
  }

  // Only send once per day: check if we already sent a digest today
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: alreadySent } = await sb
    .from("customer_email_log")
    .select("id", { count: "exact", head: true })
    .eq("email_type", "task_digest")
    .gte("sent_at", todayStart.toISOString())
  if ((alreadySent ?? 0) > 0) {
    return { skipped: true, reason: "Digest already sent today" }
  }

  // Gather task data
  const now = new Date()
  const todayISO = todayStart.toISOString()
  const next12h = new Date(now.getTime() + 12 * 3600000).toISOString()

  // Completed today
  const { data: completedToday } = await sb
    .from("medication_tasks")
    .select("patient_name, medication, completed_by, completed_at, completed_via")
    .eq("status", "completed")
    .gte("completed_at", todayISO)
    .order("completed_at", { ascending: false })
    .limit(50)

  // All pending
  const { data: pending } = await sb
    .from("medication_tasks")
    .select("patient_name, medication, medications, priority, created_at, follow_up_count, follow_up_interval_hours, last_notified_at")
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50)

  // Overdue: pending tasks where any medication's due_at is past
  const overdue = (pending || []).filter(t => {
    const meds = Array.isArray(t.medications) ? t.medications : []
    return meds.some((m: any) => m.due_at && new Date(m.due_at) < now)
  })

  // Upcoming: pending tasks with medication due in next 12 hours
  const upcoming = (pending || []).filter(t => {
    const meds = Array.isArray(t.medications) ? t.medications : []
    return meds.some((m: any) => {
      if (!m.due_at) return false
      const d = new Date(m.due_at)
      return d >= now && d <= new Date(next12h)
    })
  })

  const pendingCount = (pending || []).length
  const completedCount = (completedToday || []).length
  const overdueCount = overdue.length
  const upcomingCount = upcoming.length

  // Build the email
  const html = renderDigestEmail({
    completedToday: completedToday || [],
    pending: pending || [],
    overdue,
    upcoming,
    pendingCount,
    completedCount,
    overdueCount,
    upcomingCount,
  })

  const resend = new Resend(RESEND_API_KEY)
  try {
    const subject = `📋 Task Digest: ${pendingCount} pending${overdueCount ? `, ${overdueCount} overdue` : ""}${completedCount ? `, ${completedCount} completed today` : ""}`
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
      text: `Task Digest\n\nPending: ${pendingCount}\nOverdue: ${overdueCount}\nCompleted today: ${completedCount}\nUpcoming (12h): ${upcomingCount}`,
    })

    // Log it so we don't send again today
    try {
      await sb.from("customer_email_log").insert({
        account_number: "SYSTEM",
        email_to: ADMIN_EMAIL,
        email_type: "task_digest",
        subject: `Task Digest`,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
    } catch {}

    return { sent: true, pending: pendingCount, overdue: overdueCount, completed_today: completedCount, upcoming_12h: upcomingCount }
  } catch (e: any) {
    return { error: e.message }
  }
}

function renderDigestEmail(d: {
  completedToday: any[]; pending: any[]; overdue: any[]; upcoming: any[];
  pendingCount: number; completedCount: number; overdueCount: number; upcomingCount: number;
}): string {
  const section = (title: string, color: string, icon: string, items: any[], renderer: (t: any) => string) => {
    if (items.length === 0) return `<p style="color:#9CA3AF;font-size:13px;margin:8px 0">${icon} No ${title.toLowerCase()}</p>`
    return `
      <h3 style="margin:16px 0 8px;color:${color};font-size:15px">${icon} ${title} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${items.map(renderer).join("")}
      </table>`
  }

  const taskRow = (t: any, extra?: string) => `
    <tr style="border-bottom:1px solid #F3F4F6">
      <td style="padding:6px 8px;font-weight:600;color:#111827">${escapeHtml(t.patient_name)}</td>
      <td style="padding:6px 8px;color:#374151">${escapeHtml(t.medication || "")}</td>
      <td style="padding:6px 8px;color:#6B7280;font-size:12px">${extra || ""}</td>
    </tr>`

  return `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};border-radius:12px;padding:20px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
        <p style="margin:6px 0 0;color:#ffffffcc;font-size:13px">Daily Medication Task Digest</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:20px;margin-top:16px">
        <!-- Summary cards -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr>
            <td style="text-align:center;padding:12px;background:#FEF3C7;border-radius:8px;width:25%">
              <div style="font-size:24px;font-weight:700;color:#92400E">${d.pendingCount}</div>
              <div style="font-size:11px;color:#92400E">Pending</div>
            </td>
            <td style="width:8px"></td>
            <td style="text-align:center;padding:12px;background:${d.overdueCount > 0 ? "#FEE2E2" : "#F3F4F6"};border-radius:8px;width:25%">
              <div style="font-size:24px;font-weight:700;color:${d.overdueCount > 0 ? "#B91C1C" : "#6B7280"}">${d.overdueCount}</div>
              <div style="font-size:11px;color:${d.overdueCount > 0 ? "#B91C1C" : "#6B7280"}">Overdue</div>
            </td>
            <td style="width:8px"></td>
            <td style="text-align:center;padding:12px;background:#D1FAE5;border-radius:8px;width:25%">
              <div style="font-size:24px;font-weight:700;color:#065F46">${d.completedCount}</div>
              <div style="font-size:11px;color:#065F46">Done Today</div>
            </td>
            <td style="width:8px"></td>
            <td style="text-align:center;padding:12px;background:#EFF6FF;border-radius:8px;width:25%">
              <div style="font-size:24px;font-weight:700;color:#1E40AF">${d.upcomingCount}</div>
              <div style="font-size:11px;color:#1E40AF">Next 12h</div>
            </td>
          </tr>
        </table>

        ${d.overdueCount > 0 ? section("Overdue", "#B91C1C", "🔴", d.overdue, t => {
          const meds = Array.isArray(t.medications) ? t.medications : []
          const overdueMed = meds.find((m: any) => m.due_at && new Date(m.due_at) < new Date())
          const ago = overdueMed ? Math.round((Date.now() - new Date(overdueMed.due_at).getTime()) / 3600000) + "h ago" : ""
          return taskRow(t, `${t.priority === "urgent" ? "⚠ " : ""}${ago}`)
        }) : ""}

        ${section("Upcoming (Next 12h)", "#1E40AF", "🔵", d.upcoming, t => {
          const meds = Array.isArray(t.medications) ? t.medications : []
          const nextMed = meds.find((m: any) => m.due_at && new Date(m.due_at) >= new Date())
          const inH = nextMed ? Math.round((new Date(nextMed.due_at).getTime() - Date.now()) / 3600000) + "h" : ""
          return taskRow(t, `in ${inH}`)
        })}

        ${section("All Pending", "#92400E", "🟡", d.pending, t =>
          taskRow(t, `${t.priority === "urgent" ? "⚠ urgent" : ""} ${t.follow_up_count ? `· ${t.follow_up_count} reminder${t.follow_up_count > 1 ? "s" : ""}` : ""}`)
        )}

        ${section("Completed Today", "#065F46", "✅", d.completedToday, t =>
          taskRow(t, `by ${escapeHtml(t.completed_by || "—")} ${t.completed_via === "link" ? "(email)" : "(manual)"}`)
        )}

        <p style="margin:20px 0 0;text-align:center">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.nfpltc.com"}/admin/medication-tasks" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">View All Tasks →</a>
        </p>
      </div>
      <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:12px">North Falmouth Pharmacy · (508) 564-4459</p>
    </div>
  </body></html>`
}
