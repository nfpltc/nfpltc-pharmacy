import Link from "next/link"
import { Package, LayoutDashboard, ScanLine, BarChart3 } from "lucide-react"

export const dynamic = "force-dynamic"

const inventoryNav = [
  { href: "/admin/inventory",          label: "Overview",  icon: LayoutDashboard },
  { href: "/admin/inventory/scan",     label: "Scan",      icon: ScanLine },
  { href: "/admin/inventory/products", label: "Products",  icon: Package },
  { href: "/admin/inventory/activity", label: "Activity",  icon: BarChart3 },
]

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Sub-navigation tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {inventoryNav.map(n => (
          <Link key={n.href} href={n.href}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors">
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
