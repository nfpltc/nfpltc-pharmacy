import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Maps each protected admin path to the permission key required to view it.
// Keep in sync with ALL_PAGES in app/api/admin/users/route.ts
const PATH_PAGE_MAP: { prefix: string; key: string }[] = [
  { prefix: "/admin/inventory", key: "inventory" },
  { prefix: "/admin/users", key: "users" },
  { prefix: "/admin/assistant", key: "assistant" },
  { prefix: "/admin/chats", key: "chats" },
  { prefix: "/admin/enrollments", key: "enrollments" },
  { prefix: "/admin/credit-cards", key: "credit-cards" },
  { prefix: "/admin/vaccines", key: "vaccines" },
  { prefix: "/admin/contacts", key: "contacts" },
  { prefix: "/admin/jobs", key: "jobs" },
  { prefix: "/admin/candidates", key: "jobs" }, // candidates merged into jobs page
  { prefix: "/admin/blogs", key: "blog" },
  { prefix: "/admin/customers", key: "crm" },
  { prefix: "/admin/statements", key: "statements" },
  { prefix: "/admin/medication-tasks", key: "medication-tasks" },
  { prefix: "/admin/bills", key: "statements" },
  { prefix: "/admin/subscribers", key: "crm" },
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only guard admin pages, skip login/logout/public admin routes and all API routes
  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login") || pathname.startsWith("/admin/logout")) {
    return NextResponse.next()
  }
  // The dashboard itself (/admin exactly) is always visible — it self-filters its sidebar
  if (pathname === "/admin") {
    return NextResponse.next()
  }

  const match = PATH_PAGE_MAP.find(m => pathname.startsWith(m.prefix))
  if (!match) return NextResponse.next() // unknown/new admin path — allow (fail-open for pages not yet mapped)

  const res = NextResponse.next()

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return req.cookies.get(name)?.value },
          set(name: string, value: string, options: any) { res.cookies.set({ name, value, ...options }) },
          remove(name: string, options: any) { res.cookies.set({ name, value: "", ...options }) },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.redirect(new URL("/admin/login", req.url))

    // Look up role/permissions via REST (service role) — middleware runs on the edge, no direct DB client needed
    const lookupUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/admin_users?email=eq.${encodeURIComponent(user.email)}&select=role,allowed_pages,active`
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    })

    if (!lookupRes.ok) return res // table/lookup unavailable — fail-open (don't lock everyone out)
    const rows = await lookupRes.json()
    const list: any[] = Array.isArray(rows) ? rows : (rows ? [rows] : [])

    // No admin_users record = backward-compatible full access (legacy admin accounts)
    if (list.length === 0) return res

    // Resolve access across ALL rows for this email, most-permissive. If the
    // email has a duplicate/ambiguous record, the page layout still shows the
    // full sidebar (its .maybeSingle() lookup fails open), so the middleware must
    // agree or a real admin gets bounced from guarded pages while others load.
    // A genuinely restricted single account is unaffected (union of one row).
    if (list.some(u => u.role === "admin")) return res
    const activeRows = list.filter(u => u.active)
    // Every matching record is deactivated = block entirely.
    if (activeRows.length === 0) return NextResponse.redirect(new URL("/admin/login?deactivated=1", req.url))

    const allowed = new Set<string>()
    for (const u of activeRows) for (const p of (u.allowed_pages || [])) allowed.add(String(p))
    if (!allowed.has(match.key)) {
      // Redirect to dashboard — the user never sees the page or a "denied"
      // message referencing the page name, just lands back on their overview.
      return NextResponse.redirect(new URL("/admin", req.url))
    }

    return res
  } catch {
    return res // fail-open on unexpected errors so a bug here can't lock out all admins
  }
}

export const config = {
  matcher: ["/admin/:path*"],
}
