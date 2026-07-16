// app/api/forms/enrollment/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { sendFormConfirmation } from "@/lib/form-confirmation-email"

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

    // Save to Supabase so admin can view in dashboard.
    // Note: full credit card number + CVV are intentionally NOT saved.
    // SSN is truncated to last 4 (table column is ssn_last4).
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

        // Defensive: take only last 4 digits of SSN even if more was submitted
        const ssnLast4 = String(form.ssn || "").replace(/\D/g, "").slice(-4) || null

        // Build card_exp as "MM/YY" if both parts present (do not store full number or CVV)
        const cardExp = form.cardExpMonth && form.cardExpYear
          ? `${String(form.cardExpMonth).padStart(2, "0")}/${String(form.cardExpYear).slice(-2)}`
          : null
        const cardLast4 = String(form.cardNumber || "").replace(/\D/g, "").slice(-4) || null

        const { error: insertErr } = await sb.from("enrollment_submissions").insert({
          // Start info
          todays_date: form.todaysDate || null,
          start_date: form.startDate || null,
          start_time: form.startTime ? `${form.startTime} ${form.startTimePeriod || ""}`.trim() : null,

          // Submitter (if your form collects it; safe to send null)
          submitter_relation: form.submitterRelation || null,
          submitter_first_name: form.submitterFirstName || null,
          submitter_last_name: form.submitterLastName || null,
          submitter_phone: form.submitterPhone || null,
          submitter_email: form.submitterEmail || null,

          // Resident
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          middle_initial: form.middleInitial || null,
          dob: form.dob || null,
          ssn_last4: ssnLast4,
          gender: form.gender || null,
          home_address: form.homeAddress || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          allergies: form.allergies || null,

          // Facility
          facility_name: form.facilityName || null,
          room_number: form.roomNumber || null,
          facility_address: form.facilityAddress || null,
          facility_city: form.facilityCity || null,
          facility_state: form.facilityState || null,
          facility_zip: form.facilityZip || null,
          moving_from: form.movingFrom || null,
          hospital_rehab_name: form.hospitalRehabName || null,
          hospital_rehab_phone: form.hospitalRehabPhone || null,

          // PCP
          pcp_name: form.pcpName || null,
          pcp_specialty: form.pcpSpecialty || null,
          pcp_address: form.pcpAddress || null,
          pcp_phone: form.pcpPhone || null,
          pcp_fax: form.pcpFax || null,

          // Insurance
          rx_member_id: form.rxMemberId || null,
          rx_grp: form.rxGrp || null,
          rx_bin: form.rxBin || null,
          rx_pcn: form.rxPcn || null,

          // Card (safe fields only — NO full number, NO CVV)
          card_type: form.cardType || null,
          card_last4: cardLast4,
          card_exp: cardExp,
          cardholder_name: form.cardholderName || null,
          billing_address: form.billingAddress || null,
          billing_city: form.billingCity || null,
          billing_state: form.billingState || null,
          billing_zip: form.billingZip || null,

          // Additional contact
          additional_contact_name: form.additionalContactName || null,
          additional_contact_phone: form.additionalContactPhone || null,

          // Authorization
          auth_name: form.authName || null,
          auth_date: form.authDate || null,

          status: "new",
        })
        if (insertErr) {
          console.error("Supabase insert error (enrollment):", insertErr.message, insertErr.details)
        }
      }
    } catch (dbErr) { console.error("Supabase save error (enrollment):", dbErr) }

    // Confirmation to the person who submitted (non-fatal — never blocks submission).
    await sendFormConfirmation({
      to: form.submitterEmail || form.email,
      firstName: form.submitterFirstName || form.firstName,
      formName: "enrollment form",
    })

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
      <p style="margin:0 0 4px;"><b>Submitted by:</b> ${safe(form.submitterRelation) || "—"}${(form.submitterFirstName || form.submitterLastName) ? ` — ${safe(form.submitterFirstName)} ${safe(form.submitterLastName)}`.trimEnd() : ""}</p>
      <p style="margin:0 0 4px;"><b>Email:</b> ${safe(form.submitterEmail) || safe(form.email) || "—"}</p>
      <p style="margin:0 0 4px;"><b>Phone:</b> ${safe(form.submitterPhone) || "—"}</p>
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

  // Word-wrap a string to a maximum pixel width using the given font/size.
  // Returns an array of lines that all fit within `maxWidth`.
  const wrapText = (text: string, theFont: typeof font, size: number, maxWidth: number): string[] => {
    const s = String(text ?? "-")
    if (!s) return ["-"]
    const words = s.split(/\s+/)
    const lines: string[] = []
    let current = ""
    for (const word of words) {
      const candidate = current ? current + " " + word : word
      const w = theFont.widthOfTextAtSize(candidate, size)
      if (w <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        // Single word longer than maxWidth — force-break by characters
        if (theFont.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = ""
          for (const ch of word) {
            if (theFont.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              if (chunk) lines.push(chunk)
              chunk = ch
            } else {
              chunk += ch
            }
          }
          current = chunk
        } else {
          current = word
        }
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ["-"]
  }

  // Layout constants for the value column
  const LABEL_X = 50
  const VALUE_X = 180
  const PAGE_RIGHT_MARGIN = 40
  const VALUE_MAX_WIDTH = 612 - VALUE_X - PAGE_RIGHT_MARGIN  // ~392 pt
  const ROW_LINE_HEIGHT = 13                                 // spacing between wrapped lines
  const ROW_GAP_BEFORE = 14                                  // gap above each row

  // Draws a label + value, wrapping the value across multiple lines if needed.
  // Reserves enough vertical space for ALL the wrapped lines and starts a new
  // page if the row wouldn't fit on the current one.
  const line = (label: string, value: any) => {
    const text = (value === null || value === undefined || value === "") ? "-" : String(value)
    const wrapped = wrapText(text, font, 10, VALUE_MAX_WIDTH)
    const rowHeight = ROW_GAP_BEFORE + (wrapped.length - 1) * ROW_LINE_HEIGHT

    // Will the row fit on the current page? If not, start a new one.
    if (y - rowHeight < 60) newPage()

    y -= ROW_GAP_BEFORE
    page.drawText(`${label}:`, { x: LABEL_X, y, size: 10, font: bold })
    page.drawText(wrapped[0], { x: VALUE_X, y, size: 10, font })
    for (let i = 1; i < wrapped.length; i++) {
      y -= ROW_LINE_HEIGHT
      page.drawText(wrapped[i], { x: VALUE_X, y, size: 10, font })
    }
  }

  // Meta
  page.drawText(`Record ID: ${id}`, { x: 40, y, size: 10, font }); y -= 13
  page.drawText(`Submitted: ${new Date().toLocaleString()}`, { x: 40, y, size: 10, font }); y -= 20

  // START INFO
  block("Start Information")
  line("Today's Date", form.todaysDate)
  line("Start Date", form.startDate)
  line("Start Time", `${form.startTime} ${form.startTimePeriod}`)

  // SUBMITTER / CONTACT (email is always collected on the form)
  block("Submitter Information")
  line("Relation to Resident", form.submitterRelation)
  line("Submitter Name", `${form.submitterFirstName || ""} ${form.submitterLastName || ""}`.trim())
  line("Submitter Phone", form.submitterPhone)
  line("Email", form.submitterEmail || form.email)

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
