"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Bot, MessageCircle, UserCheck, CreditCard, Syringe,
  MessageSquare, Briefcase, Users, BookOpen, UsersRound, FileStack,
  Pill, Package, ShieldCheck, ExternalLink
} from "lucide-react"

const NAV = [
  { href: "/admin",                  label: "Dashboard",        icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/assistant",        label: "AI Assistant",     icon: Bot,             key: "assistant" },
  { href: "/admin/chats",            label: "Chats",            icon: MessageCircle,   key: "chats" },
  { href: "/admin/enrollments",      label: "Enrollments",      icon: UserCheck,       key: "enrollments" },
  { href: "/admin/credit-cards",     label: "Credit Cards",     icon: CreditCard,      key: "credit-cards" },
  { href: "/admin/vaccines",         label: "Vaccines",         icon: Syringe,         key: "vaccines" },
  { href: "/admin/contacts",         label: "Contacts",         icon: MessageSquare,   key: "contacts" },
  { href: "/admin/jobs",             label: "Jobs",             icon: Briefcase,       key: "jobs" },
  { href: "/admin/candidates",       label: "Candidates",       icon: Users,           key: "candidates" },
  { href: "/admin/blogs",            label: "Blog",             icon: BookOpen,        key: "blog" },
  { href: "/admin/customers",        label: "Customers",        icon: UsersRound,      key: "crm" },
  { href: "/admin/statements",       label: "Statements",       icon: FileStack,       key: "statements" },
  { href: "/admin/medication-tasks", label: "Medication Tasks", icon: Pill,            key: "medication-tasks" },
  { href: "/admin/inventory",        label: "Inventory",        icon: Package,         key: "inventory" },
  { href: "/admin/users",            label: "User Management",  icon: ShieldCheck,     key: "users" },
]

export default function AdminSidebar({ allowedPages }: { allowedPages: string[] | null }) {
  const pathname = usePathname()

  const visible = allowedPages === null
    ? NAV
    : NAV.filter(n => n.key === "dashboard" || allowedPages.includes(n.key))

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold"
          style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B7C79 100%)" }}>
          NF
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">NFPLTC</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Admin Portal</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {visible.map(link => {
            const active = isActive(link.href)
            return (
              <li key={link.href}>
                <Link href={link.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-emerald-50 font-semibold text-emerald-800"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}>
                  <link.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-emerald-700" : "text-gray-400"}`} />
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <Link href="/" target="_blank"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700">
          <ExternalLink className="h-3.5 w-3.5" />
          View Live Site
        </Link>
      </div>
    </aside>
  )
}
