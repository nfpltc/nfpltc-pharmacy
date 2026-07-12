"use client"
import { useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { PrintLabelModal } from "@/components/inventory/PrintLabelModal"
import { Search, Plus, Printer, X, Check, ArrowRight, Trash2 } from "lucide-react"

type Item = { id: string; name: string; sku: string; barcode: string; category: string; form?: string; strength?: string; quantity_in_stock: number; quantity_in_transit: number; quantity_damaged: number; reorder_threshold: number }

export default function ProductsClient({ items: init }: { items: Item[] }) {
  const [items, setItems] = useState(init)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [msg, setMsg] = useState("")
  const [form, setForm] = useState({ name: "", category: "Medication", form: "", strength: "", reorder_threshold: "10" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [newItem, setNewItem] = useState<Item | null>(null)
  const [printItem, setPrintItem] = useState<Item | null>(null)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const reload = async () => { const r = await fetch("/api/admin/inventory/items"); const d = await r.json(); if (r.ok) setItems(d.items || []) }

  const createProduct = async () => {
    if (!form.name.trim()) { setError("Name required"); return }
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/admin/inventory/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, reorder_threshold: Number(form.reorder_threshold) || 10 }) })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed"); return }
      setNewItem(d.item); setForm({ name: "", category: "Medication", form: "", strength: "", reorder_threshold: "10" }); reload()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"? It won't appear in inventory but history is kept.`)) return
    await fetch(`/api/admin/inventory/items?id=${id}`, { method: "DELETE" })
    reload()
  }

  const filtered = search ? items.filter(i => [i.name, i.sku, i.barcode, i.category].join(" ").toLowerCase().includes(search.toLowerCase())) : items
  const low = filtered.filter(i => i.quantity_in_stock <= i.reorder_threshold)
  const ok  = filtered.filter(i => i.quantity_in_stock > i.reorder_threshold)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Products</h1>
          <p className="text-xs text-gray-500 mt-0.5">{items.length} active items</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B7C79] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a6b68]">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {msg && <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2"><Check className="h-4 w-4" />{msg}</div>}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU or barcode…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-emerald-500 focus:outline-none shadow-sm" />
      </div>

      {/* Low stock section */}
      {low.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-2">⚠ Low Stock ({low.length})</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {low.map(item => <ProductCard key={item.id} item={item} onPrint={() => setPrintItem(item)} onDelete={() => del(item.id, item.name)} />)}
          </div>
        </div>
      )}

      {/* All items */}
      {ok.length > 0 && (
        <div>
          {low.length > 0 && <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">All Products ({ok.length})</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {ok.map(item => <ProductCard key={item.id} item={item} onPrint={() => setPrintItem(item)} onDelete={() => del(item.id, item.name)} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No products found. {items.length === 0 ? "Add your first one!" : "Try a different search."}</div>}

      {/* Add product modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowAdd(false); setNewItem(null); setError("") }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {!newItem ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold">Add New Product</h2>
                  <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                  <div><label className="text-xs font-medium text-gray-500">Product Name *</label><input value={form.name} onChange={e => set("name", e.target.value)} autoFocus placeholder="e.g. Metformin 500mg" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs font-medium text-gray-500">Category</label><select value={form.category} onChange={e => set("category", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option>Medication</option><option>Supply</option><option>Equipment</option><option>OTC</option></select></div>
                    <div><label className="text-xs font-medium text-gray-500">Form</label><input value={form.form} onChange={e => set("form", e.target.value)} placeholder="TAB / CAP" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs font-medium text-gray-500">Strength</label><input value={form.strength} onChange={e => set("strength", e.target.value)} placeholder="500mg" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs font-medium text-gray-500">Reorder at</label><input type="number" value={form.reorder_threshold} onChange={e => set("reorder_threshold", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <p className="text-xs text-gray-400">SKU and barcode are auto-generated. Labels print as a QR code.</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
                    <button onClick={createProduct} disabled={saving} className="rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Creating..." : "Create"}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100"><Check className="h-4 w-4 text-emerald-700" /></div><h2 className="text-base font-semibold">Created!</h2></div>
                  <button onClick={() => { setShowAdd(false); setNewItem(null) }}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                  <p className="font-bold text-gray-900">{newItem.name}</p>
                  {newItem.strength && <p className="text-xs text-gray-500 mt-0.5">{newItem.strength}</p>}
                  <p className="text-xs text-gray-400 mb-3">SKU: {newItem.sku}</p>
                  <div className="mx-auto" style={{ width: 120, height: 120 }}>
                    <QRCodeSVG value={newItem.barcode || newItem.sku} size={120} level="M" marginSize={2} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <p className="text-xs tracking-widest text-gray-500 mt-2">{newItem.barcode}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => { setPrintItem(newItem); setShowAdd(false) }} className="h-10 rounded-xl bg-[#0B7C79] text-sm font-medium text-white flex items-center justify-center gap-2 hover:bg-[#0a6b68]"><Printer className="h-4 w-4" /> Print Label</button>
                  <button onClick={() => { setShowAdd(false); setNewItem(null) }} className="h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {printItem && <PrintLabelModal item={printItem} onClose={() => setPrintItem(null)} />}
    </div>
  )
}

function ProductCard({ item, onPrint, onDelete }: { item: Item; onPrint: () => void; onDelete: () => void }) {
  const low = item.quantity_in_stock <= item.reorder_threshold
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow ${low ? "border-amber-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.sku} · {item.barcode}</p>
        </div>
        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 flex-shrink-0 ${low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{low ? "Low" : "OK"}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {[["Stock", item.quantity_in_stock, low ? "text-amber-700 font-bold" : "text-gray-900 font-semibold"], ["Transit", item.quantity_in_transit, "text-sky-700 font-semibold"], ["Damaged", item.quantity_damaged, "text-rose-700 font-semibold"]].map(([l, v, cls]) => (
          <div key={l as string} className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <p className="text-gray-400 text-[10px]">{l}</p>
            <p className={cls as string}>{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Link href={`/admin/inventory/products/${item.id}`}
          className="flex-1 h-8 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
          Details <ArrowRight className="h-3 w-3" />
        </Link>
        <button onClick={onPrint} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-1">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button onClick={onDelete} className="h-8 px-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
