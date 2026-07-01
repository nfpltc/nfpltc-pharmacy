"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { ScanLine, X, Plus, Minus, Check, Loader2, AlertTriangle, Camera, Keyboard, Trash2, Save, RotateCcw, PackagePlus, PackageMinus, PackageX, ArrowRight } from "lucide-react"
import { encodeCode128, bitsToRects } from "@/lib/barcode"

type ScanMode = "add" | "sold" | "damaged" | "transit"
type CartItem = { barcode: string; product_id: string; name: string; sku: string; current_stock: number; qty: number; note: string }

const MODES = [
  { key: "add"     as ScanMode, label: "Stock In",   desc: "Receiving new stock",      icon: PackagePlus,  border: "border-emerald-500", bg: "bg-emerald-50", color: "text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700" },
  { key: "sold"    as ScanMode, label: "Stock Out",  desc: "Selling / dispensing",     icon: PackageMinus, border: "border-rose-500",    bg: "bg-rose-50",    color: "text-rose-700",    btn: "bg-rose-600 hover:bg-rose-700" },
  { key: "damaged" as ScanMode, label: "Damaged",    desc: "Damaged / write-off",      icon: PackageX,     border: "border-amber-500",   bg: "bg-amber-50",   color: "text-amber-700",   btn: "bg-amber-500 hover:bg-amber-600" },
  { key: "transit" as ScanMode, label: "In Transit", desc: "Moving to another location",icon: ArrowRight,  border: "border-sky-500",     bg: "bg-sky-50",     color: "text-sky-700",     btn: "bg-sky-600 hover:bg-sky-700" },
]

function beep(ok: boolean) {
  try {
    const a = new AudioContext()
    const o = a.createOscillator()
    const g = a.createGain()
    o.connect(g); g.connect(a.destination)
    o.frequency.value = ok ? 1200 : 300
    g.gain.value = 0.1
    o.start(); o.stop(a.currentTime + (ok ? 0.08 : 0.2))
  } catch {}
}

