import Link from "next/link"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import {
  ShieldCheck,
  Users,
  LogOut,
  Briefcase,
  CreditCard,
  Syringe,
  MessageSquare,
  UserCheck,
  BookOpen,
  UsersRound,
  FileStack,
  Bot,
  Pill,
  MessageCircle,
  Package,
  Barcode,
  ScanLine,
  Truck,
  AlertTriangle,
  Plus,
  Printer,
  ArrowUpRight,
  Boxes,
} from "lucide-react"

const sidebarLinks = [
  { href: "/admin", label: "Overview", icon: ShieldCheck, key: "dashboard" },
  { href: "/admin/assistant", label: "AI Assistant", icon: Bot, key: "assistant" },
  { href: "/admin/chats", label: "Chats", icon: MessageCircle, key: "chats" },
  { href: "/admin/enrollments", label: "Enrollments", icon: UserCheck, key: "enrollments" },
  { href: "/admin/credit-cards", label: "Credit Cards", icon: CreditCard, key: "credit-cards" },
  { href: "/admin/vaccines", label: "Vaccines", icon: Syringe, key: "vaccines" },
  { href: "/admin/contacts", label: "Contacts", icon: MessageSquare, key: "contacts" },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase, key: "jobs" },
  { href: "/admin/candidates", label: "Candidates", icon: Users, key: "candidates" },
  { href: "/admin/blogs", label: "Blog", icon: BookOpen, key: "blog" },
  { href: "/admin/customers", label: "Customers", icon: UsersRound, key: "crm" },
  { href: "/admin/statements", label: "Statements", icon: FileStack, key: "statements" },
  { href: "/admin/medication-tasks", label: "Medication Tasks", icon: Pill, key: "medication-tasks" },
  { href: "/admin/users", label: "User Management", icon: Users, key: "users" },

  { href: "/admin/inventory", label: "Inventory", icon: Package, key: "inventory" },
]

export const dynamic = "force-dynamic"

const statCards = [
  {
    title: "Total Products",
    value: "1,248",
    note: "Across all tracked items",
    icon: Boxes,
    tone: "emerald",
  },
  {
    title: "Low Stock",
    value: "36",
    note: "Needs reorder soon",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    title: "In Transit",
    value: "112",
    note: "Expected this week",
    icon: Truck,
    tone: "sky",
  },
  {
    title: "Damaged",
    value: "8",
    note: "Awaiting review",
    icon: AlertTriangle,
    tone: "rose",
  },
]

const recentMoves = [
  {
    product: "Amoxicillin 500mg",
    barcode: "FG-100245",
    action: "Sold",
    qty: "-2",
    when: "4 min ago",
    by: "Vera",
    tone: "rose",
  },
  {
    product: "Vitamin D 1000 IU",
    barcode: "FG-100991",
    action: "Add",
    qty: "+24",
    when: "9 min ago",
    by: "Admin",
    tone: "emerald",
  },
  {
    product: "Insulin Pen Needles",
    barcode: "FG-100411",
    action: "Transit",
    qty: "18",
    when: "15 min ago",
    by: "Ryan",
    tone: "sky",
  },
  {
    product: "Blood Pressure Monitor",
    barcode: "FG-100088",
    action: "Damaged",
    qty: "-1",
    when: "22 min ago",
    by: "Admin",
    tone: "amber",
  },
]

const products = [
  {
    name: "Amoxicillin 500mg",
    sku: "AMX-500",
    barcode: "FG-100245",
    stock: 42,
    transit: 12,
    damaged: 1,
    status: "Healthy",
  },
  {
    name: "Vitamin D 1000 IU",
    sku: "VTD-1000",
    barcode: "FG-100991",
    stock: 128,
    transit: 0,
    damaged: 0,
    status: "Healthy",
  },
  {
    name: "Insulin Pen Needles",
    sku: "IPN-031",
    barcode: "FG-100411",
    stock: 9,
    transit: 18,
    damaged: 0,
    status: "Low stock",
  },
  {
    name: "Blood Pressure Monitor",
    sku: "BPM-210",
    barcode: "FG-100088",
    stock: 4,
    transit: 2,
    damaged: 1,
    status: "Attention",
  },
]

function toneClasses(tone: string) {
  switch (tone) {
    case "amber":
      return {
        soft: "bg-amber-50 text-amber-700",
        icon: "bg-amber-100 text-amber-700",
        dot: "bg-amber-500",
      }
    case "rose":
      return {
        soft: "bg-rose-50 text-rose-700",
        icon: "bg-rose-100 text-rose-700",
        dot: "bg-rose-500",
      }
    case "sky":
      return {
        soft: "bg-sky-50 text-sky-700",
        icon: "bg-sky-100 text-sky-700",
        dot: "bg-sky-500",
      }
    default:
      return {
        soft: "bg-emerald-50 text-emerald-700",
        icon: "bg-emerald-100 text-emerald-700",
        dot: "bg-emerald-500",
      }
  }
}

