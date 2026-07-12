"use client"
import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { PrintLabelModal } from "@/components/inventory/PrintLabelModal"
import { Printer, Pencil, Check, Loader2 } from "lucide-react"

type Item = { id: string; name: string; sku: string; barcode: string; category: string; form?: string; strength?: string; quantity_in_stock: number; quantity_in_transit: number; quantity_damaged: number; reorder_threshold: number; notes?: string }
type Move = { id: string; action: string; quantity: number; notes?: string; location?: string; scanned_by?: string; created_at: string }

const ACTION_BADGE: Record<string, string> = { add: "bg-emerald-50 text-emerald-700", sold: "bg-rose-50 text-rose-700", damaged: "bg-amber-50 text-amber-700", transit: "bg-sky-50 text-sky-700" }

export default function ProductDetailClient({ item: init, movements }: { item: Item; movements: Move[] }) {
  const [item, setItem] = useState(init)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: init.name, strength: init.strength || "", form: init.form || "", notes: init.notes || "", reorder_threshold: String(init.reorder_threshold) })
  const [saving, setSaving] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch("/api/admin/inventory/items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, ...form, reorder_threshold: Number(form.reorder_threshold) }) })
      const d = await r.json()
      if (r.ok) { setItem({ ...item, ...form, reorder_threshold: Number(form.reorder_threshold) }); setEditing(false) }
    } finally { setSaving(false) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
      {/* Left: product info + barcode */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            {editing ? (
              <input value={form.name} onChange={e => set("name", e.target.value)} className="flex-1 text-xl font-bold text-gray-900 border-b-2 border-emerald-500 bg-transparent focus:outline-none mr-2" />
            ) : (
              <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
            )}
            <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${editing ? "bg-emerald-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Save" : "Edit"}
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {[
              ["SKU", item.sku],
              ["Barcode", item.barcode],
              ["Category", item.category],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-gray-500">{l}</span>
                <span className="font-medium text-gray-900">{v}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-500">Strength</span>
              {editing ? <input value={form.strength} onChange={e => set("strength", e.target.value)} className="text-right border-b border-gray-200 bg-transparent focus:outline-none text-sm font-medium w-24" placeholder="500mg" />
              : <span className="font-medium text-gray-900">{item.strength || "—"}</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Form</span>
              {editing ? <input value={form.form} onChange={e => set("form", e.target.value)} className="text-right border-b border-gray-200 bg-transparent focus:outline-none text-sm font-medium w-24" placeholder="TAB" />
              : <span className="font-medium text-gray-900">{item.form || "—"}</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reorder at</span>
              {editing ? <input type="number" value={form.reorder_threshold} onChange={e => set("reorder_threshold", e.target.value)} className="text-right border-b border-gray-200 bg-transparent focus:outline-none text-sm font-medium w-16" />
              : <span className="font-medium text-gray-900">{item.reorder_threshold} units</span>}
            </div>
          </div>

          {/* Stock summary */}
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[["In Stock", item.quantity_in_stock, item.quantity_in_stock <= item.reorder_threshold ? "text-amber-700" : "text-emerald-700"], ["Transit", item.quantity_in_transit, "text-sky-700"], ["Damaged", item.quantity_damaged, "text-rose-700"]].map(([l, v, cls]) => (
              <div key={l as string} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className={`text-xl font-bold ${cls}`}>{v}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          {editing && (
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          )}
          {!editing && item.notes && <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{item.notes}</p>}
        </div>

        {/* QR label card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">QR Label</h2>
            <button onClick={() => setShowPrint(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a6b68]">
              <Printer className="h-3.5 w-3.5" /> Print Label
            </button>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
            <div className="mx-auto" style={{ width: 130, height: 130 }}>
              <QRCodeSVG value={item.barcode || item.sku} size={130} level="M" marginSize={2} style={{ width: "100%", height: "100%" }} />
            </div>
            <p className="mt-2 text-xs tracking-widest text-gray-500">{item.barcode}</p>
          </div>
        </div>
      </div>

      {/* Right: movement history */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Movement History</h2>
          <p className="text-xs text-gray-500 mt-0.5">{movements.length} records</p>
        </div>
        {movements.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No movements yet — scan this product to start tracking.</div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {movements.map(m => (
              <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_BADGE[m.action] || ACTION_BADGE.add}`}>{m.action}</span>
                    <span className="text-sm font-bold text-gray-900">{["add","transit"].includes(m.action) ? "+" : "-"}{m.quantity} units</span>
                  </div>
                  {m.location && <p className="text-xs text-gray-400 mt-0.5">📍 {m.location}</p>}
                  {m.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{m.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  {m.scanned_by && <p className="text-[10px] text-gray-300 mt-0.5">{m.scanned_by.split("@")[0]}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPrint && <PrintLabelModal item={item} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
