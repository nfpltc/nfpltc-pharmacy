import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/inventory/move?item_id=X&limit=20  — recent movements for an item or all
export async function GET(req: NextRequest) {
  try {
    const sb = admin()
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get("item_id")?.trim()
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200)

    let q = sb.from("inventory_movements")
      .select("*, inventory_items(name, sku, barcode)")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (itemId) q = q.eq("item_id", itemId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ movements: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/inventory/move
// Body: { item_id, action, quantity, notes?, location? }
// Updates the relevant column in inventory_items atomically
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const itemId = String(body.item_id || "").trim()
    const action = String(body.action || "").trim().toLowerCase()
    const quantity = Number(body.quantity)

    if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 })
    if (!["add", "sold", "damaged", "transit"].includes(action)) {
      return NextResponse.json({ error: "action must be: add | sold | damaged | transit" }, { status: 400 })
    }
    if (!quantity || quantity < 1) return NextResponse.json({ error: "quantity must be ≥ 1" }, { status: 400 })

    // Get current user email from session (best-effort)
    let scannedBy: string | null = null
    try {
      const maybeStore = cookies() as any
      const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore
      const userSb = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get(n: string) { return cookieStore.get(n)?.value } } }
      )
      const { data: { user } } = await userSb.auth.getUser()
      scannedBy = user?.email || null
    } catch { /* non-fatal */ }

    const sb = admin()

    // Get current item
    const { data: item, error: itemErr } = await sb.from("inventory_items").select("*").eq("id", itemId).single()
    if (itemErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    // Build the stock update
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    switch (action) {
      case "add":
        updates.quantity_in_stock = Math.max(0, (item.quantity_in_stock || 0) + quantity)
        break
      case "sold":
        if ((item.quantity_in_stock || 0) < quantity) {
          return NextResponse.json({ error: `Not enough stock. Current: ${item.quantity_in_stock}, Requested: ${quantity}` }, { status: 400 })
        }
        updates.quantity_in_stock = (item.quantity_in_stock || 0) - quantity
        break
      case "damaged":
        updates.quantity_in_stock = Math.max(0, (item.quantity_in_stock || 0) - quantity)
        updates.quantity_damaged = (item.quantity_damaged || 0) + quantity
        break
      case "transit":
        updates.quantity_in_transit = (item.quantity_in_transit || 0) + quantity
        break
    }

    // Update item stock
    const { error: updateErr } = await sb.from("inventory_items").update(updates).eq("id", itemId)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Log the movement
    await sb.from("inventory_movements").insert({
      item_id: itemId,
      action,
      quantity,
      notes: body.notes ? String(body.notes).trim() : null,
      location: body.location ? String(body.location).trim() : null,
      scanned_by: scannedBy,
    })

    // Return updated item
    const { data: updated } = await sb.from("inventory_items").select("*").eq("id", itemId).single()
    return NextResponse.json({ success: true, item: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
