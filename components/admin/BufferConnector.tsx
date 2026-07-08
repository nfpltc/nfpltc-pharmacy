"use client"
import { useEffect, useState } from "react"
import { Loader2, Check, AlertCircle, Link2, Trash2, Linkedin, Twitter, Instagram } from "lucide-react"

type Channel = { id: string; name: string; platform: string }

const PLATFORM_ICON: Record<string, any> = { linkedin: Linkedin, x: Twitter, instagram: Instagram }

export function BufferConnector() {
  const [token, setToken] = useState("")
  const [hasToken, setHasToken] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/connectors/buffer")
      const d = await r.json()
      setHasToken(!!d.hasToken)
      setChannels(d.channels || [])
      if (d.hasToken && d.error) setMsg({ type: "error", text: d.error })
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  async function save() {
    if (!token.trim()) { setMsg({ type: "error", text: "Paste your Buffer access token first." }); return }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/connectors/buffer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const d = await r.json()
      if (r.ok) {
        setHasToken(true); setChannels(d.channels || []); setToken("")
        setMsg(d.warning
          ? { type: "error", text: `Saved, but Buffer said: ${d.warning}` }
          : { type: "success", text: `Connected — ${(d.channels || []).length} channel(s) found.` })
      } else setMsg({ type: "error", text: d.error || "Could not save token." })
    } catch { setMsg({ type: "error", text: "Could not save token." }) }
    finally { setSaving(false) }
  }

  async function disconnect() {
    if (!confirm("Disconnect Buffer? Posting will stop until you reconnect.")) return
    await fetch("/api/admin/connectors/buffer", { method: "DELETE" })
    setHasToken(false); setChannels([]); setMsg(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${hasToken ? "bg-emerald-500" : "bg-gray-300"}`} />
        <span className="text-sm font-medium text-gray-700">{hasToken ? "Buffer connected" : "Not connected"}</span>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {msg.type === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Buffer access token</label>
        <p className="mb-3 text-xs text-gray-500">
          Get it from <span className="font-medium">buffer.com/developers → Create App → Access Token (OIDC)</span>. Stored securely in your database; never shown again after saving.
        </p>
        <div className="flex gap-2">
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "•••••••• (saved — paste to replace)" : "Paste token"}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B7C79] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6b68] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {hasToken ? "Replace" : "Connect"}
          </button>
        </div>

        {/* Connected channels */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Connected channels</h4>
            {hasToken && <button onClick={refresh} className="text-xs text-gray-400 hover:text-gray-700">Refresh</button>}
          </div>
          {loading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
          ) : channels.length === 0 ? (
            <p className="py-3 text-sm text-gray-400">{hasToken ? "No channels — connect social profiles in Buffer, then Refresh." : "Connect a token to see your channels."}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => {
                const Icon = PLATFORM_ICON[c.platform] || Link2
                return (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
                    <Icon className="h-3.5 w-3.5 text-[#0B7C79]" /> {c.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {hasToken && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <button onClick={disconnect} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /> Disconnect Buffer</button>
          </div>
        )}
      </div>
    </div>
  )
}
