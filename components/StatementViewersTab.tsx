"use client"
import { useState, useEffect, useCallback } from "react"
import { Search, Trash2, Eye, EyeOff } from "lucide-react"

// Renders inside the Statement Viewers tab on the Customers admin page.
// Lists everyone who passed the name+email gate on /forms/statements,
// along with what account# they searched and whether a statement was found.

interface ViewerEntry {
  id: string
  name: string
  email: string
  ip_address: string | null
  accessed_at: string
  account_number_attempted: string | null
  statement_viewed: boolean
  searched_at: string | null
}

export default function StatementViewersTab() {
  const [entries, setEntries] = useState<ViewerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [error, setError] = useState("")

  // Debounce the search box so we don't fetch on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.append("q", search)
      const r = await fetch(`/api/admin/statement-viewers?${params}`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Could not load entries"); return }
      setEntries(d.entries || [])
    } catch (e: any) {
      setError(e.message || "Network error")
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry from the audit log?")) return
    try {
      const r = await fetch("/api/admin/statement-viewers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!r.ok) {
        const d = await r.json()
        alert(d.error || "Delete failed")
        return
      }
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      alert("Network error")
    }
  }

  const totalEntries = entries.length
  const viewedCount  = entries.filter(e => e.statement_viewed).length
  const searchedCount = entries.filter(e => e.searched_at).length

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Visits" value={totalEntries} color="emerald" />
        <StatCard label="Searched" value={searchedCount} color="blue" />
        <StatCard label="Found Statement" value={viewedCount} color="purple" />
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name, email, or account number..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >✕</button>
        )}
      </div>

      {/* Error state */}
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {search
            ? `No entries match "${search}"`
            : "No statement viewer entries yet. Entries are recorded when visitors enter their name and email on the public statements page."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Visited</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Account # Tried</th>
                <th className="px-4 py-3 text-center">Result</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatTimestamp(e.accessed_at)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <a href={`mailto:${e.email}`} className="hover:underline">{e.email}</a>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">
                    {e.account_number_attempted || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!e.searched_at ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Did not search
                      </span>
                    ) : e.statement_viewed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        <Eye className="h-3 w-3" /> Found
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        <EyeOff className="h-3 w-3" /> No match
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{e.ip_address || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

function StatCard({ label, value, color }: { label: string; value: number; color: "emerald" | "blue" | "purple" }) {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  }[color]
  return (
    <div className={`rounded-lg border p-3 ${colorClasses}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
