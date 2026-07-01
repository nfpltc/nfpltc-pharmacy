"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { ScanLine, X, Plus, Minus, Check, Loader2, AlertTriangle, Camera, Keyboard, Trash2, Save, RotateCcw, PackagePlus, PackageMinus, PackageX, ArrowRight } from "lucide-react"

type ScanMode = "add" | "sold" | "damaged" | "transit"
type ScannedItem = {
  barcode: string
  product_id: string
  name: string
  sku: string
  current_stock: number
  qty: number
  note: string
}

const MODES: { key: ScanMode; label: string; desc: string; icon: any; color: string; border: string; bg: string }[] = [
  { key: "add",     label: "Stock In",   desc: "Receiving new stock",        icon: PackagePlus,  color: "text-emerald-700", border: "border-emerald-500", bg: "bg-emerald-50" },
  { key: "sold",    label: "Stock Out",  desc: "Selling / dispensing",       icon: PackageMinus, color: "text-rose-700",    border: "border-rose-500",    bg: "bg-rose-50" },
  { key: "damaged", label: "Damaged",    desc: "Damaged / write-off",        icon: PackageX,     color: "text-amber-700",   border: "border-amber-500",   bg: "bg-amber-50" },
  { key: "transit", label: "In Transit", desc: "Sent to another location",   icon: ArrowRight,   color: "text-sky-700",     border: "border-sky-500",     bg: "bg-sky-50" },
]

