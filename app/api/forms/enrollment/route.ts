// app/api/forms/enrollment/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"
import { createClient } from "@supabase/supabase-js"

// Force Node runtime (needed for fs/path/pdf-lib)
export const runtime = "nodejs"

// -------------- Resend init --------------
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL // e.g. "forms@your-verified-domain.com"
const TO_EMAIL = process.env.TO_EMAIL     // e.g. "care@nfpltc.com"

if (!RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY is not set. Email sending will fail.")
}
if (!FROM_EMAIL) {
  console.warn("⚠️ FROM_EMAIL is not set. Email sending will fail.")
}
if (!TO_EMAIL) {
  console.warn("⚠️ TO_EMAIL is not set. Email sending will fail.")
}

const resend = new Resend(RESEND_API_KEY)

// -------------- HTTP POST handler --------------
export async function POST(req: Request) {
  try {
    const form = await req.json()
    const recordId = `${Date.now()}`

    // Build PDF (logo at top, green subheader, centered heading)
    const pdfBytes = await createStyledPdf(form, recordId)

    // Build HTML
    const html = buildHtmlSummary(form)

    // Validate env before sending
    if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing environment variables. Ensure RESEND_API_KEY, FROM_EMAIL, and TO_EMAIL are configured.",
        },
        { status: 500 }
      )
    }

    // Send via Resend — attach PDF as Buffer
    const sendResult = await resend.emails.send({
      from: FROM_EMAIL!,
      to: TO_EMAIL!,
      subject: `New Enrollment — ${safe(form.firstName)} ${safe(form.lastName)}`,
      html,
      attachments: [
        {
          filename: `Enrollment-${safe(form.lastName) || recordId}.pdf`,
          content: Buffer.from(pdfBytes), // Buffer is supported by Resend
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
        await sb.from("enrollment_submissions").insert({
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          email: form.email || null,
          phone: form.phone || null,
          dob: form.dob || null,
          gender: form.gender || null,
          address: form.homeAddress ? `${form.homeAddress}, ${form.city}, ${form.state} ${form.zip}` : null,
          facility_name: form.facilityName || null,
          physician_name: form.pcpName || null,
          insurance_id: form.rxMemberId || null,
          status: "new",
          raw_data: form,
        })
      }
    } catch (dbErr) { console.error("Supabase save error (enrollment):", dbErr) }

    return NextResponse.json({ ok: true, message: "Email sent successfully" })
  } catch (e: any) {
    console.error("❌ Enrollment email error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Email sending failed" },
      { status: 500 }
    )
  }
}

