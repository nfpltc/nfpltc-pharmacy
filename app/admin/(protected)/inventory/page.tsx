import Link from "next/link"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import {
  ShieldCheck, Users, LogOut, Briefcase, CreditCard, Syringe, MessageSquare,
  UserCheck, BookOpen, UsersRound, FileStack, Bot, Pill, MessageCircle, Package,
  AlertTriangle, Truck, Boxes
} from "lucide-react"
import { ScanPanel, MovementsTable, ProductsList } from "./InventoryClient"

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

  let allowedPages: string[] | null = null
  if (user?.email) {
    try {
      const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data: au } = await adminSb.from("admin_users").select("role,allowed_pages,active").eq("email", user.email).maybeSingle()
      if (au && au.role !== "admin") allowedPages = au.active ? au.allowed_pages || [] : []
    } catch {}
  }
  const visibleLinks = allowedPages === null ? sidebarLinks : sidebarLinks.filter(l => l.key === "dashboard" || allowedPages!.includes(l.key))

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const [{ data: items }, { data: movements }] = await Promise.all([
    sb.from("inventory_items").select("*").eq("active", true).order("name").limit(200),
    sb.from("inventory_movements").select("*, inventory_items(name,sku,barcode)").order("created_at", { ascending: false }).limit(20),
  ])

  const all = items || []
  const totalItems   = all.length
  const lowStock     = all.filter(i => i.quantity_in_stock <= i.reorder_threshold).length
  const totalTransit = all.reduce((s, i) => s + (i.quantity_in_transit || 0), 0)
  const totalDamaged = all.reduce((s, i) => s + (i.quantity_damaged || 0), 0)

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <section style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white">Inventory</h1>
              <p className="mt-0.5 text-sm text-white/75">Welcome back, {displayName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs text-white ring-1 ring-white/20 hover:bg-white/20">Dashboard</Link>
              <Link href="/admin/logout?redirect=/admin/login" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs text-white ring-1 ring-white/20 hover:bg-red-500/30">
                <LogOut className="h-3.5 w-3.5" /> Logout
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 pt-6 pb-14 md:grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside>
          <nav className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm sticky top-4">
            <ul className="space-y-0.5">
              {visibleLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${link.href === "/admin/inventory" ? "bg-emerald-50 font-medium text-emerald-800" : "text-gray-600 hover:bg-gray-50"}`}>
                    <link.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <div className="space-y-5">

          {/* Stat row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Products", value: totalItems,   icon: Boxes,         color: "text-emerald-700 bg-emerald-50" },
              { label: "Low Stock", value: lowStock,    icon: AlertTriangle,  color: "text-amber-700 bg-amber-50" },
              { label: "In Transit", value: totalTransit, icon: Truck,        color: "text-sky-700 bg-sky-50" },
              { label: "Damaged",  value: totalDamaged, icon: AlertTriangle,  color: "text-rose-700 bg-rose-50" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Two-column: scan + products */}
          <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">

            {/* LEFT: Scan panel */}
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Scan Barcode</h2>
                    <p className="text-xs text-gray-500 mt-0.5">USB scanner, camera, or type manually</p>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">All devices</span>
                </div>
                <ScanPanel />
              </div>

              {/* Recent activity */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h2>
                <MovementsTable movements={movements || []} />
              </div>
            </div>

            {/* RIGHT: Products */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Products</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Click a product to see its barcode and print label</p>
                </div>
              </div>
              <ProductsList items={all} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
