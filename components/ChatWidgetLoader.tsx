"use client"
import { usePathname } from "next/navigation"
import ChatWidget from "@/components/ChatWidget"

export default function ChatWidgetLoader() {
  const pathname = usePathname()
  // Hide on admin pages and the medication-task completion page
  if (pathname?.startsWith("/admin")) return null
  if (pathname?.startsWith("/medication-task")) return null
  return <ChatWidget />
}
