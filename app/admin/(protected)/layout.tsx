import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import AdminSidebar from "@/components/AdminSidebar"
import AdminHeader from "@/components/AdminHeader"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )

  const { data: { user } = { user: null } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Admin"

  // Get allowed pages for sidebar filtering
  let allowedPages: string[] | null = null
  if (user?.email) {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data: adminUser } = await sb
        .from("admin_users")
        .select("role, allowed_pages, active")
        .eq("email", user.email)
        .maybeSingle()
      if (adminUser && adminUser.role !== "admin") {
        allowedPages = adminUser.active ? adminUser.allowed_pages || [] : []
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Persistent sidebar */}
      <AdminSidebar allowedPages={allowedPages} />

      {/* Main area — offset by sidebar width */}
      <div className="pl-56">
        <AdminHeader displayName={displayName} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
