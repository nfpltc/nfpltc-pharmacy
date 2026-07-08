import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { serviceExtract } from "@/lib/statements/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BUCKET = "customer-statements"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/statements/extract?id=<customer_statements id>
// Admin-only (behind the protected admin area, like /sign). Extracts a bulk
// statement's page range on demand and streams it so admins can preview it.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  try {
    const sb = admin()
    const { data: row } = await sb
      .from("customer_statements")
      .select("first_name, last_name, billing_period, bulk_batch_id, start_page, end_page")
      .eq("id", id)
      .maybeSingle()
    if (!row || !row.bulk_batch_id || row.start_page == null) {
      return NextResponse.json({ error: "Not a bulk statement" }, { status: 404 })
    }

    const { data: batch } = await sb
      .from("statement_batches")
      .select("bulk_path, password")
      .eq("id", row.bulk_batch_id)
      .maybeSingle()
    if (!batch?.bulk_path) return NextResponse.json({ error: "Statement source missing" }, { status: 404 })

    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(batch.bulk_path, 300)
    if (!signed?.signedUrl) return NextResponse.json({ error: "Could not open source" }, { status: 500 })

    const pdf = await serviceExtract(signed.signedUrl, row.start_page, row.end_page, batch.password || "")
    const fname = `${row.last_name}_${row.first_name}_${row.billing_period}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_")
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not open statement" }, { status: 500 })
  }
}
