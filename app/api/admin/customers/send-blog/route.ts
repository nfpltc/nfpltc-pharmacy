import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { signUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

function unsubSecret() {
  return (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string
}

const BRAND = "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)"

// POST /api/admin/customers/send-blog
// Body: { account_number, blog_id (optional — defaults to latest published) }
// Sends a blog post email to one customer.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const account = String(body.account_number || "").trim()
    const blogId = body.blog_id ? String(body.blog_id) : null

    if (!account) {
      return NextResponse.json({ error: "account_number is required" }, { status: 400 })
    }

    const sb = admin()

    const { data: customer } = await sb
      .from("customers")
      .select("account_number, first_name, email, email_opt_in")
      .eq("account_number", account)
      .maybeSingle()

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    if (!customer.email) return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 })
    if (!customer.email_opt_in) return NextResponse.json({ error: "Customer has opted out" }, { status: 400 })

    // Get the blog post — specific one, or latest published
    let blogQuery = sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
    if (blogId) {
      blogQuery = sb
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image")
        .eq("id", blogId)
        .limit(1)
    }
    const { data: blogs } = await blogQuery
    const blog = blogs?.[0]
    if (!blog) return NextResponse.json({ error: "No blog post found to send" }, { status: 404 })

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM_EMAIL = process.env.FROM_EMAIL || process.env.STATEMENT_FROM_EMAIL
    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const base = publicBaseUrl(req)
    const unsubscribeUrl = `${base}/unsubscribe?t=${signUnsubscribeToken(account, unsubSecret())}`
    const blogUrl = `${base}/blog/${blog.slug}`
    const html = renderBlogEmail(blog, customer.first_name || "there", blogUrl, unsubscribeUrl)
    const text = `${blog.title}\n\n${blog.excerpt || ""}\n\nRead more: ${blogUrl}\n\nUnsubscribe: ${unsubscribeUrl}`

    const resend = new Resend(RESEND_API_KEY)
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      subject: blog.title,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if ((r as any).error) {
      return NextResponse.json({ error: (r as any).error.message || "Send failed" }, { status: 500 })
    }

    try {
      await sb.from("customer_email_log").insert({
        account_number: account,
        email_to: customer.email,
        email_type: "blog",
        subject: blog.title,
        status: "sent",
        resend_message_id: (r as any).data?.id || null,
        sent_at: new Date().toISOString(),
      })
    } catch (e) { console.error("email log failed (non-fatal):", e) }

    return NextResponse.json({ success: true, blog_title: blog.title })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

function renderBlogEmail(blog: any, firstName: string, blogUrl: string, unsubscribeUrl: string): string {
  const img = blog.featured_image
    ? `<img src="${blog.featured_image}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px" />`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};border-radius:12px;padding:24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:20px">North Falmouth Pharmacy</h1>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-top:16px">
        <p style="margin:0 0 16px;color:#111827">Hi ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 16px;color:#374151">We thought you might find this helpful:</p>
        ${img}
        <h2 style="margin:0 0 8px;color:#0B7C79;font-size:22px">${escapeHtml(blog.title)}</h2>
        <p style="margin:0 0 20px;line-height:1.6;color:#374151">${escapeHtml(blog.excerpt || "")}</p>
        <a href="${blogUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Read the full article</a>
        <p style="margin:24px 0 0;color:#6B7280;font-size:14px">North Falmouth Pharmacy · (508) 564-4459</p>
      </div>
      <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:16px">
        <a href="${unsubscribeUrl}" style="color:#9CA3AF">Unsubscribe</a>
      </p>
    </div>
  </body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
