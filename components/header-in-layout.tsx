"use client"

import { usePathname } from "next/navigation"
import { SiteHeader } from "@/components/site-header"

const HIDE_HEADER_PATHS = new Set<string>(["/", "/about", "/services"])

export function HeaderInLayout() {
  const pathname = usePathname()
  const normalized = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname

  // Hide on specific public pages that have their own header
  if (HIDE_HEADER_PATHS.has(normalized)) return null
  // Hide on ALL admin pages — admin has its own sidebar + header
  if (normalized.startsWith("/admin")) return null

  return <SiteHeader />
}
