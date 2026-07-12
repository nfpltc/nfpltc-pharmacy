"use client"
import { useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { X, Printer } from "lucide-react"

export type LabelItem = { name: string; sku: string; barcode: string }

// Popular label printers → their common label size (printed width × height, mm).
// Choosing one sizes the label + QR for that printer.
export const PRINTERS: { id: string; name: string; w: number; h: number }[] = [
  { id: "niimbot-50x30", name: "NIIMBOT B1 / B21 / B3S — 50 × 30 mm", w: 50, h: 30 },
  { id: "niimbot-40x30", name: "NIIMBOT B1 / B21 — 40 × 30 mm", w: 40, h: 30 },
  { id: "niimbot-d11", name: "NIIMBOT D11 / D110 — 30 × 14 mm", w: 30, h: 14 },
  { id: "dymo-54x25", name: "DYMO LabelWriter — 54 × 25 mm", w: 54, h: 25 },
  { id: "brother-90x29", name: "Brother QL — 90 × 29 mm", w: 90, h: 29 },
  { id: "zebra-51x25", name: "Zebra ZD410 — 51 × 25 mm (2 × 1 in)", w: 51, h: 25 },
  { id: "thermal-40x30", name: "Rollo / Munbyn thermal — 40 × 30 mm", w: 40, h: 30 },
  { id: "custom", name: "Custom size…", w: 40, h: 30 },
]

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function PrintLabelModal({ item, onClose }: { item: LabelItem; onClose: () => void }) {
  const [printerId, setPrinterId] = useState(PRINTERS[0].id)
  const [customW, setCustomW] = useState("40")
  const [customH, setCustomH] = useState("30")
  const [qrPct, setQrPct] = useState(75)
  const [copies, setCopies] = useState(1)
  const [showText, setShowText] = useState(true)
  const qrRef = useRef<HTMLDivElement>(null)

  const preset = PRINTERS.find(p => p.id === printerId)!
  const w = printerId === "custom" ? Math.max(8, Number(customW) || 40) : preset.w
  const h = printerId === "custom" ? Math.max(8, Number(customH) || 30) : preset.h
  const qrMm = Math.max(6, Math.round(Math.min(w, h) * qrPct / 100))
  const value = item.barcode || item.sku

  // Print via a clean popup: reuse the crisp SVG that QRCodeSVG rendered, sized
  // in real mm, one label per page — no interference from the admin layout.
  const doPrint = () => {
    const svg = qrRef.current?.querySelector("svg")?.outerHTML
    if (!svg) return
    const win = window.open("", "_blank", "width=480,height=480")
    if (!win) { alert("Please allow popups to print labels."); return }
    const textBlock = showText
      ? `<div class="txt"><div class="nm">${esc(item.name)}</div><div class="cd">${esc(value)}</div></div>`
      : ""
    const one = `<div class="label"><div class="qr">${svg}</div>${textBlock}</div>`
    const labels = Array.from({ length: copies }).map(() => one).join("")
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(item.name)}</title><style>
      @page { size: ${w}mm ${h}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      .label { width: ${w}mm; height: ${h}mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; page-break-after: always; }
      .label:last-child { page-break-after: auto; }
      .qr { width: ${qrMm}mm; height: ${qrMm}mm; }
      .qr svg { width: 100%; height: 100%; display: block; }
      .txt { text-align: center; line-height: 1.1; margin-top: 0.6mm; max-width: 100%; overflow: hidden; font-family: Arial, sans-serif; }
      .nm { font-size: 6pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cd { font-size: 5pt; color: #555; letter-spacing: 0.5px; }
    </style></head><body>${labels}
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Print QR label</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Printer / label size</label>
              <select value={printerId} onChange={e => setPrinterId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {PRINTERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {printerId === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium text-gray-500">Width (mm)</label><input type="number" value={customW} onChange={e => setCustomW(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-500">Height (mm)</label><input type="number" value={customH} onChange={e => setCustomH(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              </div>
            )}

            <div>
              <label className="flex items-center justify-between text-xs font-medium text-gray-500">
                <span>QR size</span><span className="text-gray-400">{qrMm} mm</span>
              </label>
              <input type="range" min={40} max={95} value={qrPct} onChange={e => setQrPct(Number(e.target.value))} className="mt-1 w-full accent-[#0B7C79]" />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Copies</label>
                <input type="number" min={1} max={100} value={copies} onChange={e => setCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <label className="mt-5 inline-flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Name + code
              </label>
            </div>
          </div>

          {/* Live preview (scaled) */}
          <div className="flex flex-col items-center justify-center">
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-2">
              <div style={{
                width: `${w * 4.2}px`, height: `${h * 4.2}px`, padding: "3px", background: "#fff",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden",
              }}>
                <div ref={qrRef} style={{ width: `${qrMm * 4.2}px`, height: `${qrMm * 4.2}px`, flexShrink: 0 }}>
                  <QRCodeSVG value={value} size={512} level="M" marginSize={2} style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
                {showText && (
                  <div style={{ marginTop: "3px", textAlign: "center", lineHeight: 1.1, maxWidth: "100%", overflow: "hidden" }}>
                    <div style={{ fontSize: "8px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                    <div style={{ fontSize: "7px", color: "#555", letterSpacing: "0.5px" }}>{value}</div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">{w} × {h} mm preview</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          <p className="text-xs text-gray-400">Set the printer's paper size to <b>{w}×{h} mm</b> in the print dialog.</p>
          <button onClick={doPrint} className="inline-flex items-center gap-2 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68]">
            <Printer className="h-4 w-4" /> Print {copies > 1 ? `${copies} labels` : "label"}
          </button>
        </div>
      </div>
    </div>
  )
}
