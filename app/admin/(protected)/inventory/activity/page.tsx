import { createClient } from "@supabase/supabase-js"
import Link from "next/link"

export const dynamic = "force-dynamic"

const BADGE: Record<string, string> = { add: "bg-emerald-50 text-emerald-700", sold: "bg-rose-50 text-rose-700", damaged: "bg-amber-50 text-amber-700", transit: "bg-sky-50 text-sky-700" }

export default async function ActivityPage() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: moves } = await sb.from("inventory_movements").select("*, inventory_items(name,sku,id)").order("created_at", { ascending: false }).limit(200)
  const all = moves || []

  const summary = all.reduce((acc: Record<string, number>, m) => { acc[m.action] = (acc[m.action] || 0) + 1; return acc }, {})

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Activity Log</h1>
        <p className="text-xs text-gray-500 mt-0.5">{all.length} total movements</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(summary).map(([action, count]) => (
          <span key={action} className={`rounded-full px-3 py-1 text-sm font-medium ${BADGE[action] || "bg-gray-50 text-gray-600"}`}>
            {action.charAt(0).toUpperCase() + action.slice(1)}: {count}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {all.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No activity yet — start a scan session to record movements.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Product", "Action", "Qty", "Location", "Note", "By", "When"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {all.map((m: any) => {
                  const item = m.inventory_items
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        {item ? (
                          <Link href={`/admin/inventory/products/${item.id}`} className="hover:text-emerald-700">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.sku}</p>
                          </Link>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[m.action] || "bg-gray-50 text-gray-600"}`}>{m.action}</span></td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{["add","transit"].includes(m.action) ? "+" : "-"}{m.quantity}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{m.location || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{m.notes || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{m.scanned_by?.split("@")[0] || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
