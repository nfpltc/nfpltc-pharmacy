import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { signUnsubscribeToken } from "@/lib/statement-email"

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

function unsubSecret() {
  return (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string
}

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"

// GET /api/cron/monthly-newsletter
// Runs monthly (configured in vercel.json). Sends the latest published blog
// post to all opted-in customers with an email address.
//
// Auth: requires the CRON_SECRET as a query param or Bearer header, matching
// the existing daily-blog cron pattern.
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "")
    const isTest = searchParams.get("test") === "1"
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sb = admin()

    // Latest published blog
    const { data: blogs } = await sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
    const blog = blogs?.[0]
    if (!blog) return NextResponse.json({ error: "No published blog to send" }, { status: 404 })

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }
    const resend = new Resend(RESEND_API_KEY)

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.nfpltc.com"
    const blogUrl = `${base}/blog/${blog.slug}`

    // All opted-in customers with email (paginated past 1000-row cap)
    const recipients: any[] = []
    const PAGE = 1000
    let from = 0
    while (from < 200_000) {
      const { data: page } = await sb
        .from("customers")
        .select("account_number, first_name, email, email_opt_in")
        .eq("email_opt_in", true)
        .not("email", "is", null)
        .neq("email", "")
        .range(from, from + PAGE - 1)
      if (!page || page.length === 0) break
      recipients.push(...page)
      if (page.length < PAGE) break
      from += PAGE
    }

    // In test mode, only send to the first recipient (avoid spamming everyone)
    const targets = isTest ? recipients.slice(0, 1) : recipients

    let sent = 0
    const failures: string[] = []

    // Send sequentially with a tiny delay to respect Resend rate limits
    for (const c of targets) {
      try {
        const unsubscribeUrl = `${base}/unsubscribe?t=${signUnsubscribeToken(c.account_number, unsubSecret())}`
        const html = renderNewsletter(blog, c.first_name || "there", blogUrl, unsubscribeUrl)
        const text = `${blog.title}\n\n${blog.excerpt || ""}\n\nRead more: ${blogUrl}\n\nUnsubscribe: ${unsubscribeUrl}`

        const r = await resend.emails.send({
          from: FROM_EMAIL,
          to: c.email,
          subject: `${blog.title} — North Falmouth Pharmacy`,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })
        if ((r as any).error) throw new Error((r as any).error.message)

        try {
          await sb.from("customer_email_log").insert({
            account_number: c.account_number,
            email_to: c.email,
            email_type: "newsletter",
            subject: blog.title,
            status: "sent",
            resend_message_id: (r as any).data?.id || null,
            sent_at: new Date().toISOString(),
          })
        } catch { /* non-fatal */ }

        sent++
      } catch (e: any) {
        failures.push(`${c.account_number}: ${e.message || "failed"}`)
      }
      // ~10 emails/sec max
      await new Promise(res => setTimeout(res, 110))
    }

    return NextResponse.json({
      blog_title: blog.title,
      total_recipients: targets.length,
      sent,
      failed: failures.length,
      failures: failures.slice(0, 20),
      test_mode: isTest,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function renderNewsletter(blog: any, firstName: string, blogUrl: string, unsubscribeUrl: string): string {
  const img = blog.featured_image
    ? `<img src="${blog.featured_image}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px" />`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
        <p style="margin:8px 0 0;color:#ffffffcc;font-size:13px">Monthly Health Tips</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
        <p style="margin:0 0 16px;color:#111827">Hi ${escapeHtml(firstName)},</p>
        ${img}
        <h2 style="margin:0 0 8px;color:#0B7C79;font-size:22px">${escapeHtml(blog.title)}</h2>
        <p style="margin:0 0 20px;line-height:1.6;color:#374151">${escapeHtml(blog.excerpt || "")}</p>
        <a href="${blogUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Read more</a>
        <p style="margin:24px 0 0;color:#6B7280;font-size:14px">North Falmouth Pharmacy · (508) 564-4459</p>
      </div>
      <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:16px">
        You're receiving this because you're a valued customer.<br>
        <a href="${unsubscribeUrl}" style="color:#9CA3AF">Unsubscribe</a>
      </p>
    </div>
  </body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
