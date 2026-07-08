import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "customer-statements"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/statements/bulk-sign  { month_ym }
// Returns a signed upload URL so the browser can upload the (large) bulk PDF
// straight to Supabase, bypassing Vercel's request-size limit.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const monthYm = String(b.month_ym || "").trim() || "unknown"
  const stamp = String(b.stamp || "").replace(/[^0-9]/g, "").slice(0, 14) || "0"
  const path = `bulk/${monthYm}-${stamp}.pdf`
  const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl, bucket: BUCKET })
}
