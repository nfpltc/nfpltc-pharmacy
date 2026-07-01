
"use client"
import { useState, useEffect, useRef } from "react"
import {
  ScanLine, Barcode, Printer, Plus, X, Loader2, Check,
  Camera, Trash2, Search, ImageIcon, Smartphone
} from "lucide-react"

type Action = "add" | "sold" | "damaged" | "transit"
type Item = {
  id: string; name: string; sku: string; barcode: string; category: string
  form?: string; strength?: string; quantity_in_stock: number
  quantity_in_transit: number; quantity_damaged: number; reorder_threshold: number; notes?: string
}
type Movement = {
  id: string; action: string; quantity: number; notes?: string
  location?: string; scanned_by?: string; created_at: string
  inventory_items?: { name: string; sku: string; barcode: string }
}

const ACTION_CONFIG = {
  add:     { label: "Add Stock",   bg: "bg-emerald-700 hover:bg-emerald-800", badge: "bg-emerald-50 text-emerald-700" },
  transit: { label: "In Transit",  bg: "bg-sky-600 hover:bg-sky-700",         badge: "bg-sky-50 text-sky-700" },
  sold:    { label: "Sold",        bg: "bg-rose-600 hover:bg-rose-700",        badge: "bg-rose-50 text-rose-700" },
  damaged: { label: "Damaged",     bg: "bg-amber-500 hover:bg-amber-600",      badge: "bg-amber-50 text-amber-700" },
}

