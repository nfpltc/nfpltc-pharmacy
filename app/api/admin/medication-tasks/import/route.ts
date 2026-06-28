import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// POST /api/admin/medication-tasks/import
// Accepts CSV text in the body: { csv: "..." }
// Expected columns: patient_name, patient_account, medication, dose, due_at, instructions, priority, comments
// Each row = one medication line. Rows with the same patient_name + patient_account are grouped into one task.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const csv = String(body.csv || "").trim()
    if (!csv) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })

    const lines = csv.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })

    // Parse header
    const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
    const nameIdx = header.indexOf("patient_name")
    const acctIdx = header.indexOf("patient_account")
    const medIdx = header.indexOf("medication")
    const doseIdx = header.indexOf("dose")
    const dueIdx = header.indexOf("due_at")
    const instrIdx = header.indexOf("instructions")
    const prioIdx = header.indexOf("priority")
    const commIdx = header.indexOf("comments")

    if (nameIdx < 0 || medIdx < 0) {
      return NextResponse.json({ error: "CSV must have 'patient_name' and 'medication' columns" }, { status: 400 })
    }

    // Parse rows and group by patient_name + patient_account
    const taskMap = new Map<string, { patient_name: string; patient_account: string | null; medications: any[]; priority: string; comments: string | null }>()
    let rowsParsed = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const patient = (cols[nameIdx] || "").trim()
      const medication = (cols[medIdx] || "").trim()
      if (!patient || !medication) continue

      const account = acctIdx >= 0 ? (cols[acctIdx] || "").trim() || null : null
      const key = `${patient}||${account || ""}`

      if (!taskMap.has(key)) {
        taskMap.set(key, {
          patient_name: patient,
          patient_account: account,
          medications: [],
          priority: prioIdx >= 0 && (cols[prioIdx] || "").trim().toLowerCase() === "urgent" ? "urgent" : "normal",
          comments: commIdx >= 0 ? (cols[commIdx] || "").trim() || null : null,
        })
      }

      const entry = taskMap.get(key)!
      entry.medications.push({
        name: medication,
        dose: doseIdx >= 0 ? (cols[doseIdx] || "").trim() || null : null,
        due_at: dueIdx >= 0 ? parseDateFlex(cols[dueIdx]) : null,
        instructions: instrIdx >= 0 ? (cols[instrIdx] || "").trim() || null : null,
      })
      rowsParsed++
    }

    if (taskMap.size === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 })
    }

    // Insert tasks
    const sb = admin()
    let created = 0
    const errors: string[] = []

    for (const t of taskMap.values()) {
      const medSummary = t.medications.map(m => m.name).join(", ")
      const { error: err } = await sb.from("medication_tasks").insert({
        patient_name: t.patient_name,
        patient_account: t.patient_account,
        medication: medSummary,
        medications: t.medications,
        priority: t.priority,
        comments: t.comments,
        status: "pending",
      })
      if (err) {
        errors.push(`${t.patient_name}: ${err.message}`)
      } else {
        created++
      }
    }

    return NextResponse.json({
      success: true,
      rows_parsed: rowsParsed,
      tasks_created: created,
      errors: errors.slice(0, 20),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = "" }
      else current += ch
    }
  }
  result.push(current)
  return result
}

// Flexible date parser — tries ISO, then common US/EU formats
function parseDateFlex(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}
