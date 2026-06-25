import Link from "next/link"
import { ArrowLeft, Bot } from "lucide-react"
import AdminAssistant from "@/components/AdminAssistant"

export const dynamic = "force-dynamic"

export default function AdminAssistantPage() {
  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      <section
        className="relative isolate overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white md:text-3xl">
            <Bot className="h-7 w-7" /> Admin Assistant
          </h1>
          <p className="mt-1 text-sm text-white/85">
            Ask questions about customers, statements, and forms. Read-only.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-6">
        <AdminAssistant />
      </section>
    </main>
  )
}
