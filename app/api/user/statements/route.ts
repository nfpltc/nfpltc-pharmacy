import { NextResponse } from "next/server"
import { getPortalUser } from "@/lib/portal-auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getPortalUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const sb = supabaseAdmin()

    const { data } = await sb
      .from("customer_statements")
      .select("id, billing_period, amount_due, balance, charges, payments, over_30, over_60, over_90, over_120, file_path, file_name, bill_date, facility")
      .eq("account_number", user.account_number)
      .order("billing_period", { ascending: false })

    const statements = await Promise.all(
      (data || []).map(async (s) => {
        let file_url: string | null = null
        if (s.file_path) {
          try {
            const { data: signed } = await sb.storage
              .from("customer-statements")
              .createSignedUrl(s.file_path, 3600)
            file_url = signed?.signedUrl || null
          } catch { /* ignore */ }
        }
        return { ...s, file_url }
      })
    )

    return NextResponse.json({ statements })
  } catch (e: any) {
    console.error("Statements error:", e)
    return NextResponse.json({ error: "Failed to load statements" }, { status: 500 })
  }
}