export default async function AdminInventoryPage() {
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

  let allowedPages: string[] | null = null
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
        allowedPages = adminUser.active ? adminUser.allowed_pages || [] : []
      }
    } catch {}
  }

  const visibleLinks =
    allowedPages === null
      ? sidebarLinks
      : sidebarLinks.filter((l) => l.key === "dashboard" || allowedPages.includes(l.key))

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
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Inventory Center</h1>
              <p className="mt-1 text-sm text-white/85">
                Barcode creation, scan actions, stock updates, and print tools in one place.
              </p>
              <p className="mt-2 text-xs text-white/70">Welcome back, {displayName}</p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/admin"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/logout?redirect=/admin/login"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-white ring-1 ring-white/20 hover:bg-red-500/30"
              >
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
              {visibleLinks.map((link) => {
                const active = link.href === "/admin/inventory"
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                        active
                          ? "bg-emerald-50 font-medium text-emerald-800"
                          : "text-gray-700 hover:bg-emerald-50"
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <div className="space-y-8">
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Inventory workflow
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">
                  Scan, label, and update stock faster
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Use this page to create barcodes, print product labels, and process inventory actions
                  like add, sold, transit, and damaged with a cleaner workflow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
                  <ScanLine className="h-4 w-4" />
                  Scan
                </button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                  <Barcode className="h-4 w-4" />
                  Generate
                </button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                  <Plus className="h-4 w-4" />
                  Product
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              const tone = toneClasses(card.tone)
              return (
                <div key={card.title} className="rounded-xl border border-emerald-900/10 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
                      <p className="mt-1 text-xs text-gray-500">{card.note}</p>
                    </div>
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone.icon}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              )
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Scan Action Panel</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Scan a barcode, confirm the product, then choose the inventory action.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Mobile ready
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
                <input
                  placeholder="Enter or scan barcode..."
                  className="h-11 rounded-lg border border-gray-200 px-4 text-sm outline-none ring-0 placeholder:text-gray-400 focus:border-emerald-500"
                />
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0B7C79] px-5 text-sm font-medium text-white hover:bg-[#0a6b68]">
                  <ScanLine className="h-4 w-4" />
                  Start scan
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Last scanned
                    </p>
                    <h4 className="mt-2 text-lg font-semibold text-gray-900">Amoxicillin 500mg</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald-900/10">
                        SKU: AMX-500
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald-900/10">
                        Barcode: FG-100245
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald-900/10">
                        In stock: 42
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/admin/inventory/product/amoxicillin-500mg"
                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Open product <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <button className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800">
                    Add
                  </button>
                  <button className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-700">
                    Transit
                  </button>
                  <button className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white hover:bg-rose-700">
                    Sold
                  </button>
                  <button className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600">
                    Damaged
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Quantity</label>
                    <input
                      defaultValue="1"
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Warehouse</label>
                    <select className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
                      <option>Main Warehouse</option>
                      <option>Front Store</option>
                      <option>Transit Hold</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Notes</label>
                    <input
                      placeholder="Optional note"
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0B7C79] px-5 text-sm font-medium text-white hover:bg-[#0a6b68]">
                    Save inventory update
                  </button>
                  <button className="inline-flex h-11 items-center justify-center rounded-lg border border-emerald-900/10 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Barcode Label Tools</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Generate and print labels for products and shelves.
                  </p>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Barcode className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Select product</label>
                  <select className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
                    <option>Amoxicillin 500mg</option>
                    <option>Vitamin D 1000 IU</option>
                    <option>Insulin Pen Needles</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Barcode format</label>
                  <select className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
                    <option>Code 128</option>
                    <option>EAN-13</option>
                    <option>QR Code</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Label size</label>
                  <select className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
                    <option>2 x 1 inch</option>
                    <option>3 x 2 inch</option>
                    <option>4 x 6 inch</option>
                  </select>
                </div>

                <div className="rounded-xl border border-dashed border-gray-200 bg-[#F7F5EF] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Preview</p>
                  <div className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <p className="text-sm font-medium text-gray-900">Amoxicillin 500mg</p>
                    <p className="mt-1 text-xs text-gray-500">SKU: AMX-500</p>
                    <div className="mt-4 h-16 rounded bg-[repeating-linear-gradient(90deg,#111_0px,#111_2px,transparent_2px,transparent_4px)]" />
                    <p className="mt-2 text-center text-xs tracking-[0.25em] text-gray-700">FG-100245</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
                    <Printer className="h-4 w-4" />
                    Print label
                  </button>
                  <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                    <Barcode className="h-4 w-4" />
                    Generate new
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Inventory Activity</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Latest stock movements from barcode scans and manual updates.
                  </p>
                </div>
                <button className="rounded-lg border border-emerald-900/10 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                  View all
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-[0.16em] text-gray-500">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Barcode</th>
                      <th className="pb-3 font-medium">Action</th>
                      <th className="pb-3 font-medium">Qty</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMoves.map((move) => {
                      const tone = toneClasses(move.tone)
                      return (
                        <tr key={`${move.product}-${move.when}`} className="border-b border-gray-50">
                          <td className="py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{move.product}</p>
                            </div>
                          </td>
                          <td className="py-4 text-sm text-gray-600">{move.barcode}</td>
                          <td className="py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone.soft}`}>
                              {move.action}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-medium text-gray-900">{move.qty}</td>
                          <td className="py-4 text-sm text-gray-600">{move.by}</td>
                          <td className="py-4 text-sm text-gray-500">{move.when}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Products</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Quick stock view with barcode access.
                  </p>
                </div>
                <button className="rounded-lg border border-emerald-900/10 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50">
                  Manage list
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {products.map((product) => (
                  <div
                    key={product.barcode}
                    className="rounded-xl border border-gray-100 bg-[#FCFBF8] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {product.sku} · {product.barcode}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          product.status === "Healthy"
                            ? "bg-emerald-50 text-emerald-700"
                            : product.status === "Low stock"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <div className="rounded-lg bg-white p-3 ring-1 ring-black/5">
                        <p className="text-gray-500">Stock</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{product.stock}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3 ring-1 ring-black/5">
                        <p className="text-gray-500">Transit</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{product.transit}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3 ring-1 ring-black/5">
                        <p className="text-gray-500">Damaged</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{product.damaged}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800">
                        Scan
                      </button>
                      <button className="rounded-lg border border-emerald-900/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50">
                        Print
                      </button>
                      <Link
                        href={`/admin/inventory/product/${product.sku.toLowerCase()}`}
                        className="rounded-lg border border-emerald-900/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
