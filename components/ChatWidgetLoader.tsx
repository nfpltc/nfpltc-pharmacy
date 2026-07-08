"use client"
import { usePathname } from "next/navigation"
import ChatWidget from "@/components/ChatWidget"

export default function ChatWidgetLoader() {
  const pathname = usePathname()
  // No public chat on admin or the medication-task completion page.
  if (pathname?.startsWith("/admin")) return null
  if (pathname?.startsWith("/medication-task")) return null
  // The greeting popup only auto-shows on the landing page. Every other page
  // (statements, forms, etc.) shows just the small, dismissible chat icon.
  const landing = pathname === "/"
  return <ChatWidget landing={landing} />
}
