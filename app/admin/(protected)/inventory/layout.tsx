import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import {
  ShieldCheck, Users, LogOut, Briefcase, CreditCard, Syringe, MessageSquare,
  UserCheck, BookOpen, UsersRound, FileStack, Bot, Pill, MessageCircle, Package,
  LayoutDashboard, ScanLine, BarChart3
} from "lucide-react"
import FloatingScanButton from "./FloatingScanButton"

export const dynamic = "force-dynamic"

const adminSidebar = [
  { href: "/admin",                  label: "Overview",         icon: ShieldCheck,   key: "dashboard" },
  { href: "/admin/assistant",        label: "AI Assistant",     icon: Bot,           key: "assistant" },
  { href: "/admin/chats",            label: "Chats",            icon: MessageCircle, key: "chats" },
  { href: "/admin/enrollments",      label: "Enrollments",      icon: UserCheck,     key: "enrollments" },
  { href: "/admin/credit-cards",     label: "Credit Cards",     icon: CreditCard,    key: "credit-cards" },
  { href: "/admin/vaccines",         label: "Vaccines",         icon: Syringe,       key: "vaccines" },
  { href: "/admin/contacts",         label: "Contacts",         icon: MessageSquare, key: "contacts" },
  { href: "/admin/jobs",             label: "Jobs",             icon: Briefcase,     key: "jobs" },
  { href: "/admin/candidates",       label: "Candidates",       icon: Users,         key: "candidates" },
  { href: "/admin/blogs",            label: "Blog",             icon: BookOpen,      key: "blog" },
  { href: "/admin/customers",        label: "Customers",        icon: UsersRound,    key: "crm" },
  { href: "/admin/statements",       label: "Statements",       icon: FileStack,     key: "statements" },
  { href: "/admin/medication-tasks", label: "Medication Tasks", icon: Pill,          key: "medication-tasks" },
  { href: "/admin/inventory",        label: "Inventory",        icon: Package,       key: "inventory" },
  { href: "/admin/users",            label: "User Management",  icon: Users,         key: "users" },
]

const inventoryNav = [
  { href: "/admin/inventory",          label: "Overview",  icon: LayoutDashboard },
  { href: "/admin/inventory/scan",     label: "Scan",      icon: ScanLine },
  { href: "/admin/inventory/products", label: "Products",  icon: Package },
  { href: "/admin/inventory/activity", label: "Activity",  icon: BarChart3 },
]

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  // Get current user - the parent (protected) layout already verified auth,
  // so here we just read the session to get display name + permissions.
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Admin"

  // Permission filtering for sidebar (best-effort, non-blocking)
  let allowedPages: string[] | null = null
  if (user?.email) {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data: au } = await sb
        .from("admin_users")
        .select("role,allowed_pages,active")
        .eq("email", user.email)
        .maybeSingle()
      if (au && au.role !== "admin") {
        allowedPages = au.active ? au.allowed_pages || [] : []
      }
    } catch {}
  }

  const visibleAdmin = allowedPages === null
    ? adminSidebar
    : adminSidebar.filter(l => l.key === "dashboard" || allowedPages!.includes(l.key))

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/60 hover:text-white transition-colors">
              <ShieldCheck className="h-5 w-5" />
            </Link>
            <span className="text-white/40">/</span>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-white" />
              <span className="text-base font-semibold text-white">Inventory</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">{displayName}</span>
            <Link href="/admin/logout?redirect=/admin/login"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs text-white ring-1 ring-white/20 hover:bg-red-500/30">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </Link>
          </div>
        </div>
        {/* Inventory sub-nav tabs */}
        <div className="mx-auto w-full max-w-7xl px-6">
          <nav className="flex gap-0">
            {inventoryNav.map(n => (
              <Link key={n.href} href={n.href}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/40 transition-all">
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 pt-6 pb-14 lg:grid-cols-[200px_1fr]">
        {/* Admin sidebar */}
        <aside className="hidden lg:block">
          <nav className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm sticky top-4">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Admin Menu
            </p>
            <ul className="space-y-0.5">
              {visibleAdmin.map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs ${link.key === "inventory" ? "bg-emerald-50 font-semibold text-emerald-800" : "text-gray-600 hover:bg-gray-50"}`}>
                    <link.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Page content */}
        <div>{children}</div>
      </div>

      {/* Floating scan button */}
      <FloatingScanButton />
    </main>
  )
}
