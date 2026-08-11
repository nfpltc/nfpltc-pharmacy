// app/api/forms/vaccine-consent/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"
import { collectScreeningResponses } from "@/lib/vaccine-consent-form"
import { consentPdfFilename, createConsentPdf, maskSsn } from "@/lib/vaccine-consent-pdf"

// Ensure Node.js runtime so fs/path/pdf-lib work in App Router
export const runtime = "nodejs"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL // e.g. "forms@your-verified-domain.com"
const TO_EMAIL = process.env.TO_EMAIL     // e.g. "care@nfpltc.com"

if (!RESEND_API_KEY) console.warn("⚠️ RESEND_API_KEY is not set.")
if (!FROM_EMAIL) console.warn("⚠️ FROM_EMAIL is not set.")
if (!TO_EMAIL) console.warn("⚠️ TO_EMAIL is not set.")

const resend = new Resend(RESEND_API_KEY)

function safe(v: any) {
  if (v === null || v === undefined) return ""
  return String(v)
}

/** Empty strings coming out of <input> elements should land as SQL NULL. */
function nullIfBlank(v: any) {
  const s = safe(v).trim()
  return s === "" ? null : s
}

/** Supabase `date` columns reject "", so blank dates must become NULL. */
function dateOrNull(v: any) {
  const s = safe(v).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function arrayOrNull(v: any): string[] | null {
  return Array.isArray(v) && v.length ? v.map(String) : null
}

/**
 * Screening answers that a pharmacist should look at before dosing.
 *
 * This is deliberately a conservative first pass — it flags for *review*, it
 * never rejects a submission. Tune the question list to match NFPLTC's
 * standing protocol; the printed form's numbering is preserved in
 * lib/vaccine-consent-form.ts so the two stay easy to compare.
 */
function deriveReviewFlags(form: Record<string, any>): string[] {
  const flags: string[] = []

  if (form.q1 === "Yes") flags.push("Feels sick today")
  if (form.q3 === "Yes") flags.push("Reported allergies")
  if (form.q4 === "Yes") flags.push("Prior reaction to an immunization")
  if (form.q5 === "Yes") flags.push("Neurological disorder / GBS history")
  if (form.q6 === "Yes") flags.push("Immunocompromised")
  if (form.q7 === "Yes") flags.push("Pregnant or planning pregnancy")
  if (form.q17 === "Yes") flags.push("Allergic reaction to a COVID-19 vaccine component")

  // Live-vaccine contraindications only matter if a live vaccine is requested,
  // but the pharmacist decides which product to give, so surface them anyway.
  if (form.q9 === "Yes") flags.push("On infusions / immunosuppressive therapy")
  if (form.q10 === "Yes") flags.push("High-dose steroid therapy")
  if (form.q11 === "Yes") flags.push("Recent transfusion or immune globulin")

  if (Array.isArray(form.q18Conditions) && form.q18Conditions.length) {
    flags.push(`${form.q18Conditions.length} COVID-19 condition(s) checked`)
  }

  return flags
}

export async function POST(req: Request) {
  try {
    const form = await req.json()
    const recordId = `${Date.now()}`

    const pdfBytes = await createConsentPdf(form, recordId)
    const pdfBuffer = Buffer.from(pdfBytes)
    const filename = consentPdfFilename(form, recordId)

    const requested: string[] = Array.isArray(form.vaccinesRequested) ? form.vaccinesRequested : []
    const requestedDisplay = requested
      .map((v) => (v === "Other" && form.otherVaccineText ? `Other: ${safe(form.otherVaccineText)}` : v))
      .join(", ")

    const reviewFlags = deriveReviewFlags(form)

    const flagsHtml = reviewFlags.length
      ? `<div style="margin:16px 0;padding:12px;border-left:4px solid #d97706;background:#fffbeb;">
           <p style="margin:0 0 6px;font-weight:bold;color:#92400e;">Needs pharmacist review</p>
           <ul style="margin:0;padding-left:18px;color:#92400e;font-size:13px;">
             ${reviewFlags.map((f) => `<li>${f}</li>`).join("")}
           </ul>
         </div>`
      : ""

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9fafb;padding:20px;border-radius:10px;">
        <h2 style="color:#047857;margin:0 0 8px;">New Vaccine Consent Submission</h2>
        <p style="margin:0 0 4px;"><b>Name:</b> ${safe(form.firstName)} ${safe(form.lastName)}</p>
        <p style="margin:0 0 4px;"><b>DOB:</b> ${safe(form.dob)} (age ${safe(form.age) || "—"})</p>
        <p style="margin:0 0 4px;"><b>Gender:</b> ${safe(form.gender) || "—"}</p>
        <p style="margin:0 0 4px;"><b>Phone:</b> ${safe(form.phone)}</p>
        <p style="margin:0 0 4px;"><b>Email:</b> ${safe(form.email) || "—"}</p>
        <p style="margin:0 0 4px;"><b>Physician:</b> ${safe(form.physicianName) || "—"} (${safe(form.physicianPhone) || "—"})</p>
        <p style="margin:0 0 4px;"><b>Vaccines Requested:</b> ${requestedDisplay || "—"}</p>
        <p style="margin:0 0 4px;"><b>Consent Signed by:</b> ${safe(form.consentName)}</p>
        <p style="margin:0 0 4px;"><b>Date:</b> ${safe(form.consentDate)}</p>
        ${flagsHtml}
        <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
        <p style="font-size:12px;color:#555;margin:0;">Full answers are in the attached PDF. Generated from the online Vaccine Consent Form.</p>
      </div>
    `

    if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY / FROM_EMAIL / TO_EMAIL." },
        { status: 500 }
      )
    }

    const sendResult = await resend.emails.send({
      from: FROM_EMAIL!,
      to: TO_EMAIL!,
      subject: `Vaccine Consent — ${safe(form.firstName)} ${safe(form.lastName)}${
        reviewFlags.length ? " [review]" : ""
      }`,
      html,
      attachments: [
        { filename, content: pdfBuffer, contentType: "application/pdf" },
      ],
    })

    if ("error" in sendResult && sendResult.error) {
      throw new Error(sendResult.error.message)
    }

    // ---- Save to Supabase so admin can view in the dashboard ---------------
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )

        const addressOneLine =
          [form.address, form.city, form.state, form.zip].filter(Boolean).join(", ") || null

        const screening = collectScreeningResponses(form)

        // SSN is collected on the printed form for Medicare billing, but a full
        // SSN in a web-app database is a breach waiting to happen. Only the last
        // four digits are stored; the full value reaches the pharmacy solely
        // through the emailed PDF and is stripped from the archived payload.
        const { ssn: _ssn, ...formWithoutSsn } = form

        const { error: insertErr } = await sb.from("vaccine_submissions").insert({
          record_id: recordId,

          // Section A
          first_name: nullIfBlank(form.firstName),
          last_name: nullIfBlank(form.lastName),
          dob: dateOrNull(form.dob),
          age: nullIfBlank(form.age),
          gender: nullIfBlank(form.gender),
          race: nullIfBlank(form.race),
          ethnicity: nullIfBlank(form.ethnicity),
          phone: nullIfBlank(form.phone),
          email: nullIfBlank(form.email),
          address: addressOneLine,
          city: nullIfBlank(form.city),
          state: nullIfBlank(form.state),
          zip: nullIfBlank(form.zip),
          physician_name: nullIfBlank(form.physicianName),
          physician_phone: nullIfBlank(form.physicianPhone),
          physician_fax: nullIfBlank(form.physicianFax),

          // Vaccines requested
          vaccine_type: nullIfBlank(requestedDisplay),
          vaccines_requested: arrayOrNull(form.vaccinesRequested),
          other_vaccine_text: nullIfBlank(form.otherVaccineText),

          // Screening
          screening_responses: Object.keys(screening).length ? screening : null,
          q18_conditions: arrayOrNull(form.q18Conditions),
          review_flags: reviewFlags.length ? reviewFlags : null,

          // Consent
          consent_name: nullIfBlank(form.consentName),
          consent_date: dateOrNull(form.consentDate),
          consent_agree: !!form.consentAgree,

          // Insurance
          insurance_types: arrayOrNull(form.insuranceTypes),
          insurance_plan_name: nullIfBlank(form.insurancePlanName),
          member_id: nullIfBlank(form.memberId),
          rx_bin: nullIfBlank(form.rxBin),
          rx_pcn: nullIfBlank(form.rxPcn),
          group_no: nullIfBlank(form.groupNo),
          medicare_card_no: nullIfBlank(form.medicareCardNo),
          medicare_id: nullIfBlank(form.medicareId),
          ssn_last4: nullIfBlank(maskSsn(form.ssn)),
          authorize_billing: !!form.authorizeBilling,

          // Clinic use
          vaccine_rows: Array.isArray(form.vaccineRows) && form.vaccineRows.length ? form.vaccineRows : null,
          immunizer_name: nullIfBlank(form.immunizerName),

          status: "pending",
          full_form_data: formWithoutSsn,
        })
        if (insertErr) {
          console.error("Supabase insert error (vaccine):", insertErr.message, insertErr.details)
        }
      }
    } catch (dbErr) {
      console.error("Supabase save error (vaccine):", dbErr)
    }

    // The PDF travels back in the response so the patient can download the
    // exact document that was emailed to the pharmacy. Returning it inline
    // avoids adding an unauthenticated GET endpoint that could be enumerated
    // for other people's submissions.
    return NextResponse.json({
      ok: true,
      message: "Email sent successfully",
      recordId,
      pdf: { filename, base64: pdfBuffer.toString("base64") },
    })
  } catch (e: any) {
    console.error("❌ Vaccine consent error:", e)
    return NextResponse.json({ ok: false, error: e?.message || "Submission failed" }, { status: 500 })
  }
}
