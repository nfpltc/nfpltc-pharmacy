
"use client"
import { useState, useEffect, useRef } from "react"
import { ScanLine, Plus, X, Loader2, Check, Camera, Trash2, Search, ImageIcon, Printer, Barcode } from "lucide-react"

type Action = "add" | "sold" | "damaged" | "transit"
type Item = {
  id: string; name: string; sku: string; barcode: string; category: string
  form?: string; strength?: string; quantity_in_stock: number
  quantity_in_transit: number; quantity_damaged: number; reorder_threshold: number
}
type Movement = {
  id: string; action: string; quantity: number; scanned_by?: string; created_at: string
  inventory_items?: { name: string; sku: string; barcode: string }
}

const ACTION = {
  add:     { label: "Add Stock",  color: "bg-emerald-600 text-white", badge: "bg-emerald-50 text-emerald-700" },
  sold:    { label: "Sold",       color: "bg-rose-600 text-white",    badge: "bg-rose-50 text-rose-700" },
  damaged: { label: "Damaged",    color: "bg-amber-500 text-white",   badge: "bg-amber-50 text-amber-700" },
  transit: { label: "In Transit", color: "bg-sky-600 text-white",     badge: "bg-sky-50 text-sky-700" },
}

// ── Draw barcode SVG bars from a code string ─────────────────────────────────
function buildBars(code: string): { bars: { x: number; w: number }[]; totalW: number } {
  const bars: { x: number; w: number }[] = []
  let x = 10
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i)
    for (let b = 0; b < 5; b++) {
      const w = b % 2 === (ch % 2) ? 4 : 2
      if (b % 2 === 0) bars.push({ x, w })
      x += w + 1
    }
    x += 3
  }
  return { bars, totalW: x + 10 }
}

// ── Print a barcode label in a new window ────────────────────────────────────
function printLabel(item: Item) {
  const { bars, totalW } = buildBars(item.barcode)
  const svgBars = bars.map(b => `<rect x="${b.x}" y="2" width="${b.w}" height="48" fill="#111"/>`).join("")
  const svg = `<svg width="100%" viewBox="0 0 ${totalW} 60" xmlns="http://www.w3.org/2000/svg">${svgBars}</svg>`
  const win = window.open("", "_blank")
  if (!win) { alert("Please allow popups to print labels"); return }
  win.document.write(`<!DOCTYPE html><html><head><title>${item.name}</title>
    <style>body{margin:0;padding:24px;font-family:Arial,sans-serif;text-align:center}
    .name{font-size:16px;font-weight:700;margin-bottom:2px}
    .sub{font-size:12px;color:#666;margin-bottom:2px}
    .bc{font-size:12px;letter-spacing:4px;margin-top:6px;color:#333}</style></head>
    <body>
    <div class="name">${item.name}</div>
    ${item.strength ? `<div class="sub">${item.strength}${item.form ? " · " + item.form : ""}</div>` : ""}
    <div class="sub">SKU: ${item.sku}</div>
    ${svg}
    <div class="bc">${item.barcode}</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},600)}<\/script>
    </body></html>`)
  win.document.close()
}

