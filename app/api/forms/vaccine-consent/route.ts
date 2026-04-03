// app/api/forms/vaccine-consent/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"
import { createClient } from "@supabase/supabase-js"

// Ensure Node.js runtime so fs/path/pdf-lib work in App Router
export const runtime = "nodejs"

// -----------------------------
// Resend + ENV
// -----------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL // e.g. "forms@your-verified-domain.com"
const TO_EMAIL = process.env.TO_EMAIL     // e.g. "care@nfpltc.com"

if (!RESEND_API_KEY) console.warn("⚠️ RESEND_API_KEY is not set.")
if (!FROM_EMAIL) console.warn("⚠️ FROM_EMAIL is not set.")
if (!TO_EMAIL) console.warn("⚠️ TO_EMAIL is not set.")

const resend = new Resend(RESEND_API_KEY)

// -----------------------------
// POST
// -----------------------------
export async function POST(req: Request) {
  try {
    const form = await req.json()
    const recordId = `${Date.now()}`

    // Create PDF with logo + green bar + centered heading
    const pdfBytes = await createConsentPdf(form, recordId)

    // Build simple HTML summary
    const chosenVaccines =
      form?.vaccines
        ? Object.keys(form.vaccines)
            .filter((k) => form.vaccines[k])
            .map((k) => String(k).toUpperCase())
            .join(", ")
        : ""

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9fafb;padding:20px;border-radius:10px;">
        <h2 style="color:#047857;margin:0 0 8px;">New Vaccine Consent Submission</h2>
        <p style="margin:0 0 4px;"><b>Name:</b> ${safe(form.firstName)} ${safe(form.lastName)}</p>
        <p style="margin:0 0 4px;"><b>DOB:</b> ${safe(form.dob)}</p>
        <p style="margin:0 0 4px;"><b>Gender:</b> ${safe(form.gender)}</p>
        <p style="margin:0 0 4px;"><b>Phone:</b> ${safe(form.phone)}</p>
        <p style="margin:0 0 4px;"><b>Email:</b> ${safe(form.email)}</p>
        <p style="margin:0 0 4px;"><b>Physician:</b> ${safe(form.physicianName) || "—"} (${safe(form.physicianPhone) || "—"})</p>
        <p style="margin:0 0 4px;"><b>Vaccines Selected:</b> ${chosenVaccines || "—"}</p>
        <p style="margin:0 0 4px;"><b>Consent Signed by:</b> ${safe(form.consentName)}</p>
        <p style="margin:0 0 4px;"><b>Date:</b> ${safe(form.consentDate)}</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
        <p style="font-size:12px;color:#555;margin:0;">This email was generated from the online Vaccine Consent Form.</p>
      </div>
    `

    // Validate env
    if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY / FROM_EMAIL / TO_EMAIL." },
        { status: 500 }
      )
    }

    // Send email with PDF attachment (Buffer)
    const sendResult = await resend.emails.send({
      from: FROM_EMAIL!,
      to: TO_EMAIL!,
      subject: `Vaccine Consent — ${safe(form.firstName)} ${safe(form.lastName)}`,
      html,
      attachments: [
        {
          filename: `VaccineConsent-${safe(form.lastName) || recordId}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    })

    if ("error" in sendResult && sendResult.error) {
      throw new Error(sendResult.error.message)
    }

    // Save to Supabase so admin can view in dashboard
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
        const selectedVaccines = form?.vaccines ? Object.keys(form.vaccines).filter((k: string) => form.vaccines[k]).join(", ") : ""
        await sb.from("vaccine_submissions").insert({
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          email: form.email || null,
          phone: form.phone || null,
          dob: form.dob || null,
          gender: form.gender || null,
          physician_name: form.physicianName || null,
          vaccines_selected: selectedVaccines,
          consent_name: form.consentName || null,
          consent_date: form.consentDate || null,
          status: "new",
          raw_data: form,
        })
      }
    } catch (dbErr) { console.error("Supabase save error (vaccine):", dbErr) }

    return NextResponse.json({ ok: true, message: "Email sent successfully" })
  } catch (e: any) {
    console.error("❌ Vaccine consent error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Submission failed" },
      { status: 500 }
    )
  }
}

// -----------------------------
// Helpers
// -----------------------------
function safe(v: any) {
  if (v === null || v === undefined) return ""
  return String(v)
}

async function embedLogo(pdf: PDFDocument): Promise<{ node: any; width: number; height: number } | null> {
  try {
    // Put your logo (PNG/JPG) in /public and set the filename here:
    const logoPath = path.join(process.cwd(), "public", "logo.svg")
    const bytes = await readFile(logoPath)
    if (logoPath.toLowerCase().endsWith(".png")) {
      const png = await pdf.embedPng(bytes)
      return { node: png, width: png.width, height: png.height }
    } else {
      const jpg = await pdf.embedJpg(bytes)
      return { node: jpg, width: jpg.width, height: jpg.height }
    }
  } catch {
    // Silent fallback if logo missing
    return null
  }
}