const BEEP_OK   = () => { try { const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 1200; g.gain.value = 0.1; o.start(); o.stop(a.currentTime + 0.08) } catch {} }
const BEEP_ERR  = () => { try { const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 300; g.gain.value = 0.1; o.start(); o.stop(a.currentTime + 0.2) } catch {} }

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode | null>(null)
  const [inputMode, setInputMode] = useState<"camera" | "keyboard">("camera")
  const [items, setItems] = useState<ScannedItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scanStatus, setScanStatus] = useState<{ code: string; status: "ok" | "err" | "dup"; name?: string } | null>(null)
  const [kbInput, setKbInput] = useState("")
  const [kbLoading, setKbLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const lastCodeRef = useRef<string>("")
  const lastCodeTimeRef = useRef<number>(0)
  const kbRef = useRef<HTMLInputElement>(null)

  // ── Stop camera ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    setScanning(false)
    cancelAnimationFrame(animRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [])

  // ── Start continuous camera scanning ────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!mode) return
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }

      // Try BarcodeDetector first
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["code_128","ean_13","ean_8","qr_code","code_39","upc_a","upc_e"] })
        const loop = async () => {
          if (!streamRef.current) return
          try {
            const results = await detector.detect(videoRef.current!)
            if (results.length > 0) {
              const code = results[0].rawValue
              const now = Date.now()
              if (code !== lastCodeRef.current || now - lastCodeTimeRef.current > 2500) {
                lastCodeRef.current = code
                lastCodeTimeRef.current = now
                await handleBarcode(code)
              }
            }
          } catch {}
          animRef.current = requestAnimationFrame(loop)
        }
        animRef.current = requestAnimationFrame(loop)
        return
      }

      // ZXing fallback removed — BarcodeDetector not available on this browser (Safari iOS).
      // Stop camera and prompt user to use USB scanner or type barcode.
      stopCamera()
      alert("Camera barcode scanning is not supported on this browser (Safari iOS). Please use a USB/Bluetooth barcode scanner, or type the barcode manually in the 'USB / Type' tab.")
    } catch (e: any) {
      setScanning(false)
      alert("Camera unavailable: " + (e.message || "permission denied"))
    }
  }, [mode, stopCamera]) // eslint-disable-line

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Handle a detected barcode ────────────────────────────────────────────────
  const handleBarcode = useCallback(async (code: string) => {
    // Check if already in cart → increment qty
    const existing = items.find(i => i.barcode === code)
    if (existing) {
      setItems(prev => prev.map(i => i.barcode === code ? { ...i, qty: i.qty + 1 } : i))
      setScanStatus({ code, status: "dup", name: existing.name })
      BEEP_OK()
      setTimeout(() => setScanStatus(null), 1500)
      return
    }
    // Look up product
    try {
      const r = await fetch(`/api/admin/inventory/items?barcode=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (!r.ok) {
        setScanStatus({ code, status: "err" })
        BEEP_ERR()
        setTimeout(() => setScanStatus(null), 2000)
        return
      }
      const p = d.item
      setItems(prev => [{ barcode: code, product_id: p.id, name: p.name, sku: p.sku, current_stock: p.quantity_in_stock, qty: 1, note: "" }, ...prev])
      setScanStatus({ code, status: "ok", name: p.name })
      BEEP_OK()
      setTimeout(() => setScanStatus(null), 1500)
    } catch {
      setScanStatus({ code, status: "err" })
      BEEP_ERR()
      setTimeout(() => setScanStatus(null), 2000)
    }
  }, [items])

  // ── Keyboard scanner input ───────────────────────────────────────────────────
  const handleKbScan = async () => {
    const code = kbInput.trim()
    if (!code) return
    setKbInput("")
    setKbLoading(true)
    await handleBarcode(code)
    setKbLoading(false)
    kbRef.current?.focus()
  }

  // ── Cart operations ─────────────────────────────────────────────────────────
  const updateQty = (barcode: string, delta: number) => {
    setItems(prev => prev.map(i => i.barcode === barcode ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  }
  const setNote = (barcode: string, note: string) => {
    setItems(prev => prev.map(i => i.barcode === barcode ? { ...i, note } : i))
  }
  const removeItem = (barcode: string) => setItems(prev => prev.filter(i => i.barcode !== barcode))
  const clearAll = () => { setItems([]); lastCodeRef.current = ""; lastCodeTimeRef.current = 0 }

  // ── Save all ─────────────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!mode || items.length === 0) return
    setSaving(true)
    try {
      const results = await Promise.all(items.map(item =>
        fetch("/api/admin/inventory/move", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.product_id, action: mode, quantity: item.qty, notes: item.note || null }),
        })
      ))
      const allOk = results.every(r => r.ok)
      if (allOk) { setSaved(true); clearAll() }
    } finally {
      setSaving(false)
    }
  }

  const modeConfig = MODES.find(m => m.key === mode)

  // ── STEP 1: Choose mode ──────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Start Scan Session</h1>
          <p className="mt-1 text-sm text-gray-500">Choose what you're scanning — then scan as many products as you need.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {MODES.map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setSaved(false) }}
              className={`rounded-2xl border-2 p-6 text-left transition-all hover:scale-[1.02] hover:shadow-md ${m.border} ${m.bg}`}>
              <m.icon className={`h-8 w-8 mb-3 ${m.color}`} />
              <p className={`text-base font-bold ${m.color}`}>{m.label}</p>
              <p className="text-sm text-gray-600 mt-1">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── STEP 2: Scan + cart ──────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode header */}
      <div className={`mb-4 flex items-center justify-between rounded-xl border-2 px-5 py-3 ${modeConfig!.border} ${modeConfig!.bg}`}>
        <div className="flex items-center gap-3">
          <modeConfig.icon className={`h-6 w-6 ${modeConfig!.color}`} />
          <div>
            <p className={`font-bold text-base ${modeConfig!.color}`}>{modeConfig!.label} Mode</p>
            <p className="text-xs text-gray-500">{modeConfig!.desc}</p>
          </div>
        </div>
        <button onClick={() => { setMode(null); stopCamera(); clearAll() }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          Change Mode
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* LEFT: Scanner */}
        <div className="space-y-4">
          {/* Input mode toggle */}
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button onClick={() => { setInputMode("camera"); stopCamera() }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${inputMode === "camera" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50"}`}>
              <Camera className="h-4 w-4" /> Camera
            </button>
            <button onClick={() => { setInputMode("keyboard"); stopCamera(); setTimeout(() => kbRef.current?.focus(), 100) }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${inputMode === "keyboard" ? "bg-[#0B7C79] text-white shadow" : "text-gray-600 hover:bg-gray-50"}`}>
              <Keyboard className="h-4 w-4" /> USB / Type
            </button>
          </div>

          {/* Camera view */}
          {inputMode === "camera" && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black shadow-sm">
              <div className="relative" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!scanning ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <button onClick={startCamera}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg hover:bg-gray-50">
                      <Camera className="h-5 w-5 text-[#0B7C79]" /> Start Camera
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Scan target overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-white/80 rounded-lg" style={{ width: "72%", height: 80 }}>
                        <div className="absolute left-0 top-0 h-5 w-5 border-t-4 border-l-4 border-white rounded-tl-lg" />
                        <div className="absolute right-0 top-0 h-5 w-5 border-t-4 border-r-4 border-white rounded-tr-lg" />
                        <div className="absolute left-0 bottom-0 h-5 w-5 border-b-4 border-l-4 border-white rounded-bl-lg" />
                        <div className="absolute right-0 bottom-0 h-5 w-5 border-b-4 border-r-4 border-white rounded-br-lg" />
                        <div className="absolute inset-x-0 top-1/2 border-t-2 border-red-400/80 animate-pulse" />
                      </div>
                    </div>
                    {/* Scan feedback */}
                    {scanStatus && (
                      <div className={`absolute bottom-3 left-3 right-3 rounded-lg px-3 py-2 text-sm font-medium text-white ${
                        scanStatus.status === "ok" ? "bg-emerald-600" : scanStatus.status === "dup" ? "bg-sky-600" : "bg-red-600"
                      }`}>
                        {scanStatus.status === "ok" && <><Check className="inline h-4 w-4 mr-1" />{scanStatus.name}</>}
                        {scanStatus.status === "dup" && <><Plus className="inline h-4 w-4 mr-1" />+1 · {scanStatus.name}</>}
                        {scanStatus.status === "err" && <><AlertTriangle className="inline h-4 w-4 mr-1" />Not found: {scanStatus.code}</>}
                      </div>
                    )}
                    <button onClick={stopCamera}
                      className="absolute top-2 right-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70">
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute top-2 left-2 bg-emerald-500 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />LIVE
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Keyboard / USB scanner input */}
          {inputMode === "keyboard" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                {scanning ? "Scanning..." : "USB scanner or type barcode"}
              </p>
              <div className="flex gap-2">
                <input ref={kbRef} value={kbInput}
                  onChange={e => setKbInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleKbScan() }}
                  placeholder="Scan or type barcode, press Enter"
                  autoFocus
                  className="flex-1 h-12 rounded-xl border-2 border-gray-200 px-4 text-base font-mono focus:border-[#0B7C79] focus:outline-none" />
                <button onClick={handleKbScan} disabled={kbLoading || !kbInput.trim()}
                  className="h-12 px-4 rounded-xl bg-[#0B7C79] text-white disabled:opacity-40">
                  {kbLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
                </button>
              </div>
              {scanStatus && (
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  scanStatus.status === "ok" ? "bg-emerald-50 text-emerald-700" : scanStatus.status === "dup" ? "bg-sky-50 text-sky-700" : "bg-red-50 text-red-700"
                }`}>
                  {scanStatus.status === "ok" && <><Check className="h-4 w-4" />{scanStatus.name}</>}
                  {scanStatus.status === "dup" && <><Plus className="h-4 w-4" />+1 · {scanStatus.name}</>}
                  {scanStatus.status === "err" && <><AlertTriangle className="h-4 w-4" />Barcode not found</>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Live cart */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Scanned Items</h2>
              <p className="text-xs text-gray-500 mt-0.5">{items.length} product{items.length !== 1 ? "s" : ""} · {items.reduce((s, i) => s + i.qty, 0)} units total</p>
            </div>
            {items.length > 0 && (
              <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center">
              <ScanLine className="h-10 w-10 mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Scan your first barcode</p>
              <p className="text-xs text-gray-300 mt-1">Products appear here as you scan</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-420px)] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={item.barcode} className={`px-4 py-3 transition-colors ${idx === 0 ? "bg-emerald-50/60" : "hover:bg-gray-50/60"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.sku} · {item.barcode}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Current stock: {item.current_stock}</p>
                      <input value={item.note} onChange={e => setNote(item.barcode, e.target.value)} placeholder="Add note…"
                        className="mt-1.5 w-full rounded-lg border border-gray-100 bg-white px-2 py-1 text-xs text-gray-600 placeholder-gray-300 focus:border-gray-300 focus:outline-none" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => removeItem(item.barcode)} className="text-gray-300 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white">
                        <button onClick={() => updateQty(item.barcode, -1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-l-lg">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                        <button onClick={() => updateQty(item.barcode, 1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-r-lg">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save footer */}
          <div className="border-t border-gray-100 p-4 bg-gray-50/50">
            {saved ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm font-medium py-1">
                <Check className="h-5 w-5" /> All saved to inventory!
                <button onClick={() => setSaved(false)} className="ml-2 text-xs text-gray-500 underline">Scan more</button>
              </div>
            ) : (
              <button onClick={saveAll} disabled={saving || items.length === 0}
                className={`w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all ${modeConfig!.key === "add" ? "bg-emerald-600 hover:bg-emerald-700" : modeConfig!.key === "sold" ? "bg-rose-600 hover:bg-rose-700" : modeConfig!.key === "damaged" ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-600 hover:bg-sky-700"}`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : `Save ${items.length} item${items.length !== 1 ? "s" : ""} · ${modeConfig!.label}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
