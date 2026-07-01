import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { Package, ScanLine, BarChart3, AlertTriangle, Truck, Boxes, ArrowRight, PackagePlus, PackageMinus } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function InventoryOverviewPage() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const [{ data: items }, { data: moves }] = await Promise.all([
    sb.from("inventory_items").select("quantity_in_stock,quantity_in_transit,quantity_damaged,reorder_threshold").eq("active", true),
    sb.from("inventory_movements").select("*, inventory_items(name,sku)").order("created_at", { ascending: false }).limit(8),
  ])
  const all = items || []
  const stats = {
    total:   all.length,
    low:     all.filter(i => i.quantity_in_stock <= i.reorder_threshold).length,
    transit: all.reduce((s, i) => s + (i.quantity_in_transit || 0), 0),
    damaged: all.reduce((s, i) => s + (i.quantity_damaged || 0), 0),
  }
  const cfg: Record<string, { badge: string; sign: string }> = {
    add: { badge: "bg-emerald-50 text-emerald-700", sign: "+" },
    sold: { badge: "bg-rose-50 text-rose-700", sign: "-" },
    damaged: { badge: "bg-amber-50 text-amber-700", sign: "-" },
    transit: { badge: "bg-sky-50 text-sky-700", sign: "+" },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Products", value: stats.total,   icon: Boxes,        color: "bg-emerald-100 text-emerald-700" },
          { label: "Low Stock",      value: stats.low,     icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
          { label: "In Transit",     value: stats.transit, icon: Truck,         color: "bg-sky-100 text-sky-700" },
          { label: "Damaged",        value: stats.damaged, icon: AlertTriangle, color: "bg-rose-100 text-rose-700" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className={"h-10 w-10 rounded-xl flex items-center justify-center mb-3 " + s.color}><s.icon className="h-5 w-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/inventory/scan" className="flex items-center justify-between rounded-xl border-2 border-[#0B7C79] bg-[#0B7C79] p-5 text-white shadow-sm hover:bg-[#0a6b68] transition-colors group">
          <div><ScanLine className="h-6 w-6 mb-2" /><p className="font-bold text-base">Scan Session</p><p className="text-sm text-white/70">Scan multiple products at once</p></div>
          <ArrowRight className="h-5 w-5 text-white/60 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/admin/inventory/products" className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition-all group">
          <div><Package className="h-6 w-6 text-gray-600 mb-2" /><p className="font-bold text-base text-gray-900">Products</p><p className="text-sm text-gray-500">Manage and print labels</p></div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/admin/inventory/activity" className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition-all group">
          <div><BarChart3 className="h-6 w-6 text-gray-600 mb-2" /><p className="font-bold text-base text-gray-900">Activity Log</p><p className="text-sm text-gray-500">Full movement history</p></div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
          <Link href="/admin/inventory/activity" className="text-xs text-[#0B7C79] hover:underline">View all</Link>
        </div>
        {(!moves || moves.length === 0) ? (
          <div className="py-10 text-center text-sm text-gray-400">No activity yet — start your first scan session!</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {moves.map((m: any) => {
              const c = cfg[m.action] || cfg.add
              const item = m.inventory_items
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={"h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 " + (["add","transit"].includes(m.action) ? "bg-emerald-50" : "bg-rose-50")}>
                    {["add","transit"].includes(m.action) ? <PackagePlus className="h-4 w-4 text-emerald-600" /> : <PackageMinus className="h-4 w-4 text-rose-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item?.name || "—"}</p>
                    <p className="text-xs text-gray-400">{item?.sku}</p>
                  </div>
                  <div className="text-right">
                    <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + c.badge}>{m.action}</span>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{c.sign}{m.quantity}</p>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
