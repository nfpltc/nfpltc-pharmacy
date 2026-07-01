"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Search } from "lucide-react"

// Map paths to clean page titles
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/admin": "Dashboard",
    "/admin/assistant": "AI Assistant",
    "/admin/chats": "Chats",
    "/admin/enrollments": "Enrollments",
    "/admin/credit-cards": "Credit Cards",
    "/admin/vaccines": "Vaccines",
    "/admin/contacts": "Contacts",
    "/admin/jobs": "Jobs & Candidates",
    "/admin/candidates": "Candidates",
    "/admin/blogs": "Blog",
    "/admin/customers": "Customers",
    "/admin/statements": "Statements",
    "/admin/medication-tasks": "Medication Tasks",
    "/admin/inventory": "Inventory",
    "/admin/inventory/scan": "Scan Session",
    "/admin/inventory/products": "Products",
    "/admin/inventory/activity": "Activity Log",
    "/admin/users": "User Management",
  }
  // Exact match first
  if (map[pathname]) return map[pathname]
  // Prefix match for dynamic routes (e.g. /admin/inventory/products/[id])
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (pathname.startsWith(key)) return map[key]
  }
  return "Admin"
}

export default function AdminHeader({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{displayName}</span>
        <Link href="/admin/logout?redirect=/admin/login"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Logout
        </Link>
      </div>
    </header>
  )
}
