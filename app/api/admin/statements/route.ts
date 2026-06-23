import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// GET /api/admin/statements
// Paginated, NO upfront signed URLs (use /sign endpoint when user clicks View).
// Query: period, search, page (1-based), page_size (default 100, max 500)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period")
    const search = searchParams.get("search")?.trim()
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(500, Math.max(10, parseInt(searchParams.get("page_size") || "100")))
    const skipPeriods = searchParams.get("skip_periods") === "1"

    const sb = admin()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Build the filtered query — count: 'exact' gives us total rows for pagination UI
    let q = sb
      .from("customer_statements")
      .select("id, first_name, last_name, account_number, billing_period, file_path, file_name, bill_date, amount_due, created_at", { count: "exact" })
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .range(from, to)

    if (period && period !== "all") q = q.eq("billing_period", period)
    if (search) {
      q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,account_number.ilike.%${search}%`)
    }

    const { data: rows, count, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Distinct billing periods — only fetched when client doesn't already have them
    let periods: string[] = []
    if (!skipPeriods) {
      // Fast path: call the distinct_billing_periods() SQL function, which
      // uses an index-backed DISTINCT and returns ~60 rows in one query
      // instead of scanning the whole table.
      const { data: rpcData, error: rpcErr } = await sb.rpc("distinct_billing_periods")

      if (!rpcErr && Array.isArray(rpcData)) {
        periods = rpcData
          .map((r: any) => r.billing_period)
          .filter(Boolean)
          .sort()
          .reverse()
      } else {
        // Fallback: the SQL function isn't installed yet (or errored).
        // Scan the table the old way so the dropdown still works. This keeps
        // the app functional if the code deploys before the migration runs.
        const periodsSet = new Set<string>()
        const PAGE_SIZE = 1000
        let pFrom = 0
        while (pFrom < 200_000) {
          const { data: pageP } = await sb
            .from("customer_statements")
            .select("billing_period")
            .order("billing_period", { ascending: false })
            .range(pFrom, pFrom + PAGE_SIZE - 1)
          if (!pageP || pageP.length === 0) break
          for (const row of pageP) if (row.billing_period) periodsSet.add(row.billing_period)
          if (pageP.length < PAGE_SIZE) break
          pFrom += PAGE_SIZE
        }
        periods = Array.from(periodsSet).sort().reverse()
      }
    }

    return NextResponse.json({
      statements: rows || [],
      total: count ?? 0,
      page,
      page_size: pageSize,
      total_pages: count ? Math.ceil(count / pageSize) : 0,
      periods,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// POST - bulk upload (unchanged)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const billingPeriod = formData.get("billing_period") as string
    if (!billingPeriod) {
      return NextResponse.json({ error: "billing_period is required" }, { status: 400 })
    }

    // Accept both "file" (singular — what the admin UI sends one at a time)
    // and "files" (plural — bulk script clients). This avoids a 400 when
    // the client uses the older form-field name.
    const filesField = formData.getAll("files") as File[]
    const singleFile = formData.get("file") as File | null
    const files: File[] = filesField.length > 0
      ? filesField
      : (singleFile ? [singleFile] : [])

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const sb = admin()
    const results = { uploaded: 0, failed: [] as string[] }

    for (const file of files) {
      try {
        const filename = file.name
        const baseName = filename.replace(/\.pdf$/i, "")
        const parts = baseName.split("_")
        if (parts.length < 3) {
          results.failed.push(`${filename}: filename must be LASTNAME_FIRSTNAME_ACCOUNT.pdf`)
          continue
        }
        const lastName = parts[0]
        const firstName = parts[1]
        const accountNumber = parts.slice(2).join("_")

        const filePath = `${billingPeriod}/${filename}`
        const buffer = await file.arrayBuffer()

        const { error: uploadErr } = await sb.storage
          .from("customer-statements")
          .upload(filePath, buffer, { contentType: "application/pdf", upsert: true })
        if (uploadErr) {
          results.failed.push(`${filename}: storage - ${uploadErr.message}`)
          continue
        }

        // Insert or update the DB row WITHOUT relying on a unique constraint.
        // (The previous upsert with onConflict required a UNIQUE index on
        // (account_number, billing_period); if that index is missing the
        // upsert throws. This explicit check-then-write avoids that.)
        const { data: existing, error: selErr } = await sb
          .from("customer_statements")
          .select("id")
          .eq("account_number", accountNumber)
          .eq("billing_period", billingPeriod)
          .maybeSingle()

        if (selErr) {
          results.failed.push(`${filename}: DB lookup - ${selErr.message}`)
          continue
        }

        const rowData = {
          first_name: firstName,
          last_name: lastName,
          account_number: accountNumber,
          billing_period: billingPeriod,
          file_path: filePath,
          file_name: filename,
          amount_due: 0,
        }

        let insertErr = null
        if (existing?.id) {
          // Row already exists for this account+period — update it
          const { error } = await sb
            .from("customer_statements")
            .update(rowData)
            .eq("id", existing.id)
          insertErr = error
        } else {
          // New row
          const { error } = await sb
            .from("customer_statements")
            .insert(rowData)
          insertErr = error
        }

        if (insertErr) {
          results.failed.push(`${filename}: DB write - ${insertErr.message}`)
          continue
        }
        results.uploaded++
      } catch (e: any) {
        results.failed.push(`${file.name}: ${e.message || "unknown"}`)
      }
    }

    return NextResponse.json(results)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}

// DELETE ?id= or ?period=
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const period = searchParams.get("period")
    const sb = admin()

    if (id) {
      const { data: row } = await sb.from("customer_statements").select("file_path").eq("id", id).single()
      if (row?.file_path) {
        await sb.storage.from("customer-statements").remove([row.file_path])
      }
      const { error } = await sb.from("customer_statements").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (period) {
      const { data: rows } = await sb.from("customer_statements")
        .select("file_path").eq("billing_period", period)
      const paths = (rows || []).map((r: any) => r.file_path).filter(Boolean)
      if (paths.length > 0) {
        for (let i = 0; i < paths.length; i += 100) {
          await sb.storage.from("customer-statements").remove(paths.slice(i, i + 100))
        }
      }
      const { error } = await sb.from("customer_statements").delete().eq("billing_period", period)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: paths.length })
    }

    return NextResponse.json({ error: "id or period is required" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Delete failed" }, { status: 500 })
  }
}
