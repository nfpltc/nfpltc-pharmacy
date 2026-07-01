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

function genSKU(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/)
  const letters = words.map(w => w.slice(0, 3)).join("-")
  return `${letters}-${Date.now().toString(36).toUpperCase().slice(-4)}`
}
function genBarcode(): string {
  return `NF${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`
}

// GET /api/admin/inventory/items?search=X&category=Y&status=low|all
export async function GET(req: NextRequest) {
  try {
    const sb = admin()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim()
    const category = searchParams.get("category")?.trim()
    const status = searchParams.get("status")?.trim()
    const barcode = searchParams.get("barcode")?.trim()
    const id = searchParams.get("id")?.trim()

    // Single item by id
    if (id) {
      const { data, error } = await sb.from("inventory_items").select("*").eq("id", id).single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ item: data })
    }

    // Lookup by barcode (used by scanner)
    if (barcode) {
      const { data, error } = await sb.from("inventory_items").select("*").eq("barcode", barcode.trim()).maybeSingle()
      if (!data) return NextResponse.json({ error: "Barcode not found" }, { status: 404 })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ item: data })
    }

    let q = sb.from("inventory_items").select("*").eq("active", true).order("name")
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
    if (category && category !== "all") q = q.eq("category", category)
    if (status === "low") q = q.filter("quantity_in_stock", "lte", "reorder_threshold")

    const { data, error } = await q.limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Stats
    const { count: totalCount } = await sb.from("inventory_items").select("*", { count: "exact", head: true }).eq("active", true)
    const { count: lowCount } = await sb.from("inventory_items").select("*", { count: "exact", head: true }).eq("active", true).filter("quantity_in_stock", "lte", "reorder_threshold")
    const { data: transitSum } = await sb.from("inventory_items").select("quantity_in_transit").eq("active", true)
    const { data: damagedSum } = await sb.from("inventory_items").select("quantity_damaged").eq("active", true)
    const totalTransit = (transitSum || []).reduce((s: number, r: any) => s + (r.quantity_in_transit || 0), 0)
    const totalDamaged = (damagedSum || []).reduce((s: number, r: any) => s + (r.quantity_damaged || 0), 0)

    return NextResponse.json({
      items: data || [],
      stats: { total: totalCount ?? 0, low_stock: lowCount ?? 0, in_transit: totalTransit, damaged: totalDamaged },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create item. Body: { name, category?, form?, strength?, reorder_threshold?, notes? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const sku = body.sku ? String(body.sku).trim().toUpperCase() : genSKU(name)
    const barcode = body.barcode ? String(body.barcode).trim() : genBarcode()

    const sb = admin()
    const { data, error } = await sb.from("inventory_items").insert({
      name, sku, barcode,
      category: body.category ? String(body.category).trim() : "Medication",
      form: body.form ? String(body.form).trim() : null,
      strength: body.strength ? String(body.strength).trim() : null,
      quantity_in_stock: 0,
      reorder_threshold: body.reorder_threshold ? Number(body.reorder_threshold) : 10,
      notes: body.notes ? String(body.notes).trim() : null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, item: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update item fields. Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const allowed = ["name", "category", "form", "strength", "reorder_threshold", "notes", "active"]
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowed) { if (key in body) updates[key] = body[key] }

    const sb = admin()
    const { error } = await sb.from("inventory_items").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — deactivate item (soft delete). ?id=XXX
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const sb = admin()
    await sb.from("inventory_items").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