// ── Cart ─────────────────────────────────────────────────────────────────────
function Cart({ items, mode, onUpdateQty, onSetNote, onRemove, onClearAll, onSaveAll, saving, saved, onScanMore }:
  { items: CartItem[]; mode: ScanMode; onUpdateQty: (bc:string,d:number)=>void; onSetNote: (bc:string,n:string)=>void
    onRemove: (bc:string)=>void; onClearAll: ()=>void; onSaveAll: ()=>void
    saving: boolean; saved: boolean; onScanMore: ()=>void }) {
  const modeConf = MODES.find(m => m.key === mode)!
  const total = items.reduce((s, i) => s + i.qty, 0)
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900">Scanned Items</h2>
          <p className="text-xs text-gray-500 mt-0.5">{items.length} product{items.length !== 1 ? "s" : ""} · {total} unit{total !== 1 ? "s" : ""}</p>
        </div>
        {items.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <ScanLine className="h-12 w-12 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">No products scanned yet</p>
          <p className="text-xs text-gray-300 mt-1">Point your camera at a barcode or type it below</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {items.map((item, idx) => (
            <div key={item.barcode} className={`px-4 py-3 ${idx === 0 ? "bg-emerald-50/40" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.sku} · {item.barcode}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stock before: {item.current_stock}</p>
                  <input value={item.note} onChange={e => onSetNote(item.barcode, e.target.value)}
                    placeholder="Add note…"
                    className="mt-1.5 w-full rounded-lg border border-gray-100 bg-white px-2 py-1 text-xs text-gray-600 placeholder-gray-300 focus:border-gray-300 focus:outline-none" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => onRemove(item.barcode)} className="text-gray-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white">
                    <button onClick={() => onUpdateQty(item.barcode, -1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 rounded-l-lg hover:bg-gray-50">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.barcode, 1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 rounded-r-lg hover:bg-gray-50">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 p-4 bg-gray-50/50 flex-shrink-0">
        {saved ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <Check className="h-5 w-5" /> Saved to inventory!
            </div>
            <button onClick={onScanMore} className="text-xs text-[#0B7C79] underline">Scan more products</button>
          </div>
        ) : (
          <button onClick={onSaveAll} disabled={saving || items.length === 0}
            className={"w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 " + modeConf.btn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : `Save ${items.length} item${items.length !== 1 ? "s" : ""} · ${modeConf.label}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main scan page ────────────────────────────────────────────────────────────
export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode | null>(null)
  const [inputMode, setInputMode] = useState<"camera" | "keyboard">("camera")
  const [items, setItems] = useState<CartItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<{ code: string; status: "ok"|"dup"|"err"; name?: string } | null>(null)
  const [kbInput, setKbInput] = useState("")
  const [kbLoading, setKbLoading] = useState(false)

  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const animRef     = useRef<number>(0)
  const lastCodeRef = useRef("")
  const lastTimeRef = useRef(0)
  const kbRef       = useRef<HTMLInputElement>(null)
  // Always-current ref so camera loop never has stale items
  const itemsRef    = useRef<CartItem[]>([])
  useEffect(() => { itemsRef.current = items }, [items])

  const stopCamera = useCallback(() => {
    setScanning(false)
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Lookup barcode and add to cart ──────────────────────────────────────────
  const handleBarcode = useCallback(async (code: string) => {
    const now = Date.now()
    if (code === lastCodeRef.current && now - lastTimeRef.current < 2500) return
    lastCodeRef.current = code
    lastTimeRef.current = now

    // Check cart using ref (always fresh)
    const existing = itemsRef.current.find(i => i.barcode === code)
    if (existing) {
      setItems(prev => prev.map(i => i.barcode === code ? { ...i, qty: i.qty + 1 } : i))
      setScanFeedback({ code, status: "dup", name: existing.name })
      beep(true)
      setTimeout(() => setScanFeedback(null), 1500)
      return
    }

    try {
      const r = await fetch(`/api/admin/inventory/items?barcode=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (!r.ok) {
        setScanFeedback({ code, status: "err" })
        beep(false)
        setTimeout(() => setScanFeedback(null), 2000)
        return
      }
      const p = d.item
      setItems(prev => [{ barcode: code, product_id: p.id, name: p.name, sku: p.sku, current_stock: p.quantity_in_stock, qty: 1, note: "" }, ...prev])
      setScanFeedback({ code, status: "ok", name: p.name })
      beep(true)
      setTimeout(() => setScanFeedback(null), 1500)
    } catch {
      setScanFeedback({ code, status: "err" })
      beep(false)
      setTimeout(() => setScanFeedback(null), 2000)
    }
  }, []) // no deps — uses itemsRef so never stale

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!mode) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } }
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setScanning(true)

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128","ean_13","ean_8","qr_code","code_39","upc_a","upc_e"]
        })
        const loop = async () => {
          if (!streamRef.current) return
          try {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              const results = await detector.detect(videoRef.current)
              if (results.length > 0) await handleBarcode(results[0].rawValue)
            }
          } catch {}
          animRef.current = requestAnimationFrame(loop)
        }
        animRef.current = requestAnimationFrame(loop)
        return
      }

      // ZXing for Safari iOS / Firefox
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        reader.decodeFromStream(stream, videoRef.current!, async (result) => {
          if (result) await handleBarcode(result.getText())
        })
      } catch {
        stopCamera()
        alert("Camera scanning is not available on this browser. Please use the USB/Type tab.")
      }
    } catch (e: any) {
      setScanning(false)
      alert("Camera permission denied: " + (e.message || "unknown error"))
    }
  }, [mode, handleBarcode, stopCamera])

  // ── Cart ops ────────────────────────────────────────────────────────────────
  const updateQty  = (bc: string, d: number) => setItems(prev => prev.map(i => i.barcode === bc ? { ...i, qty: Math.max(1, i.qty + d) } : i))
  const setNote    = (bc: string, n: string) => setItems(prev => prev.map(i => i.barcode === bc ? { ...i, note: n } : i))
  const removeItem = (bc: string)            => setItems(prev => prev.filter(i => i.barcode !== bc))
  const clearAll   = ()                       => { setItems([]); lastCodeRef.current = ""; lastTimeRef.current = 0 }

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!mode || items.length === 0) return
    setSaving(true)
    try {
      await Promise.all(items.map(item =>
        fetch("/api/admin/inventory/move", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.product_id, action: mode, quantity: item.qty, notes: item.note || null }),
        })
      ))
      setSaved(true); clearAll()
    } finally { setSaving(false) }
  }

  const modeConf = MODES.find(m => m.key === mode)

  // ── Step 1: Mode picker ─────────────────────────────────────────────────────
  if (!mode) return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Start Scan Session</h1>
        <p className="text-sm text-gray-500 mt-1">Choose what you're doing, then scan as many products as you need.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {MODES.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setSaved(false); clearAll() }}
            className={"rounded-2xl border-2 p-6 text-left transition-all hover:scale-[1.02] hover:shadow-md " + m.border + " " + m.bg}>
            <m.icon className={"h-8 w-8 mb-3 " + m.color} />
            <p className={"text-base font-bold " + m.color}>{m.label}</p>
            <p className="text-sm text-gray-600 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Step 2: Scan session ────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode header */}
      <div className={"mb-4 flex items-center justify-between rounded-xl border-2 px-5 py-3 " + modeConf!.border + " " + modeConf!.bg}>
        <div className="flex items-center gap-3">
          <modeConf.icon className={"h-6 w-6 " + modeConf!.color} />
          <div>
            <p className={"font-bold text-base " + modeConf!.color}>{modeConf!.label} Mode</p>
            <p className="text-xs text-gray-500">{modeConf!.desc}</p>
          </div>
        </div>
        <button onClick={() => { setMode(null); stopCamera(); clearAll() }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          Change Mode
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Scanner panel */}
        <div className="space-y-3">
          {/* Camera / Keyboard toggle */}
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button onClick={() => { setInputMode("camera"); stopCamera() }}
              className={"flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all " + (inputMode === "camera" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50")}>
              <Camera className="h-4 w-4" /> Camera
            </button>
            <button onClick={() => { setInputMode("keyboard"); stopCamera(); setTimeout(() => kbRef.current?.focus(), 100) }}
              className={"flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all " + (inputMode === "keyboard" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50")}>
              <Keyboard className="h-4 w-4" /> USB / Type
            </button>
          </div>

          {/* Camera view */}
          {inputMode === "camera" && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black shadow-sm">
              <div className="relative" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!scanning ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <button onClick={startCamera}
                      className="inline-flex flex-col items-center gap-2 rounded-2xl bg-white px-8 py-5 text-center shadow-xl hover:bg-gray-50">
                      <Camera className="h-8 w-8 text-[#0B7C79]" />
                      <span className="text-sm font-bold text-gray-900">Start Camera</span>
                      <span className="text-xs text-gray-500">Allow camera access when asked</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative border-2 border-white/80 rounded-lg" style={{ width: "75%", height: 88 }}>
                        <div className="absolute -left-0.5 -top-0.5 h-5 w-5 border-t-4 border-l-4 border-white rounded-tl" />
                        <div className="absolute -right-0.5 -top-0.5 h-5 w-5 border-t-4 border-r-4 border-white rounded-tr" />
                        <div className="absolute -left-0.5 -bottom-0.5 h-5 w-5 border-b-4 border-l-4 border-white rounded-bl" />
                        <div className="absolute -right-0.5 -bottom-0.5 h-5 w-5 border-b-4 border-r-4 border-white rounded-br" />
                        <div className="absolute inset-x-0 top-1/2 -translate-y-px h-0.5 bg-red-400/80 animate-pulse" />
                      </div>
                    </div>
                    {scanFeedback && (
                      <div className={"absolute bottom-3 left-3 right-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white flex items-center gap-2 shadow-lg " +
                        (scanFeedback.status === "ok" ? "bg-emerald-600" : scanFeedback.status === "dup" ? "bg-sky-600" : "bg-red-600")}>
                        {scanFeedback.status === "ok"  && <><Check className="h-4 w-4 flex-shrink-0" />{scanFeedback.name}</>}
                        {scanFeedback.status === "dup" && <><Plus className="h-4 w-4 flex-shrink-0" />+1 · {scanFeedback.name}</>}
                        {scanFeedback.status === "err" && <><AlertTriangle className="h-4 w-4 flex-shrink-0" />Not found: {scanFeedback.code}</>}
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-white">LIVE</span>
                    </div>
                    <button onClick={stopCamera} className="absolute top-2 right-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Keyboard / USB input */}
          {inputMode === "keyboard" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">USB scanner or type barcode</p>
              <div className="flex gap-2">
                <input ref={kbRef} value={kbInput}
                  onChange={e => setKbInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !kbLoading) { handleBarcode(kbInput.trim()).then(() => setKbInput("")); setKbLoading(false) } }}
                  placeholder="Scan or type barcode → Enter"
                  autoFocus
                  className="flex-1 h-12 rounded-xl border-2 border-gray-200 px-4 text-base font-mono focus:border-[#0B7C79] focus:outline-none" />
                <button onClick={() => { handleBarcode(kbInput.trim()).then(() => setKbInput("")); }} disabled={kbLoading || !kbInput.trim()}
                  className="h-12 px-4 rounded-xl bg-[#0B7C79] text-white disabled:opacity-40">
                  {kbLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
                </button>
              </div>
              {scanFeedback && (
                <div className={"mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium " +
                  (scanFeedback.status === "ok" ? "bg-emerald-50 text-emerald-700" : scanFeedback.status === "dup" ? "bg-sky-50 text-sky-700" : "bg-red-50 text-red-700")}>
                  {scanFeedback.status === "ok"  && <><Check className="h-4 w-4" />{scanFeedback.name}</>}
                  {scanFeedback.status === "dup" && <><Plus className="h-4 w-4" />+1 · {scanFeedback.name}</>}
                  {scanFeedback.status === "err" && <><AlertTriangle className="h-4 w-4" />Barcode not found in inventory</>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live cart */}
        <Cart items={items} mode={mode}
          onUpdateQty={updateQty} onSetNote={setNote} onRemove={removeItem}
          onClearAll={clearAll} onSaveAll={saveAll}
          saving={saving} saved={saved} onScanMore={() => setSaved(false)} />
      </div>
    </div>
  )
}
