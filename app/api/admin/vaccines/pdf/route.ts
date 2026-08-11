// app/api/admin/vaccines/pdf/route.ts
//
// GET /api/admin/vaccines/pdf?id=<uuid> — re-generates the consent PDF for a
// stored submission and streams it back as a download.
//
// Unlike its sibling routes under /api/admin/vaccines, this one authenticates.
// Those routes return JSON to an already-rendered dashboard; this one returns a
// complete PHI document from a plain GET, which means a bare URL would be
// enough to exfiltrate a patient record. The admin check below is deliberate —
// please keep it if you refactor.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { consentPdfFilename, createConsentPdf } from "@/lib/vaccine-consent-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/** Resolve the signed-in Supabase user, or null. */
async function currentUser() {
  const maybeStore = cookies() as any
  const cookieStore = typeof maybeStore?.then === "function" ? await maybeStore : maybeStore

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const sb = serviceClient()

    const { data: adminUser } = await sb
      .from("admin_users")
      .select("id")
      .eq("email", user.email)
      .maybeSingle()

    if (!adminUser) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    const { data: row, error } = await sb
      .from("vaccine_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: "Submission not found" }, { status: 404 })

    // Prefer the archived payload; `full_form_date` is the legacy misspelled
    // column kept for rows submitted before supabase/vaccine_submissions.sql ran.
    const payload = row.full_form_data ?? (row as any).full_form_date ?? rebuildPayload(row)

    const recordId = row.record_id || row.id
    const pdfBytes = await createConsentPdf(payload, String(recordId))

    return new NextResponse(Buffer.from(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${consentPdfFilename(payload, String(recordId))}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("❌ Admin vaccine PDF error:", err)
    return NextResponse.json({ error: err?.message || "Failed to build PDF" }, { status: 500 })
  }
}

/**
 * Older rows predate the archived-payload column. Reassemble what we can from
 * the flat columns so the download still produces a usable document rather
 * than failing outright.
 */
function rebuildPayload(row: Record<string, any>) {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    age: row.age,
    gender: row.gender,
    race: row.race,
    ethnicity: row.ethnicity,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    email: row.email,
    phone: row.phone,
    physicianName: row.physician_name,
    physicianPhone: row.physician_phone,
    physicianFax: row.physician_fax,
    vaccinesRequested: row.vaccines_requested ?? (row.vaccine_type ? String(row.vaccine_type).split(", ") : []),
    otherVaccineText: row.other_vaccine_text,
    q18Conditions: row.q18_conditions ?? [],
    consentName: row.consent_name,
    consentDate: row.consent_date,
    consentAgree: row.consent_agree,
    insuranceTypes: row.insurance_types ?? [],
    insurancePlanName: row.insurance_plan_name,
    memberId: row.member_id,
    rxBin: row.rx_bin,
    rxPcn: row.rx_pcn,
    groupNo: row.group_no,
    medicareCardNo: row.medicare_card_no,
    medicareId: row.medicare_id,
    authorizeBilling: row.authorize_billing,
    vaccineRows: row.vaccine_rows ?? [],
    immunizerName: row.immunizer_name,
    ...(row.screening_responses ?? {}),
  }
}
