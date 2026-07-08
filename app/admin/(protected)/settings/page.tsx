"use client"

import { useState } from "react"
import { Settings as SettingsIcon, Share2, Users } from "lucide-react"
import { BufferConnector } from "@/components/admin/BufferConnector"
import { UsersManager } from "@/components/admin/UsersManager"

type Tab = "buffer" | "users"

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "buffer", label: "Buffer connection", icon: Share2 },
  { id: "users", label: "User management", icon: Users },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("buffer")

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><SettingsIcon className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Connect Buffer for social posting and manage admin users.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "buffer" && <BufferConnector />}
      {tab === "users" && <UsersManager />}
    </div>
  )
}