// ── Detect barcode from a photo ──────────────────────────────────────────────
async function detectBarcode(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = async e => {
      const img = new Image()
      img.onload = async () => {
        if ("BarcodeDetector" in window) {
          try {
            const bd = new (window as any).BarcodeDetector({ formats: ["code_128","ean_13","ean_8","qr_code","code_39","upc_a"] })
            const bm = await createImageBitmap(img)
            const r = await bd.detect(bm)
            if (r.length > 0) { resolve(r[0].rawValue); return }
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
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ── Inline barcode display ───────────────────────────────────────────────────
function BarcodeDisplay({ code }: { code: string }) {
  const { bars, totalW } = buildBars(code)
  return (
    <div className="text-center">
      <svg width="100%" viewBox={`0 0 ${totalW} 48`} xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: 220 }}>
        {bars.map((b, i) => <rect key={i} x={b.x} y={1} width={b.w} height={42} fill="#111" />)}
      </svg>
      <p className="text-[10px] tracking-widest text-gray-500 mt-1">{code}</p>
    </div>
  )
}

// ── New product modal — shows barcode immediately after creation ──────────────
export function AddProductFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"form" | "label">("form")
  const [created, setCreated] = useState<Item | null>(null)
  const [form, setForm] = useState({ name: "", category: "Medication", form: "", strength: "", reorder_threshold: "10" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError("Name required"); return }
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/admin/inventory/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reorder_threshold: Number(form.reorder_threshold) || 10 }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed"); return }
      setCreated(d.item)
      setStep("label")
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onDone}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {step === "form" ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Add New Product</h2>
              <button onClick={onDone}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-500">Product Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} autoFocus
                  placeholder="e.g. Metformin 500mg"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium text-gray-500">Category</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option>Medication</option><option>Supply</option><option>Equipment</option><option>OTC</option>
                  </select></div>
                <div><label className="text-xs font-medium text-gray-500">Form</label>
                  <input value={form.form} onChange={e => set("form", e.target.value)} placeholder="TAB / CAP"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium text-gray-500">Strength</label>
                  <input value={form.strength} onChange={e => set("strength", e.target.value)} placeholder="500mg"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-500">Reorder at</label>
                  <input type="number" value={form.reorder_threshold} onChange={e => set("reorder_threshold", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <p className="text-xs text-gray-400">SKU and barcode are auto-generated after saving.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onDone} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button onClick={submit} disabled={saving}
                  className="rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {saving ? "Creating..." : "Create Product"}
                </button>
              </div>
            </div>
          </div>
        ) : created ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-4 w-4 text-emerald-700" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Product Created</h2>
              </div>
              <button onClick={onDone}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-900">{created.name}</p>
              {created.strength && <p className="text-xs text-gray-500 mt-0.5">{created.strength}{created.form ? " · " + created.form : ""}</p>}
              <p className="text-xs text-gray-400 mt-0.5 mb-4">SKU: {created.sku}</p>
              <BarcodeDisplay code={created.barcode} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => printLabel(created)}
                className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B7C79] text-sm font-medium text-white hover:bg-[#0a6b68]">
                <Printer className="h-4 w-4" /> Print Label
              </button>
              <button onClick={onDone}
                className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Scan Panel ───────────────────────────────────────────────────────────────
export function ScanPanel() {
  const [input, setInput] = useState("")
  const [scanned, setScanned] = useState<Item | null>(null)
  const [action, setAction] = useState<Action>("add")
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const lookup = async (code?: string) => {
    const bc = (code ?? input).trim()
    if (!bc) return
    setLoading(true); setError(""); setScanned(null)
    try {
      const r = await fetch(`/api/admin/inventory/items?barcode=${encodeURIComponent(bc)}`)
      const d = await r.json()
      if (!r.ok) { setError("Barcode not found — is this product added to inventory?"); return }
      setScanned(d.item); setQty(1); setError("")
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }

  const handlePhoto = async (file?: File | null) => {
    if (!file) return
    setPhotoLoading(true); setError("")
    try {
      const code = await detectBarcode(file)
      if (!code) { setError("No barcode found in photo. Try a clearer shot."); return }
      setInput(code)
      await lookup(code)
    } catch { setError("Could not read photo") }
    finally { setPhotoLoading(false) }
  }

  const save = async () => {
    if (!scanned) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const r = await fetch("/api/admin/inventory/move", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: scanned.id, action, quantity: qty, notes: note || null }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed"); return }
      setScanned(d.item)
      setSuccess(`${ACTION[action].label} · ${qty} unit${qty > 1 ? "s" : ""} · New stock: ${d.item.quantity_in_stock}`)
      setNote(""); setInput(""); setQty(1)
      setTimeout(() => { setSuccess(""); setScanned(null); inputRef.current?.focus() }, 3000)
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  const reset = () => { setScanned(null); setInput(""); setQty(1); setNote(""); setError(""); setSuccess(""); inputRef.current?.focus() }

  return (
    <div className="space-y-3">
      {/* Input row */}
      <div className="flex gap-2">
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
          placeholder="Scan barcode or type it, press Enter"
          className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
        <button onClick={() => lookup()} disabled={loading}
          className="h-10 rounded-lg bg-[#0B7C79] px-3 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
        </button>
        <button onClick={() => camRef.current?.click()} disabled={photoLoading} title="Take photo (opens camera on phone)"
          className="h-10 rounded-lg border border-gray-200 px-3 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {photoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={photoLoading} title="Upload photo from gallery"
          className="h-10 rounded-lg border border-gray-200 px-3 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {photoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handlePhoto(e.target.files?.[0])} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => handlePhoto(e.target.files?.[0])} />
      </div>

      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
      {success && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><Check className="h-4 w-4" />{success}</div>}

      {scanned && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{scanned.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{scanned.barcode}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scanned.quantity_in_stock <= scanned.reorder_threshold ? "bg-amber-50 text-amber-700" : "bg-white text-gray-600 border border-gray-200"}`}>
                Stock: {scanned.quantity_in_stock}
              </span>
              <button onClick={reset}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
          </div>

          {/* Action pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.entries(ACTION) as [Action, typeof ACTION[Action]][]).map(([k, v]) => (
              <button key={k} onClick={() => setAction(k)}
                className={`rounded-lg py-2 text-xs font-medium transition-all ${action === k ? v.color + " shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Qty + note */}
          <div className="flex gap-2">
            <div className="w-24">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Qty</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Note</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full h-10 rounded-lg bg-[#0B7C79] text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save · {ACTION[action].label}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Movements table ──────────────────────────────────────────────────────────
export function MovementsTable({ movements: init }: { movements: Movement[] }) {
  const [movements, setMovements] = useState(init)
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/admin/inventory/move?limit=20")
      const d = await r.json()
      if (r.ok) setMovements(d.movements || [])
    }, 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="overflow-x-auto">
      {movements.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <Barcode className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          No movements yet — scan your first barcode!
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
            <th className="pb-2 font-medium">Product</th>
            <th className="pb-2 font-medium">Action</th>
            <th className="pb-2 font-medium">Qty</th>
            <th className="pb-2 font-medium">By</th>
            <th className="pb-2 font-medium">When</th>
          </tr></thead>
          <tbody>
            {movements.map(m => {
              const cfg = ACTION[m.action as Action] || ACTION.add
              const item = (m as any).inventory_items
              return (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="py-2.5">
                    <p className="font-medium text-gray-900 text-xs">{item?.name || "—"}</p>
                    <p className="text-[10px] text-gray-400">{item?.barcode}</p>
                  </td>
                  <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{m.action}</span></td>
                  <td className="py-2.5 text-xs font-semibold text-gray-900">{["add","transit"].includes(m.action) ? "+" : "-"}{m.quantity}</td>
                  <td className="py-2.5 text-xs text-gray-500">{m.scanned_by?.split("@")[0] || "—"}</td>
                  <td className="py-2.5 text-xs text-gray-400">{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Products list with inline print ─────────────────────────────────────────
export function ProductsList({ items: init }: { items: Item[] }) {
  const [items, setItems] = useState(init)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const reload = async () => { const r = await fetch("/api/admin/inventory/items"); const d = await r.json(); if (r.ok) setItems(d.items || []) }

  const del = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?`)) return
    await fetch(`/api/admin/inventory/items?id=${id}`, { method: "DELETE" })
    reload()
  }

  const filtered = search
    ? items.filter(i => [i.name, i.sku, i.barcode].join(" ").toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU or barcode…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a6b68]">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {items.length === 0 ? "No products yet. Click Add to create your first." : "No results."}
          </div>
        ) : filtered.map(item => {
          const isExp = expandedId === item.id
          const low = item.quantity_in_stock <= item.reorder_threshold
          return (
            <div key={item.id} className={`rounded-xl border bg-white transition-all ${low ? "border-amber-200" : "border-gray-100"}`}>
              <div className="flex items-center gap-3 px-3.5 py-3 cursor-pointer" onClick={() => setExpandedId(isExp ? null : item.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    {low && <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Low</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{item.sku} · {item.barcode}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-600">
                  <div className="text-center hidden sm:block"><p className="font-semibold text-gray-900">{item.quantity_in_stock}</p><p className="text-[10px] text-gray-400">stock</p></div>
                  {item.quantity_in_transit > 0 && <div className="text-center"><p className="font-semibold text-sky-700">{item.quantity_in_transit}</p><p className="text-[10px] text-gray-400">transit</p></div>}
                  {item.quantity_damaged > 0 && <div className="text-center"><p className="font-semibold text-amber-700">{item.quantity_damaged}</p><p className="text-[10px] text-gray-400">damaged</p></div>}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-gray-100 px-3.5 py-3 bg-gray-50/60 rounded-b-xl">
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <BarcodeDisplay code={item.barcode} />
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => printLabel(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a6b68]">
                        <Printer className="h-3.5 w-3.5" /> Print Label
                      </button>
                      <button onClick={() => del(item.id, item.name)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Archive
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAdd && <AddProductFlow onDone={() => { setShowAdd(false); reload() }} />}
    </>
  )
}
