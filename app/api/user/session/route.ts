import { NextResponse } from "next/server"
import { getPortalUser } from "@/lib/portal-auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getPortalUser()
    if (!user) return NextResponse.json({ user: null })

    // Also fetch the customer name for display
    const sb = supabaseAdmin()
    const { data: customer } = await sb
      .from("customers")
      .select("first_name, last_name")
      .eq("account_number", user.account_number)
      .maybeSingle()

    return NextResponse.json({
      user: {
        ...user,
        first_name: customer?.first_name || null,
        last_name: customer?.last_name || null,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
