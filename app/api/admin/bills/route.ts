import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET() {
  try {
    const { data, error } = await admin().from("bills").select("*").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bills: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const sb = admin()

    const bill: Record<string, any> = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      bill_date: formData.get("bill_date") as string,
      due_date: (formData.get("due_date") as string) || null,
      amount: parseFloat(formData.get("amount") as string) || 0,
      description: (formData.get("description") as string) || null,
      status: (formData.get("status") as string) || "unpaid",
    }

    if (file && file.size > 0) {
      const path = `bills/${Date.now()}-${file.name}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await sb.storage.from("bills").upload(path, buf, { contentType: "application/pdf" })
      if (!upErr) {
        bill.file_path = path
        bill.file_name = file.name
      }
    }

    const { data, error } = await sb.from("bills").insert(bill).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bill: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json(); const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    updates.updated_at = new Date().toISOString()
    const { data, error } = await admin().from("bills").update(updates).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bill: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    const { error } = await admin().from("bills").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
