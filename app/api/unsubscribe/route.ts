import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyUnsubscribeToken } from "@/lib/statement-email"

export const runtime = "nodejs"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/unsubscribe  { token }  -> sets email_opt_in = false
// Supports Gmail/Outlook one-click unsubscribe via the List-Unsubscribe-Post header.
export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get("t") || (await safeJson(req))?.token
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const secret = (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string
    const accountNumber = verifyUnsubscribeToken(token, secret)
    if (!accountNumber) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 })

    const sb = admin()
    const { error } = await sb.from("customers")
      .update({ email_opt_in: false, unsubscribed_at: new Date().toISOString() })
      .eq("account_number", accountNumber)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, account_number: accountNumber })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function safeJson(req: NextRequest): Promise<any> {
  try { return await req.json() } catch { return null }
}
