import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { serviceIndex, statementServiceConfigured } from "@/lib/statements/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BUCKET = "customer-statements"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"]

// '03/31/2026' -> '2026-03-31' (safe whether bill_date is a date or text column)
function isoDate(mdY: string | null): string | null {
  if (!mdY) return null
  const m = mdY.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

// POST /api/admin/statements/bulk-index  { path, password, month_ym? }
// Fetches the uploaded bulk PDF, indexes it via the statement service, and
// saves a batch + one customer_statements row per customer (page range).
export async function POST(req: NextRequest) {
  if (!statementServiceConfigured()) {
    return NextResponse.json({ error: "STATEMENT_SERVICE_URL not set (deploy the statement-service and set env vars)." }, { status: 500 })
  }
  try {
    const b = await req.json().catch(() => ({}))
    const path = String(b.path || "").trim()
    const password = String(b.password || "").trim()
    if (!path) return NextResponse.json({ error: "path required" }, { status: 400 })

    const sb = admin()

    // Signed URL so we can fetch the uploaded PDF server-side.
    const { data: signed, error: signErr } = await sb.storage.from(BUCKET).createSignedUrl(path, 600)
    if (signErr || !signed?.signedUrl) return NextResponse.json({ error: signErr?.message || "Could not read uploaded file" }, { status: 500 })

    const pdfRes = await fetch(signed.signedUrl)
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download uploaded PDF (${pdfRes.status})` }, { status: 500 })
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer())

    // Heavy lifting on the Python service.
    const { meta, customers } = await serviceIndex(pdfBytes, "bulk.pdf", password)
    if (!customers?.length) return NextResponse.json({ error: "No customers found in the PDF (wrong password?)." }, { status: 400 })

    const monthYm = (b.month_ym && String(b.month_ym)) || meta.month_ym || "unknown"
    let monthLabel = meta.month_label
    if (!monthLabel && /^\d{4}-\d{2}$/.test(monthYm)) {
      const [y, m] = monthYm.split("-")
      monthLabel = `${MONTHS[parseInt(m) - 1] || "?"} ${y}`
    }

    // One batch row for this upload.
    const { data: batch, error: batchErr } = await sb.from("statement_batches").insert({
      month_ym: monthYm, month_label: monthLabel, bulk_path: path, password,
      total_pages: meta.total_pages, customer_count: customers.length,
    }).select("id").single()
    if (batchErr || !batch) return NextResponse.json({ error: batchErr?.message || "Could not save batch" }, { status: 500 })

    // One customer_statements row per customer (extracted on demand later).
    const rows = customers.map((c) => ({
      first_name: c.first_name,
      last_name: c.last_name,
      account_number: c.account_number,
      billing_period: monthYm,
      bill_date: isoDate(c.bill_date),
      amount_due: c.amount_due,
      file_path: null,
      file_name: `${monthLabel || monthYm} Statement.pdf`,
      bulk_batch_id: batch.id,
      start_page: c.start_page,
      end_page: c.end_page,
    }))

    // Insert in chunks to stay well within request limits.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("customer_statements").insert(rows.slice(i, i + 500))
      if (error) return NextResponse.json({ error: `Saved batch but row insert failed: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, month_ym: monthYm, month_label: monthLabel, customers: customers.length, total_pages: meta.total_pages })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Bulk index failed" }, { status: 500 })
  }
}
