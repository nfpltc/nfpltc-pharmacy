import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// -------- GET: list customers with optional search --------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim()
    const filter = searchParams.get("filter") // "all" | "with_email" | "no_email" | "opted_out"
    const sb = admin()

    // Paginate past the 1000-row PostgREST cap
    const PAGE_SIZE = 1000
    const all: any[] = []
    let from = 0
    while (from < 200_000) {
      let q = sb.from("customers")
        .select("*")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (search) {
        q = q.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,account_number.ilike.%${search}%,email.ilike.%${search}%`
        )
      }
      if (filter === "with_email")  q = q.not("email", "is", null).neq("email", "")
      if (filter === "no_email")    q = q.or("email.is.null,email.eq.")
      if (filter === "opted_out")   q = q.eq("email_opt_in", false)

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    // Quick summary stats for the header (whole table, not filtered)
    const { count: totalCount } = await sb.from("customers").select("*", { count: "exact", head: true })
    const { count: withEmailCount } = await sb
      .from("customers").select("*", { count: "exact", head: true })
      .not("email", "is", null).neq("email", "")
    const { count: optedOutCount } = await sb
      .from("customers").select("*", { count: "exact", head: true })
      .eq("email_opt_in", false)

    return NextResponse.json({
      customers: all,
      stats: {
        total: totalCount ?? 0,
        with_email: withEmailCount ?? 0,
        no_email: (totalCount ?? 0) - (withEmailCount ?? 0),
        opted_out: optedOutCount ?? 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// -------- POST: create one customer --------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sb = admin()

    const payload = {
      account_number: String(body.account_number || "").trim(),
      first_name:     String(body.first_name || "").trim(),
      last_name:      String(body.last_name || "").trim(),
      email:          body.email ? String(body.email).trim().toLowerCase() : null,
      phone:          body.phone ? String(body.phone).trim() : null,
      email_opt_in:   body.email_opt_in === false ? false : true,
      notes:          body.notes ? String(body.notes).trim() : null,
      address:        body.address ? String(body.address).trim() : null,
      city:           body.city ? String(body.city).trim() : null,
      state:          body.state ? String(body.state).trim() : null,
      zip:            body.zip ? String(body.zip).trim() : null,
      date_of_birth:  body.date_of_birth ? String(body.date_of_birth).trim() : null,
      secondary_contact: body.secondary_contact ? String(body.secondary_contact).trim() : null,
    }

    if (!payload.account_number || !payload.first_name || !payload.last_name) {
      return NextResponse.json({ error: "account_number, first_name, and last_name are required" }, { status: 400 })
    }

    const { data, error } = await sb.from("customers").insert(payload).select().single()
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Account ${payload.account_number} already exists` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ customer: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// -------- PATCH: update one customer by account_number --------
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const accountNumber = String(body.account_number || "").trim()
    if (!accountNumber) return NextResponse.json({ error: "account_number required" }, { status: 400 })

    const updates: Record<string, any> = {}
    if ("first_name"   in body) updates.first_name   = String(body.first_name || "").trim()
    if ("last_name"    in body) updates.last_name    = String(body.last_name || "").trim()
    if ("email"        in body) updates.email        = body.email ? String(body.email).trim().toLowerCase() : null
    if ("phone"        in body) updates.phone        = body.phone ? String(body.phone).trim() : null
    if ("email_opt_in" in body) {
      updates.email_opt_in = body.email_opt_in === false ? false : true
      updates.unsubscribed_at = body.email_opt_in === false ? new Date().toISOString() : null
    }
    if ("notes"        in body) updates.notes        = body.notes ? String(body.notes).trim() : null
    if ("address"      in body) updates.address      = body.address ? String(body.address).trim() : null
    if ("city"         in body) updates.city         = body.city ? String(body.city).trim() : null
    if ("state"        in body) updates.state        = body.state ? String(body.state).trim() : null
    if ("zip"          in body) updates.zip          = body.zip ? String(body.zip).trim() : null
    if ("date_of_birth" in body) updates.date_of_birth = body.date_of_birth ? String(body.date_of_birth).trim() : null
    if ("secondary_contact" in body) updates.secondary_contact = body.secondary_contact ? String(body.secondary_contact).trim() : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 })
    }

    const sb = admin()
    const { data, error } = await sb.from("customers")
      .update(updates).eq("account_number", accountNumber).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ customer: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// -------- DELETE: remove one customer by account_number --------
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accountNumber = searchParams.get("account_number")?.trim()
    if (!accountNumber) return NextResponse.json({ error: "account_number required" }, { status: 400 })

    const sb = admin()
    const { error } = await sb.from("customers").delete().eq("account_number", accountNumber)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