// -----------------------------
// PDF builder with logo + green bar + centered title
// -----------------------------
async function createConsentPdf(form: any, id: string) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 900])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0.07, 0.45, 0.33)

  // Header: logo at the very top-left
  const embedded = await embedLogo(pdf)
  let topY = 900 - 20 // 20pt padding

  if (embedded?.node) {
    const targetW = 170
    const scale = targetW / embedded.width
    const targetH = embedded.height * scale
    page.drawImage(embedded.node, {
      x: 40,
      y: topY - targetH,
      width: targetW,
      height: targetH,
    })
    topY = topY - targetH // update topY to bottom of logo
  } else {
    // fallback heading text if logo is missing
    page.drawText("North Falmouth Pharmacy", {
      x: 40,
      y: topY - 16,
      size: 16,
      font: bold,
      color: green,
    })
    topY = topY - 24
  }

  // Green subheader bar below logo with centered title
  const barHeight = 36
  const barGap = 14
  const barY = topY - barGap - barHeight
  page.drawRectangle({ x: 0, y: barY, width: 612, height: barHeight, color: green })

  const heading = "Vaccine Administration Consent Summary"
  const headingSize = 13
  const headingWidth = bold.widthOfTextAtSize(heading, headingSize)
  const headingX = (612 - headingWidth) / 2
  const headingY = barY + (barHeight - headingSize) / 2 + 3
  page.drawText(heading, {
    x: headingX,
    y: headingY,
    size: headingSize,
    font: bold,
    color: rgb(1, 1, 1),
  })

  // Content start y
  let y = barY - 28

  const newPage = () => {
    // Footer continued note
    page.drawText("— Continued on next page —", {
      x: 230,
      y: 40,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    // New page
    page = pdf.addPage([612, 900])
    // Optional: mini subheader on subsequent pages
    page.drawRectangle({ x: 0, y: 900 - 60, width: 612, height: 36, color: green })
    const w = bold.widthOfTextAtSize(heading, headingSize)
    page.drawText(heading, {
      x: (612 - w) / 2,
      y: 900 - 60 + (36 - headingSize) / 2 + 3,
      size: headingSize,
      font: bold,
      color: rgb(1, 1, 1),
    })
    y = 900 - 60 - 28
  }

  const block = (title: string) => {
    y -= 25
    if (y < 80) newPage()
    page.drawRectangle({
      x: 40,
      y: y - 4,
      width: 530,
      height: 22,
      color: rgb(0.9, 0.97, 0.94),
    })
    page.drawText(title, { x: 50, y, size: 12, font: bold, color: green })
    y -= 10
  }

  const line = (label: string, value: any) => {
    y -= 14
    if (y < 60) newPage()
    page.drawText(`${label}:`, { x: 50, y, size: 10, font: bold })
    page.drawText(`${value ?? "-"}`, { x: 180, y, size: 10, font })
  }

  // Meta
  line("Record ID", id)
  line("Submitted", new Date().toLocaleString())
  y -= 6

  // Section A — Patient Information
  block("Section A — Patient Information")
  line("Name", `${safe(form.firstName)} ${safe(form.lastName)}`)
  line("DOB", safe(form.dob))
  line("Age", safe(form.age))
  line("Gender", safe(form.gender))
  line("Race", safe(form.race))
  line("Ethnicity", safe(form.ethnicity))
  line("Address", `${safe(form.address)}, ${safe(form.city)}, ${safe(form.state)} ${safe(form.zip)}`)
  line("Email", safe(form.email))
  line("Phone", safe(form.phone))
  line("Physician", safe(form.physicianName))
  line("Physician Phone", safe(form.physicianPhone))
  line("Physician Fax", safe(form.physicianFax))

  // Vaccines Selected
  block("Vaccines Selected")
  const selectedList =
    form?.vaccines
      ? Object.entries(form.vaccines)
          .filter(([_, v]: [string, any]) => v === true)
          .map(([k]) => String(k).toUpperCase())
      : []
  line("Selected", selectedList.join(", ") || "None")
  if (form?.vaccines?.otherText) line("Other", safe(form.vaccines.otherText))

  // Section B — General Screening
  block("Section B — General Screening")
  line("1. Feel Sick?", safe(form.q1_feelSick))
  line("2. Health Conditions?", safe(form.q2_conditions))
  line("3. Allergies?", safe(form.q3_allergies))
  line("4. Reaction After Immunization?", safe(form.q4_reactionAfterImmunization))
  line("5. Neurological / GBS?", safe(form.q5_neuroGBS))
  line("6. Immunocompromised?", safe(form.q6_immunocompromised))
  line("7. Pregnant / Planning?", safe(form.q7_pregnant))

  // Section C — COVID-19 Screening
  block("Section C — COVID-19 Screening")
  line("1. Received Dose Before?", safe(form.c1_receivedDose))
  line("2. Allergy to PEG/Polysorbate?", safe(form.c2_allergyPEGPolysorbate))
  line("3. Other Applies?", safe(form.c3_otherApplies))
  line("Details", safe(form.c3_otherDetails))

  // Section D — Consent
  block("Section D — Consent")
  line("Consent Name", safe(form.consentName))
  line("Consent Date", safe(form.consentDate))
  line("Agreed", form?.consentAgree ? "Yes" : "No")

  // Insurance
  block("Insurance Information")
  line("Type", safe(form.insuranceType))
  line("Medicare No.", safe(form.medicareNumber))
  line("Insurance Agree", form?.insuranceAgree ? "Yes" : "No")

  // Vaccine Admin Rows
  if (Array.isArray(form?.vaccineRows) && form.vaccineRows.length > 0) {
    block("Vaccine Administration Details")
    form.vaccineRows.forEach((row: any, i: number) => {
      y -= 10
      page.drawText(`Row ${i + 1}`, { x: 50, y, size: 10, font: bold, color: green })
      y -= 12
      line("Vaccine", safe(row.vaccine))
      line("Manufacturer", safe(row.manufacturer))
      line("Admin Date", safe(row.adminDate))
      line("Lot No.", safe(row.lotNo))
      line("Exp Date", safe(row.expDate))
      line("Dosage", safe(row.dosage))
    })
  }

  // Footer
  page.drawLine({
    start: { x: 40, y: 50 },
    end: { x: 570, y: 50 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  page.drawText("Generated by North Falmouth Pharmacy | " + new Date().toLocaleString(), {
    x: 40,
    y: 35,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  return await pdf.save()
}
