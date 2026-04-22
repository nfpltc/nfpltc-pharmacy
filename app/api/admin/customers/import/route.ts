import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Map common header variations → our canonical column names
const HEADER_ALIASES: Record<string, string> = {
  "account_number": "account_number", "account number": "account_number",
  "account #": "account_number", "acct #": "account_number",
  "acct number": "account_number", "acct": "account_number",
  "account": "account_number", "account_no": "account_number",
  "customer id": "account_number", "customer number": "account_number",

  "first_name": "first_name", "first name": "first_name", "firstname": "first_name",
  "first": "first_name", "given name": "first_name", "fname": "first_name",

  "last_name": "last_name", "last name": "last_name", "lastname": "last_name",
  "last": "last_name", "surname": "last_name", "family name": "last_name", "lname": "last_name",

  "email": "email", "email address": "email", "e-mail": "email", "email_address": "email",

  "phone": "phone", "phone number": "phone", "telephone": "phone",
  "phone_number": "phone", "mobile": "phone", "cell": "phone",

  "notes": "notes", "note": "notes", "comments": "notes",
}

function canonHeader(h: string) {
  const clean = h.toLowerCase().trim().replace(/\s+/g, " ")
  return HEADER_ALIASES[clean] || null
}

// Email looks vaguely valid? (permissive)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Body: multipart form with one field "file"
// Behavior:
//   - Parses first sheet
//   - Detects header row (row 1)
//   - Validates rows; returns counts + sample of issues
//   - If ?commit=1, upserts into customers table. Otherwise it's a DRY RUN preview.
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const commit = url.searchParams.get("commit") === "1"

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

    const arrayBuf = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuf, { type: "array" })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: "No sheets found in file" }, { status: 400 })
    const sheet = wb.Sheets[sheetName]

    // Read as 2D array to preserve raw headers
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" })
    if (rows.length < 2) {
      return NextResponse.json({ error: "Sheet must have a header row and at least one data row" }, { status: 400 })
    }

    const headerRow = rows[0].map(String)
    const columnMap: Record<number, string> = {}
    for (let i = 0; i < headerRow.length; i++) {
      const mapped = canonHeader(headerRow[i])
      if (mapped) columnMap[i] = mapped
    }

    const required = ["account_number", "first_name", "last_name"]
    const mappedCols = Object.values(columnMap)
    const missing = required.filter(r => !mappedCols.includes(r))
    if (missing.length) {
      return NextResponse.json({
        error: `Missing required column(s): ${missing.join(", ")}. Found headers: ${headerRow.join(", ")}`,
      }, { status: 400 })
    }

    // Build validated row list
    const valid: any[] = []
    const issues: Array<{ row: number; reason: string; data?: any }> = []
    const seenAccounts = new Set<string>()

    for (let r = 1; r < rows.length; r++) {
      const raw = rows[r]
      if (!raw || raw.every(c => String(c ?? "").trim() === "")) continue // skip blank

      const rec: Record<string, any> = {}
      for (const [idx, col] of Object.entries(columnMap)) {
        rec[col] = String(raw[Number(idx)] ?? "").trim()
      }

      // Required-field checks
      if (!rec.account_number) { issues.push({ row: r + 1, reason: "missing account_number", data: rec }); continue }
      if (!rec.first_name)     { issues.push({ row: r + 1, reason: "missing first_name", data: rec }); continue }
      if (!rec.last_name)      { issues.push({ row: r + 1, reason: "missing last_name", data: rec }); continue }

      // Account number sanity (not strict — may contain letters if pharmacy uses them)
      rec.account_number = String(rec.account_number).trim()

      // Dedup within the file
      if (seenAccounts.has(rec.account_number)) {
        issues.push({ row: r + 1, reason: `duplicate account_number in file (${rec.account_number})`, data: rec })
        continue
      }
      seenAccounts.add(rec.account_number)

      // Email validation (optional field, but if present it must look real)
      if (rec.email) {
        rec.email = rec.email.toLowerCase()
        if (!EMAIL_RE.test(rec.email)) {
          issues.push({ row: r + 1, reason: `invalid email: ${rec.email}`, data: rec })
          continue
        }
      } else {
        rec.email = null
      }
      if (!rec.phone) rec.phone = null
      if (!rec.notes) rec.notes = null

      valid.push(rec)
    }

    // Look up which accounts already exist (so we can show "new vs update")
    const sb = admin()
    const existingSet = new Set<string>()
    const CHUNK = 500
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = valid.slice(i, i + CHUNK).map(v => v.account_number)
      const { data } = await sb.from("customers").select("account_number").in("account_number", batch)
      ;(data || []).forEach((r: any) => existingSet.add(r.account_number))
    }
    const toInsert = valid.filter(v => !existingSet.has(v.account_number))
    const toUpdate = valid.filter(v => existingSet.has(v.account_number))

    const summary = {
      sheet: sheetName,
      total_rows: rows.length - 1,
      valid: valid.length,
      new_customers: toInsert.length,
      updates: toUpdate.length,
      skipped: issues.length,
      issues: issues.slice(0, 50),                 // cap to avoid huge response
      preview: valid.slice(0, 5),                  // first 5 rows as preview
      headers_detected: headerRow,
      columns_mapped: columnMap,
    }

    if (!commit) {
      return NextResponse.json({ dry_run: true, summary })
    }

    // COMMIT: upsert in chunks of 500
    let inserted = 0, updated = 0, failures: any[] = []
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = valid.slice(i, i + CHUNK)
      const { error } = await sb.from("customers")
        .upsert(batch, { onConflict: "account_number" })
      if (error) {
        // Fall back to row-by-row so one bad row doesn't kill the whole batch
        for (const row of batch) {
          const { error: oneErr } = await sb.from("customers")
            .upsert(row, { onConflict: "account_number" })
          if (oneErr) failures.push({ account_number: row.account_number, error: oneErr.message })
          else {
            if (existingSet.has(row.account_number)) updated++; else inserted++
          }
        }
      } else {
        for (const row of batch) {
          if (existingSet.has(row.account_number)) updated++; else inserted++
        }
      }
    }

    return NextResponse.json({
      dry_run: false,
      summary: { ...summary, inserted, updated, failures: failures.slice(0, 50), failure_count: failures.length },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Increase body size cap for big Excel files
export const config = { api: { bodyParser: false } }
export const runtime = "nodejs"
export const maxDuration = 60
