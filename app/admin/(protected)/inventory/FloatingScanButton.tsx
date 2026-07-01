"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ScanLine } from "lucide-react"

export default function FloatingScanButton() {
  const pathname = usePathname()
  if (pathname === "/admin/inventory/scan") return null
  return (
    <Link href="/admin/inventory/scan"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
      style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B7C79 100%)" }}>
      <ScanLine className="h-5 w-5" />
      Scan
    </Link>
  )
}
