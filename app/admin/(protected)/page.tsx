import Link from "next/link"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import {
  ShieldCheck, BadgeCheck, Users, FileText, Newspaper, LogOut,
  Briefcase, Mail, CreditCard, Syringe, MessageSquare, Receipt, UserCheck, BookOpen, UsersRound, FileStack
} from "lucide-react"
import { Button } from "@/components/ui/button"
import AnalyticsDashboard from "@/components/AnalyticsDashboard"

function HeroBadge({
  icon: Icon, title, desc,
}: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/20 text-white">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-90">{desc}</p>
      </div>
    </div>
  )
}

const sidebarLinks = [
  { href: "/admin", label: "Overview", icon: ShieldCheck, active: true },
  { href: "/admin/enrollments", label: "Enrollments", icon: UserCheck },
  { href: "/admin/credit-cards", label: "Credit Cards", icon: CreditCard },
  { href: "/admin/vaccines", label: "Vaccines", icon: Syringe },
  { href: "/admin/contacts", label: "Contacts", icon: MessageSquare },
  { href: "/admin/bills", label: "Bills", icon: Receipt },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { href: "/admin/candidates", label: "Candidates", icon: Users },
  { href: "/admin/blogs", label: "Blog", icon: BookOpen },
  { href: "/admin/subscribers", label: "Subscribers", icon: UsersRound },
  { href: "/admin/customers", label: "Customers", icon: UsersRound },
  { href: "/admin/statements", label: "Statements", icon: FileStack },
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

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section
        className="relative isolate overflow-hidden"
        style={{
          background: "linear-gradient(135deg,#0EA171 0%, #0B8F79 50%, #0B7C79 100%)",
          paddingTop: "96px",
          paddingBottom: "104px",
          marginTop: "12px",
          marginBottom: 0,
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-start gap-6">
            <span className="hidden h-24 w-1 rounded bg-white/80 md:block" aria-hidden="true" />
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-white md:text-4xl">Admin Portal</h1>
              <p className="mt-3 max-w-2xl text-white/90">
                Manage enrollments, jobs, blogs, statements, and more — all in one secure workspace.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <HeroBadge icon={ShieldCheck} title="HIPAA Compliant" desc="Data privacy & security" />
                <HeroBadge icon={BadgeCheck} title="Licensed & Certified" desc="Massachusetts pharmacy" />
                <HeroBadge icon={Users} title="Community Focused" desc="Serving Cape Cod since 2013" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div
          className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-xl border border-emerald-900/10 bg-white px-4 py-4 shadow-md md:rounded-2xl md:px-6"
          style={{ marginTop: "-36px" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">{displayName}</p>
              <p className="text-xs text-gray-500">Role: admin</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-900/10 px-3 text-sm text-emerald-700 hover:bg-emerald-50">View Site</Link>
            <Link href="/admin/logout?redirect=/admin/login" className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-900/10 px-3 text-sm text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Logout
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 pt-10 pb-16 md:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <nav className="rounded-xl border border-emerald-900/10 bg-white p-2 shadow-sm">
            <ul className="space-y-1">
              {sidebarLinks.map((link) => (
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
