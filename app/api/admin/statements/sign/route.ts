import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/statements/sign?id=<statement id>
// Returns a signed download URL for one specific statement PDF.
// Used by the admin page when a user clicks View on a row, so we don't
// generate 1000+ signed URLs upfront on page load.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const sb = admin()
    const { data: row, error } = await sb
      .from("customer_statements")
      .select("file_path, file_name")
      .eq("id", id)
      .single()

    if (error || !row || !row.file_path) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 })
    }

    const { data: signed, error: signErr } = await sb.storage
      .from("customer-statements")
      .createSignedUrl(row.file_path, 3600)  // 1-hour link

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: signErr?.message || "Could not generate link" }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl, file_name: row.file_name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
