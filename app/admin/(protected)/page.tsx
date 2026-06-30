import Link from "next/link"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import {
  ShieldCheck, Users, LogOut,
  Briefcase, CreditCard, Syringe, MessageSquare, Receipt, UserCheck, BookOpen, UsersRound, FileStack, Bot, Pill, MessageCircle
} from "lucide-react"
import AnalyticsDashboard from "@/components/AnalyticsDashboard"

const sidebarLinks = [
  { href: "/admin", label: "Overview", icon: ShieldCheck, active: true, key: "dashboard" },
  { href: "/admin/assistant", label: "AI Assistant", icon: Bot, key: "assistant" },
  { href: "/admin/chats", label: "Chats", icon: MessageCircle, key: "chats" },
  { href: "/admin/enrollments", label: "Enrollments", icon: UserCheck, key: "enrollments" },
  { href: "/admin/credit-cards", label: "Credit Cards", icon: CreditCard, key: "credit-cards" },
  { href: "/admin/vaccines", label: "Vaccines", icon: Syringe, key: "vaccines" },
  { href: "/admin/contacts", label: "Contacts", icon: MessageSquare, key: "contacts" },
  // { href: "/admin/bills", label: "Bills", icon: Receipt },          // hidden from sidebar (page still works via direct URL)
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase, key: "jobs" },
  { href: "/admin/candidates", label: "Candidates", icon: Users, key: "candidates" },
  { href: "/admin/blogs", label: "Blog", icon: BookOpen, key: "blog" },
  // { href: "/admin/subscribers", label: "Subscribers", icon: UsersRound }, // hidden from sidebar (page still works via direct URL)
  { href: "/admin/customers", label: "Customers", icon: UsersRound, key: "crm" },
  { href: "/admin/statements", label: "Statements", icon: FileStack, key: "statements" },
  { href: "/admin/medication-tasks", label: "Medication Tasks", icon: Pill, key: "medication-tasks" },
  { href: "/admin/users", label: "User Management", icon: Users, key: "users" },
]

export const dynamic = "force-dynamic"

export default async function AdminHomePage() {
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Admin"

  // Look up this user's role + allowed pages (service-role client, bypasses RLS)
  let allowedPages: string[] | null = null // null = full access (admin or no record found, backward compat)
  if (user?.email) {
    try {
      const adminSb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data: adminUser } = await adminSb
        .from("admin_users")
        .select("role, allowed_pages, active")
        .eq("email", user.email)
        .maybeSingle()
      if (adminUser && adminUser.role !== "admin") {
        allowedPages = adminUser.active ? (adminUser.allowed_pages || []) : []
      }
    } catch { /* table may not exist yet — fall back to full access */ }
  }

  const visibleLinks = allowedPages === null
    ? sidebarLinks
    : sidebarLinks.filter(l => l.key === "dashboard" || allowedPages!.includes(l.key))

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section
        className="relative isolate overflow-hidden"
        style={{
          background: "linear-gradient(135deg,#0EA171 0%, #0B8F79 50%, #0B7C79 100%)",
          paddingTop: "32px",
          paddingBottom: "44px",
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Admin Portal</h1>
              <p className="mt-1 text-sm text-white/85">
                Welcome back, {displayName}
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white hover:bg-white/20 ring-1 ring-white/20">
                View Site
              </Link>
              <Link href="/admin/logout?redirect=/admin/login" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white hover:bg-red-500/30 ring-1 ring-white/20">
                <LogOut className="h-4 w-4" /> Logout
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pt-8 pb-16 md:grid-cols-[220px_1fr]">
        <aside className="space-y-3">
          <nav className="rounded-xl border border-emerald-900/10 bg-white p-2 shadow-sm">
            <ul className="space-y-1">
              {visibleLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                      link.active
                        ? "font-medium text-emerald-800 bg-emerald-50"
                        : "text-gray-700 hover:bg-emerald-50"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div>
          <AnalyticsDashboard />

          <div className="mt-10 rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Quick Links</h2>
            <p className="mt-1 text-sm text-gray-600">Common admin tasks</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/statements" className="group rounded-lg border border-emerald-900/10 p-4 hover:bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-700/10 text-emerald-700"><FileStack className="h-5 w-5" /></div>
                  <div><p className="font-medium text-gray-900">Statements</p><p className="text-xs text-gray-600">Bulk upload PDFs</p></div>
                </div>
              </Link>
              <Link href="/admin/customers" className="group rounded-lg border border-emerald-900/10 p-4 hover:bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-700/10 text-emerald-700"><UsersRound className="h-5 w-5" /></div>
                  <div><p className="font-medium text-gray-900">Customers</p><p className="text-xs text-gray-600">Manage email list</p></div>
                </div>
              </Link>
              <Link href="/admin/jobs" className="group rounded-lg border border-emerald-900/10 p-4 hover:bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-700/10 text-emerald-700"><Briefcase className="h-5 w-5" /></div>
                  <div><p className="font-medium text-gray-900">Job Listings</p><p className="text-xs text-gray-600">Manage careers</p></div>
                </div>
              </Link>
              <Link href="/admin/blogs" className="group rounded-lg border border-emerald-900/10 p-4 hover:bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-700/10 text-emerald-700"><BookOpen className="h-5 w-5" /></div>
                  <div><p className="font-medium text-gray-900">Blog Posts</p><p className="text-xs text-gray-600">Write articles</p></div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
