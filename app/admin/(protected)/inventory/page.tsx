import Link from "next/link"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import {
  ShieldCheck, Users, LogOut, Briefcase, CreditCard, Syringe, MessageSquare,
  UserCheck, BookOpen, UsersRound, FileStack, Bot, Pill, MessageCircle,
  Package, Barcode, ScanLine, Truck, AlertTriangle, Boxes,
} from "lucide-react"
import { ScanPanel, BarcodePanel, MovementsTable, ProductsList } from "./InventoryClient"

export const dynamic = "force-dynamic"

const sidebarLinks = [
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

export default async function AdminInventoryPage() {
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Admin"

  // Permission check
  let allowedPages: string[] | null = null
  if (user?.email) {
    try {
      const adminSb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data: adminUser } = await adminSb
        .from("admin_users").select("role, allowed_pages, active").eq("email", user.email).maybeSingle()
      if (adminUser && adminUser.role !== "admin") {
        allowedPages = adminUser.active ? adminUser.allowed_pages || [] : []
      }
    } catch {}
  }
  const visibleLinks = allowedPages === null
    ? sidebarLinks
    : sidebarLinks.filter(l => l.key === "dashboard" || allowedPages!.includes(l.key))

  // ── Real data from Supabase ────────────────────────────────────────────────
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const [
    { data: items },
    { data: movements },
  ] = await Promise.all([
    sb.from("inventory_items").select("*").eq("active", true).order("name").limit(200),
    sb.from("inventory_movements").select("*, inventory_items(name, sku, barcode)").order("created_at", { ascending: false }).limit(30),
  ])

  const allItems = items || []
  const allMovements = movements || []

  const totalItems    = allItems.length
  const lowStock      = allItems.filter(i => i.quantity_in_stock <= i.reorder_threshold).length
  const totalTransit  = allItems.reduce((s, i) => s + (i.quantity_in_transit || 0), 0)
  const totalDamaged  = allItems.reduce((s, i) => s + (i.quantity_damaged || 0), 0)

  const stats = [
    { title: "Total Products",  value: totalItems,   note: "Active tracked items",     icon: Boxes,         tone: "emerald" },
    { title: "Low Stock",       value: lowStock,      note: "At or below reorder level", icon: AlertTriangle, tone: "amber" },
    { title: "In Transit",      value: totalTransit,  note: "Units incoming",            icon: Truck,         tone: "sky" },
    { title: "Damaged",         value: totalDamaged,  note: "Awaiting review",           icon: AlertTriangle, tone: "rose" },
  ]

  function toneCls(tone: string) {
    switch (tone) {
      case "amber":  return { icon: "bg-amber-100 text-amber-700" }
      case "rose":   return { icon: "bg-rose-100 text-rose-700" }
      case "sky":    return { icon: "bg-sky-100 text-sky-700" }
      default:       return { icon: "bg-emerald-100 text-emerald-700" }
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <section className="relative isolate overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", paddingTop: 32, paddingBottom: 44 }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Inventory Center</h1>
              <p className="mt-1 text-sm text-white/85">Barcode creation, scan actions, stock updates and print tools.</p>
              <p className="mt-2 text-xs text-white/70">Welcome back, {displayName}</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/admin" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white ring-1 ring-white/20 hover:bg-white/20">Dashboard</Link>
              <Link href="/admin/logout?redirect=/admin/login" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white ring-1 ring-white/20 hover:bg-red-500/30">
                <LogOut className="h-4 w-4" /> Logout
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pt-8 pb-16 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside>
          <nav className="rounded-xl border border-emerald-900/10 bg-white p-2 shadow-sm">
            <ul className="space-y-1">
              {visibleLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${link.href === "/admin/inventory" ? "bg-emerald-50 font-medium text-emerald-800" : "text-gray-700 hover:bg-emerald-50"}`}>
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <div className="space-y-8">
          {/* Intro banner */}
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Inventory workflow</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900">Scan, label, and update stock faster</h2>
              <p className="mt-2 text-sm text-gray-600">Use any USB barcode scanner, mobile camera, or Bluetooth scanner. Works on every device.</p>
            </div>
          </section>

          {/* Stat cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(card => {
              const t = toneCls(card.tone)
              return (
                <div key={card.title} className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
                      <p className="mt-1 text-xs text-gray-500">{card.note}</p>
                    </div>
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${t.icon}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              )
            })}
          </section>

          {/* Scan panel + barcode tools side by side */}
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <ScanPanel />
            <BarcodePanel items={allItems} />
          </section>

          {/* Recent movements + products list */}
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Inventory Activity</h3>
                  <p className="mt-1 text-sm text-gray-600">Latest stock movements from barcode scans and updates.</p>
                </div>
              </div>
              <MovementsTable movements={allMovements} />
            </div>
            <ProductsList items={allItems} />
          </section>
        </div>
      </section>
    </main>
  )
}