// -------------- HTML builder --------------
function buildHtmlSummary(form: any) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9fafb;padding:20px;border-radius:10px;">
      <h2 style="color:#047857;margin:0 0 8px;">North Falmouth Pharmacy — New Enrollment</h2>
      <p style="margin:0 0 4px;"><b>Name:</b> ${safe(form.firstName)} ${safe(form.lastName)}</p>
      <p style="margin:0 0 4px;"><b>DOB:</b> ${safe(form.dob)}</p>
      <p style="margin:0 0 4px;"><b>Gender:</b> ${safe(form.gender)}</p>
      <p style="margin:0 0 4px;"><b>Address:</b> ${safe(form.homeAddress)}, ${safe(form.city)}, ${safe(form.state)} ${safe(form.zip)}</p>
      <p style="margin:0 0 4px;"><b>Physician:</b> ${safe(form.pcpName) || "—"} (${safe(form.pcpPhone) || "—"})</p>
      <p style="margin:0 0 4px;"><b>Insurance Member ID:</b> ${safe(form.rxMemberId) || "—"}</p>
      <p style="margin:0 0 4px;"><b>Authorized by:</b> ${safe(form.authName) || "—"} (${form.authAgree ? "Agreed" : "Not agreed"})</p>
      <p style="margin:0 0 16px;"><b>Date:</b> ${safe(form.authDate) || "—"}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#555;margin:0;">This email was generated from the Enrollment Form submission on your website.</p>
    </div>
  `
}
function safe(v: any) {
  if (v === null || v === undefined) return ""
  return String(v)
}

// -------------- PDF builder --------------
async function createStyledPdf(form: any, id: string) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 900]) // portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0.07, 0.45, 0.33)

  // ---- Header: Logo at top (graceful fallback if missing) ----
  const { logo, width: logoW, height: logoH } = await embedLogo(pdf)

  if (logo) {
    const targetW = 170
    const scale = targetW / logoW
    const targetH = logoH * scale
    page.drawImage(logo, {
      x: 40,
      y: 900 - 20 - targetH,
      width: targetW,
      height: targetH,
    })
  } else {
    // If logo missing, show text brand on top-left
    page.drawText("North Falmouth Pharmacy", {
      x: 40,
      y: 900 - 32,
      size: 16,
      font: bold,
      color: green,
    })
  }

  // ---- Green subheader bar below logo with centered title ----
  const heading = "Customer Enrollment Summary"
  const barH = 36
  const topY = logo ? 900 - 20 - (170 * (await logoAspect(pdf)).height / (await logoAspect(pdf)).width) : 900 - 36
  const barY = topY - 14 - barH

  page.drawRectangle({ x: 0, y: barY, width: 612, height: barH, color: green })

  const headingSize = 13
  const headingWidth = bold.widthOfTextAtSize(heading, headingSize)
  const headingX = (612 - headingWidth) / 2
  const headingY = barY + (barH - headingSize) / 2 + 3
  page.drawText(heading, { x: headingX, y: headingY, size: headingSize, font: bold, color: rgb(1, 1, 1) })

  // ---- Content start
  let y = barY - 28

  const newPage = () => {
    // footer
    page.drawLine({ start: { x: 40, y: 50 }, end: { x: 570, y: 50 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    page.drawText("— Continued on next page —", { x: 230, y: 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

    page = pdf.addPage([612, 900])

    // repeat mini subheader on next pages (optional)
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
    page.drawRectangle({ x: 40, y: y - 4, width: 530, height: 22, color: rgb(0.9, 0.97, 0.94) })
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
  page.drawText(`Record ID: ${id}`, { x: 40, y, size: 10, font }); y -= 13
  page.drawText(`Submitted: ${new Date().toLocaleString()}`, { x: 40, y, size: 10, font }); y -= 20

  // START INFO
  block("Start Information")
  line("Today's Date", form.todaysDate)
  line("Start Date", form.startDate)
  line("Start Time", `${form.startTime} ${form.startTimePeriod}`)

  // RESIDENT INFO
  block("Resident Information")
  line("Full Name", `${form.firstName} ${form.middleInitial || ""} ${form.lastName}`)
  line("DOB", form.dob)
  line("Gender", form.gender)
  line("SSN", form.ssn)
  line("Address", `${form.homeAddress}, ${form.city}, ${form.state}, ${form.zip}`)
  line("Allergies", form.allergies)

  // FACILITY
  block("Facility Information")
  line("Facility Name", form.facilityName)
  line("Room Number", form.roomNumber)
  line("Facility Address", `${form.facilityAddress}, ${form.facilityCity}, ${form.facilityState}, ${form.facilityZip}`)
  line("Moving From", form.movingFrom)
  line("Hospital/Rehab Name", form.hospitalRehabName)
  line("Hospital/Rehab Phone", form.hospitalRehabPhone)

  // PCP
  block("Primary Care Provider (PCP)")
  line("Physician Name", form.pcpName)
  line("Specialty", form.pcpSpecialty)
  line("Address", form.pcpAddress)
  line("Phone", form.pcpPhone)
  line("Fax", form.pcpFax)

  // BILLING
  block("Billing & Insurance")
  line("RX Member ID", form.rxMemberId)
  line("RXGRP", form.rxGrp)
  line("RXBIN", form.rxBin)
  line("RXPCN", form.rxPcn)
  line("Card Type", form.cardType)
  line("Card Number", form.cardNumber)
  line("Exp. Month", form.cardExpMonth)
  line("Exp. Year", form.cardExpYear)
  line("CVV", form.cardCvv)
  line("Cardholder Name", form.cardholderName)
  line("Billing Address", `${form.billingAddress}, ${form.billingCity}, ${form.billingState}, ${form.billingZip}`)
  line("Additional Contact", `${form.additionalContactName || "-"} (${form.additionalContactPhone || "-"})`)

  // AUTH
  block("Authorization & Signature")
  line("Authorized Name", form.authName)
  line("Date", form.authDate)
  line("Agreed", form.authAgree ? "Yes" : "No")

  // Footer final
  page.drawLine({ start: { x: 40, y: 50 }, end: { x: 570, y: 50 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  page.drawText("Generated by North Falmouth Pharmacy | " + new Date().toLocaleString(), {
    x: 40,
    y: 35,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  return await pdf.save()
}

// -------------- Logo helpers --------------
async function embedLogo(pdf: PDFDocument): Promise<{ logo: any; width: number; height: number }> {
  try {
    // Put a real file here: e.g. /public/logowhite.png (PNG/JPG)
    const logoPath = path.join(process.cwd(), "public", "logo.svg")
    const bytes = await readFile(logoPath)
    if (logoPath.toLowerCase().endsWith(".png")) {
      const png = await pdf.embedPng(bytes)
      return { logo: png, width: png.width, height: png.height }
    } else {
      const jpg = await pdf.embedJpg(bytes)
      return { logo: jpg, width: jpg.width, height: jpg.height }
    }
  } catch {
    // Silent fallback if logo not found
    return { logo: null, width: 0, height: 0 }
  }
}

// Helps compute aspect if you want to use the original logo ratio in layout
async function logoAspect(_pdf: PDFDocument) {
  // Swap constants if you use a different logo
  // These are only used to compute the top offsets when drawing
  return { width: 170, height: 50 } // approximate aspect; not used when logo missing
}
