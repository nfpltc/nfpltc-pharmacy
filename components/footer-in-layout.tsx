"use client"

import { usePathname } from "next/navigation"
import { SiteFooter } from "@/components/site-footer"

export function FooterInLayout() {
  const pathname = usePathname()
  if (pathname === "/") return null
  // Hide on ALL admin pages — admin has its own layout
  if (pathname.startsWith("/admin")) return null
  return <SiteFooter />
}
