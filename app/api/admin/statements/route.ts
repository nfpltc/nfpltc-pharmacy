import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET - List all statements with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period")
    const search = searchParams.get("search")
    const sb = admin()

    // --- 1) Fetch ALL matching rows in batches of 1000 (Supabase/PostgREST caps
    //        each request at 1000 rows by default, so we paginate with .range()). ---
    const PAGE_SIZE = 1000
    const allRows: any[] = []
    let from = 0
    // Safety ceiling so a runaway query can't loop forever
    const MAX_ROWS = 200_000

    while (from < MAX_ROWS) {
      let q = sb
        .from("customer_statements")
        .select("*")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (period && period !== "all") q = q.eq("billing_period", period)
      if (search) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,account_number.ilike.%${search}%`)
      }

      const { data: pageRows, error: pageErr } = await q
      if (pageErr) return NextResponse.json({ error: pageErr.message }, { status: 500 })
      if (!pageRows || pageRows.length === 0) break

      allRows.push(...pageRows)
      if (pageRows.length < PAGE_SIZE) break  // last page
      from += PAGE_SIZE
    }

    // --- 2) Get distinct billing periods (paginated the same way). Needed so
    //        the dropdown shows every month that has statements, not just the
    //        newest month that happens to fill the first 1000 rows. ---
    const periodsSet = new Set<string>()
    let pFrom = 0
    while (pFrom < MAX_ROWS) {
      const { data: pageP, error: pErr } = await sb
        .from("customer_statements")
        .select("billing_period")
        .order("billing_period", { ascending: false })
        .range(pFrom, pFrom + PAGE_SIZE - 1)
      if (pErr) break
      if (!pageP || pageP.length === 0) break
      for (const row of pageP) if (row.billing_period) periodsSet.add(row.billing_period)
      if (pageP.length < PAGE_SIZE) break
      pFrom += PAGE_SIZE
    }
    // Sort newest-first (YYYY-MM strings compare correctly lexicographically)
    const uniquePeriods = Array.from(periodsSet).sort().reverse()

    // --- 3) Sign file URLs (1 hr). Throttle concurrency so we don't overwhelm
    //        Supabase Storage if the list is huge. ---
    const CONCURRENCY = 25
    const statements: any[] = []
    for (let i = 0; i < allRows.length; i += CONCURRENCY) {
      const batch = allRows.slice(i, i + CONCURRENCY)
      const signed = await Promise.all(
        batch.map(async (s: any) => {
          if (s.file_path) {
            try {
              const { data: sig } = await sb.storage
                .from("customer-statements")
                .createSignedUrl(s.file_path, 3600)
              s.file_url = sig?.signedUrl || null
            } catch { s.file_url = null }
          }
          return s
        })
      )
      statements.push(...signed)
    }

    return NextResponse.json({ statements, periods: uniquePeriods })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - Upload a single statement PDF (called repeatedly for bulk upload)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const billingPeriod = formData.get("billing_period") as string
    const fileName = formData.get("file_name") as string
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const accountNumber = formData.get("account_number") as string

    if (!file || !billingPeriod || !lastName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const sb = admin()

    // Upload PDF to storage: customer-statements/2026-03/LASTNAME_FIRSTNAME_ACCOUNT.pdf
    const storagePath = `${billingPeriod}/${fileName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await sb.storage
      .from("customer-statements")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // Check if record already exists (same name + period) and update, or insert new
    const { data: existing } = await sb
      .from("customer_statements")
      .select("id")
      .eq("last_name", lastName)
      .eq("first_name", firstName)
      .eq("billing_period", billingPeriod)
      .eq("account_number", accountNumber)
      .single()

    const record = {
      first_name: firstName,
      last_name: lastName,
      account_number: accountNumber,
      billing_period: billingPeriod,
      bill_date: new Date().toISOString().split("T")[0],
      amount_due: 0,
      file_path: storagePath,
      file_name: fileName,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await sb.from("customer_statements").update(record).eq("id", existing.id)
    } else {
      const { error: insertErr } = await sb.from("customer_statements").insert(record)
      if (insertErr) return NextResponse.json({ error: `DB error: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, name: `${lastName}, ${firstName}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - Delete all statements for a billing period, or a single statement
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period")
    const id = searchParams.get("id")
    const sb = admin()

    if (id) {
      // Delete single statement
      const { data: stmt } = await sb.from("customer_statements").select("file_path").eq("id", id).single()
      if (stmt?.file_path) await sb.storage.from("customer-statements").remove([stmt.file_path])
      await sb.from("customer_statements").delete().eq("id", id)
      return NextResponse.json({ success: true, deleted: 1 })
    }

    if (period) {
      // Delete all statements for a period
      const { data: stmts } = await sb.from("customer_statements").select("file_path").eq("billing_period", period)
      const paths = (stmts || []).map((s: any) => s.file_path).filter(Boolean)
      if (paths.length > 0) {
        // Delete storage files in batches of 100
        for (let i = 0; i < paths.length; i += 100) {
          await sb.storage.from("customer-statements").remove(paths.slice(i, i + 100))
        }
      }
      const { error } = await sb.from("customer_statements").delete().eq("billing_period", period)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: paths.length })
    }

    return NextResponse.json({ error: "Provide period or id" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
