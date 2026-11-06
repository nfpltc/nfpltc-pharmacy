import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET — list portal access requests
export async function GET() {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from("portal_access_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ requests: data || [] })
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

// POST — approve or reject a request
export async function POST(req: NextRequest) {
  try {
    const { id, action, admin_notes } = await req.json()
    if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 })

    const sb = supabaseAdmin()

    if (action === "approve") {
      // Get the request
      const { data: request } = await sb
        .from("portal_access_requests")
        .select("*")
        .eq("id", id)
        .single()
      if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 })

      // Update customer record with the email
      const { error: updateErr } = await sb
        .from("customers")
        .update({ email: request.email, phone: request.phone || undefined })
        .eq("account_number", request.account_number)
      if (updateErr) {
        return NextResponse.json({ error: "Failed to update customer: " + updateErr.message }, { status: 500 })
      }

      // Mark request as approved
      await sb.from("portal_access_requests").update({
        status: "approved",
        admin_notes: admin_notes || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id)

      return NextResponse.json({ ok: true, message: "Approved. Customer can now create their account." })
    }

    if (action === "reject") {
      await sb.from("portal_access_requests").update({
        status: "rejected",
        admin_notes: admin_notes || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id)
      return NextResponse.json({ ok: true, message: "Request rejected." })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