async function readBarcodeFromImage(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = async e => {
      const src = e.target?.result as string
      const img = new Image()
      img.onload = async () => {
        if ("BarcodeDetector" in window) {
          try {
            const bd = new (window as any).BarcodeDetector({
              formats: ["code_128","ean_13","ean_8","qr_code","code_39","upc_a","upc_e"],
            })
            const bitmap = await createImageBitmap(img)
            const results = await bd.detect(bitmap)
            if (results.length > 0) { resolve(results[0].rawValue); return }
          } catch {}
        }
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser")
          const r2 = new BrowserMultiFormatReader()
          const result = await r2.decodeFromImageElement(img)
          resolve(result.getText()); return
        } catch {}
        resolve(null)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export function ScanPanel() {
  const [barcodeInput, setBarcodeInput] = useState("")
  const [scanned, setScanned] = useState<Item | null>(null)
  const [action, setAction] = useState<Action>("add")
  const [qty, setQty] = useState(1)
  const [location, setLocation] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [photoScanning, setPhotoScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const lookupBarcode = async (code?: string) => {
    const bc = (code ?? barcodeInput).trim()
    if (!bc) { setError("Enter or scan a barcode first"); return }
    setLoading(true); setError(""); setScanned(null)
    try {
      const r = await fetch(`/api/admin/inventory/items?barcode=${encodeURIComponent(bc)}`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Barcode not found"); return }
      setScanned(d.item); setQty(1)
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }

  const handlePhotoFile = async (file: File | null | undefined) => {
    if (!file) return
    setPhotoScanning(true); setError("")
    try {
      const code = await readBarcodeFromImage(file)
      if (!code) { setError("No barcode detected. Try a clearer, closer photo."); return }
      setBarcodeInput(code)
      await lookupBarcode(code)
    } catch (e: any) { setError("Could not read barcode: " + (e.message || "error")) }
    finally { setPhotoScanning(false) }
  }

  const saveMove = async () => {
    if (!scanned) { setError("Scan a product first"); return }
    setSaving(true); setError(""); setSuccess("")
    try {
      const r = await fetch("/api/admin/inventory/move", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: scanned.id, action, quantity: qty, notes: note || null, location: location || null }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed to update stock"); return }
      setScanned(d.item)
      setSuccess(`Done! ${ACTION_CONFIG[action].label}: ${qty} x ${d.item.name}`)
      setNote(""); setBarcodeInput(""); setQty(1)
      setTimeout(() => setSuccess(""), 4000)
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  const reset = () => { setScanned(null); setBarcodeInput(""); setQty(1); setNote(""); setError(""); setSuccess(""); inputRef.current?.focus() }

  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Scan Action Panel</h3>
          <p className="mt-1 text-sm text-gray-600">Use a USB scanner, take a photo, or type manually.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">iPhone · Android · Desktop</span>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">USB / Bluetooth scanner or manual entry</p>
        <div className="flex gap-2">
          <input ref={inputRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") lookupBarcode() }}
            placeholder="Scan or type barcode — press Enter"
            className="flex-1 h-11 rounded-lg border border-gray-200 px-4 text-sm focus:border-emerald-500 focus:outline-none" />
          <button onClick={() => lookupBarcode()} disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0B7C79] px-4 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Lookup
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => fileInputRef.current?.click()} disabled={photoScanning}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50">
          {photoScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Take Photo <span className="text-[10px] text-gray-400 ml-1">(camera)</span>
        </button>
        <button onClick={() => uploadInputRef.current?.click()} disabled={photoScanning}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50">
          {photoScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          Choose Photo <span className="text-[10px] text-gray-400 ml-1">(gallery)</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handlePhotoFile(e.target.files?.[0])} />
        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handlePhotoFile(e.target.files?.[0])} />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2">
        <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          <strong>On your phone:</strong> tap Take Photo to open the camera directly, or Choose Photo to pick a barcode image from your gallery or folder.
        </p>
      </div>

      {photoScanning && <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><Loader2 className="h-4 w-4 animate-spin" /> Reading barcode from photo...</div>}
      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><Check className="h-4 w-4" />{success}</div>}

      {scanned && (
        <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Found</p>
              <h4 className="mt-1.5 text-lg font-semibold text-gray-900">{scanned.name}</h4>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald-900/10">SKU: {scanned.sku}</span>
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald-900/10">Barcode: {scanned.barcode}</span>
                <span className={`rounded-full px-2.5 py-1 ring-1 ${scanned.quantity_in_stock <= scanned.reorder_threshold ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-white ring-emerald-900/10"}`}>
                  In stock: {scanned.quantity_in_stock}
                </span>
                {scanned.quantity_in_transit > 0 && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-200">Transit: {scanned.quantity_in_transit}</span>}
                {scanned.quantity_damaged > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">Damaged: {scanned.quantity_damaged}</span>}
              </div>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {(Object.entries(ACTION_CONFIG) as [Action, (typeof ACTION_CONFIG)[Action]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setAction(key)}
                className={`rounded-xl py-2.5 text-sm font-medium transition-all ${action === key ? cfg.bg + " text-white scale-[1.03] shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Quantity</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Location</label>
              <select value={location} onChange={e => setLocation(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Main Warehouse</option>
                <option>Front Store</option>
                <option>Transit Hold</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={saveMove} disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0B7C79] px-5 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save — {ACTION_CONFIG[action].label}
            </button>
            <button onClick={reset}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function BarcodePanel({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || "")
  const svgRef = useRef<SVGSVGElement>(null)
  const selected = items.find(i => i.id === selectedId) || items[0]

  const printLabel = () => {
    const svg = svgRef.current
    if (!svg || !selected) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Label</title>
    <style>body{margin:0;padding:20px;font-family:monospace;text-align:center}</style></head>
    <body>
    <p style="font-size:15px;font-weight:bold">${selected.name}</p>
    ${selected.strength ? `<p style="font-size:12px;color:#666">${selected.strength}${selected.form ? " · " + selected.form : ""}</p>` : ""}
    <p style="font-size:11px;color:#888">SKU: ${selected.sku}</p>
    ${svgData}
    <p style="font-size:13px;letter-spacing:5px">${selected.barcode}</p>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const drawBars = (code: string) => {
    const bars: { x: number; w: number }[] = []
    let x = 8
    for (let i = 0; i < code.length; i++) {
      const ch = code.charCodeAt(i)
      for (let b = 0; b < 5; b++) {
        const w = b % 2 === (ch % 2) ? 4 : 2
        if (b % 2 === 0) bars.push({ x, w })
        x += w + 1
      }
      x += 3
    }
    return { bars, totalW: x + 8 }
  }

  const { bars, totalW } = drawBars(selected?.barcode || "NFPLTC")

  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Barcode Label Tools</h3>
          <p className="mt-1 text-sm text-gray-600">Generate and print labels for any product.</p>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Barcode className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Select product</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none">
            {items.length === 0
              ? <option>No products yet</option>
              : items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)
            }
          </select>
        </div>

        {selected && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-[#F7F5EF] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Preview</p>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5 text-center">
              <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
              {selected.strength && <p className="text-xs text-gray-500">{selected.strength}{selected.form ? " · " + selected.form : ""}</p>}
              <p className="text-xs text-gray-400 mb-3">SKU: {selected.sku}</p>
              <svg ref={svgRef} width="100%" viewBox={`0 0 ${totalW} 60`} xmlns="http://www.w3.org/2000/svg">
                {bars.map((b, i) => <rect key={i} x={b.x} y={2} width={b.w} height={48} fill="#111" />)}
              </svg>
              <p className="mt-2 text-xs tracking-widest text-gray-700">{selected.barcode}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={printLabel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
            <Printer className="h-4 w-4" /> Print label
          </button>
          <button onClick={() => selected && navigator.clipboard?.writeText(selected.barcode).then(() => alert("Copied: " + selected.barcode))}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-emerald-50">
            <Barcode className="h-4 w-4" /> Copy code
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState({ name: "", category: "Medication", form: "", strength: "", reorder_threshold: "10", notes: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/admin/inventory/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reorder_threshold: Number(form.reorder_threshold) || 10 }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed"); return }
      onSaved(`Created: ${d.item.name} · Barcode: ${d.item.barcode}`)
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add New Product</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-500">Product Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Metformin 500mg"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-500">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option>Medication</option><option>Supply</option><option>Equipment</option><option>OTC</option>
              </select></div>
            <div><label className="text-xs font-medium text-gray-500">Form</label>
              <input value={form.form} onChange={e => set("form", e.target.value)} placeholder="TAB / CAP / LIQ"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-500">Strength</label>
              <input value={form.strength} onChange={e => set("strength", e.target.value)} placeholder="500mg"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-500">Reorder threshold</label>
              <input type="number" value={form.reorder_threshold} onChange={e => set("reorder_threshold", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-500">Notes</label>
            <input value={form.notes} onChange={e => set("notes", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
          <p className="text-xs text-gray-400">SKU and barcode auto-generated.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
            <button onClick={submit} disabled={saving}
              className="rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Creating..." : "Create Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MovementsTable({ movements }: { movements: Movement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[580px] text-left">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-widest text-gray-500">
            <th className="pb-3 font-medium">Product</th>
            <th className="pb-3 font-medium">Action</th>
            <th className="pb-3 font-medium">Qty</th>
            <th className="pb-3 font-medium">By</th>
            <th className="pb-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 ? (
            <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">No movements yet — scan your first barcode!</td></tr>
          ) : movements.map(m => {
            const cfg = ACTION_CONFIG[m.action as Action] || ACTION_CONFIG.add
            const item = (m as any).inventory_items
            return (
              <tr key={m.id} className="border-b border-gray-50">
                <td className="py-3">
                  <p className="text-sm font-medium text-gray-900">{item?.name || "—"}</p>
                  <p className="text-xs text-gray-400">{item?.barcode}</p>
                </td>
                <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>{m.action.charAt(0).toUpperCase() + m.action.slice(1)}</span></td>
                <td className="py-3 text-sm font-semibold text-gray-900">{["add","transit"].includes(m.action) ? "+" : "-"}{m.quantity}</td>
                <td className="py-3 text-sm text-gray-500">{m.scanned_by?.split("@")[0] || "—"}</td>
                <td className="py-3 text-xs text-gray-400">{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ProductsList({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [msg, setMsg] = useState("")

  const reload = async () => { const r = await fetch("/api/admin/inventory/items"); const d = await r.json(); if (r.ok) setItems(d.items || []) }

  const filtered = search ? items.filter(i => [i.name, i.sku, i.barcode].join(" ").toLowerCase().includes(search.toLowerCase())) : items

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?`)) return
    await fetch(`/api/admin/inventory/items?id=${id}`, { method: "DELETE" })
    reload()
  }

  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div><h3 className="text-lg font-semibold text-gray-900">Products</h3><p className="text-sm text-gray-500">{filtered.length} items</p></div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a6b68]">
          <Plus className="h-3.5 w-3.5" /> Add Product
        </button>
      </div>
      {msg && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, barcode..."
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-emerald-500 focus:outline-none" />
      </div>
      <div className="space-y-3 max-h-[460px] overflow-y-auto">
        {filtered.length === 0
          ? <p className="py-8 text-center text-sm text-gray-400">{items.length === 0 ? "No products yet. Add your first one!" : "No results."}</p>
          : filtered.map(item => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-[#FCFBF8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.sku} · {item.barcode}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.quantity_in_stock <= item.reorder_threshold ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {item.quantity_in_stock <= item.reorder_threshold ? "Low" : "Healthy"}
                  </span>
                  <button onClick={() => deleteItem(item.id, item.name)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {[["Stock", item.quantity_in_stock], ["Transit", item.quantity_in_transit], ["Damaged", item.quantity_damaged]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-white p-2.5 ring-1 ring-black/5 text-center">
                    <p className="text-gray-500">{l}</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </div>
      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onSaved={m => { setShowAdd(false); setMsg(m); reload() }} />}
    </div>
  )
}
