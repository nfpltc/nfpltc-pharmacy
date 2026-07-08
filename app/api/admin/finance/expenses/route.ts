import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const CATEGORIES = ["Payroll", "Rent", "Inventory", "Utilities", "Other"]

// GET /api/admin/finance/expenses  -> all expenses
export async function GET() {
  const { data, error } = await admin().from("pharmacy_expenses").select("*").order("month_ym", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data })
}

// POST /api/admin/finance/expenses  { month_ym, category, label?, amount }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const month_ym = String(b.month_ym || "").trim()
  const amount = Number(b.amount)
  const category = CATEGORIES.includes(b.category) ? b.category : "Other"
  if (!/^\d{4}-\d{2}$/.test(month_ym)) return NextResponse.json({ error: "Pick a month" }, { status: 400 })
  if (!amount || amount <= 0) return NextResponse.json({ error: "Enter a positive amount" }, { status: 400 })
  const { data, error } = await admin().from("pharmacy_expenses")
    .insert({ month_ym, category, label: String(b.label || "").trim() || null, amount }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}

// DELETE /api/admin/finance/expenses?id=
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const { error } = await admin().from("pharmacy_expenses").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
