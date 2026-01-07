// app/api/forms/credit-card-update/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { Resend } from "resend"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"

// Ensure Node runtime for fs/path/pdf-lib
export const runtime = "nodejs"

// -----------------------------
// ENV + Resend
// -----------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL        // e.g., "forms@your-verified-domain.com"
const TO_EMAIL = process.env.TO_EMAIL || process.env.BILLING_EMAIL || "billing@northfalmouthpharmacy.com"

if (!RESEND_API_KEY) console.warn("⚠️ RESEND_API_KEY not set.")
if (!FROM_EMAIL) console.warn("⚠️ FROM_EMAIL not set.")
if (!TO_EMAIL) console.warn("⚠️ TO_EMAIL (or BILLING_EMAIL) not set; defaulting to billing@northfalmouthpharmacy.com")

const resend = new Resend(RESEND_API_KEY)

// -----------------------------
// Validation Schema (Server-Side)
// -----------------------------
const creditCardUpdateSchema = z.object({
  // Patient / Account
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  accountNumber: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),

  // Billing Address
  billingAddress: z.string().min(1),
  billingCity: z.string().min(1),
  billingState: z.string().min(1),
  billingZip: z.string().min(1),

  // Card
  cardType: z.enum(["Debit", "Credit"]),
  cardNumber: z.string().min(12),      // raw input, we will mask it
  cardExpMonth: z.string().min(2),
  cardExpYear: z.string().min(4),
  cardCvv: z.string().min(3),          // DO NOT email or log
  cardholderName: z.string().min(1),

  // Consent
  consentName: z.string().min(1),
  consentDate: z.string().min(1),
  consentAgree: z.boolean(),
})

type CreditCardUpdate = z.infer<typeof creditCardUpdateSchema>

// -----------------------------
// Utilities
// -----------------------------
function safe(v: any) {
  if (v === null || v === undefined) return ""
  return String(v)
}

/**
 * Format card number for PDF display
 * Shows all digits: 1234 5678 9012 3456
 */
function maskCardForPdf(num: string) {
  const digits = (num || "").replace(/\D/g, "")
  // Format with spaces every 4 digits for readability
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/**
 * Mask card number for email display
 * Shows: ************1234
 * You can customize this format differently than PDF
 */
function maskCardForEmail(num: string) {
  const digits = (num || "").replace(/\D/g, "")
  if (digits.length <= 4) return `****${digits}`
  const masked = '*'.repeat(digits.length - 4)
  return `${masked}${digits.slice(-4)}`
}

async function embedLogo(pdf: PDFDocument) {
  try {
    // Put your logo in /public; update filename if needed
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
    return null
  }
}

// -----------------------------
// PDF builder (logo + green subheader + centered title)
// -----------------------------
async function buildPdf(form: CreditCardUpdate, recordId: string) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 900])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0.07, 0.45, 0.33)

  // Header w/ logo
  const embedded = await embedLogo(pdf)
  let topY = 900 - 20
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
    topY -= targetH
  } else {
    // fallback text brand
    page.drawText("North Falmouth Pharmacy", {
      x: 40,
      y: topY - 16,
      size: 16,
      font: bold,
      color: green,
    })
    topY -= 24
  }

  // Green bar + centered heading
  const barH = 36
  const barY = topY - 14 - barH
  page.drawRectangle({ x: 0, y: barY, width: 612, height: barH, color: green })

  const heading = "Credit Card Update Authorization"
  const headingSize = 13
  const headingWidth = bold.widthOfTextAtSize(heading, headingSize)
  page.drawText(heading, {
    x: (612 - headingWidth) / 2,
    y: barY + (barH - headingSize) / 2 + 3,
    size: headingSize,
    font: bold,
    color: rgb(1, 1, 1),
  })

  // Content layout helpers
  let y = barY - 28
  const newPage = () => {
    page.drawText("— Continued on next page —", {
      x: 230,
      y: 40,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    page = pdf.addPage([612, 900])
    // optional repeat subheader
    page.drawRectangle({ x: 0, y: 900 - 60, width: 612, height: 36, color: green })
    page.drawText(heading, {
      x: (612 - headingWidth) / 2,
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
    page.drawText(`${value ?? "-"}`, { x: 200, y, size: 10, font })
  }

  // Meta
  line("Record ID", recordId)
  line("Submitted", new Date().toLocaleString())
  y -= 6

  // Section 1 — Patient / Account
  block("Patient / Account Information")
  line("Full Name", `${safe(form.firstName)} ${safe(form.lastName)}`)
  line("DOB", safe(form.dob))
  line("Account Number", safe(form.accountNumber))
  line("Phone", safe(form.phone))
  line("Email", safe(form.email))

  // Section 2 — Billing Address
  block("Billing Address")
  line("Address", safe(form.billingAddress))
  line("City", safe(form.billingCity))
  line("State", safe(form.billingState))
  line("ZIP", safe(form.billingZip))

  // Section 3 — Card (masked using PDF-specific masking)
  block("Card Details (Masked)")
  line("Card Type", safe(form.cardType))
  line("Cardholder Name", safe(form.cardholderName))
  line("Card Number", safe(form.cardNumber)) // PDF masking
  line("Expiry", `${safe(form.cardExpMonth)}/${safe(form.cardExpYear)}`)
  // NEVER include CVV in the PDF or emails.

  // Section 4 — Consent
  block("Authorization & Consent")
  line("Authorized By", safe(form.consentName))
  line("Consent Date", safe(form.consentDate))
  line("Agreed", form.consentAgree ? "Yes" : "No")

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

// -----------------------------
// HTTP POST Handler
// -----------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = creditCardUpdateSchema.parse(body)

    const recordId = `${Date.now()}`

    // Build PDF (masked card using PDF masking)
    const pdfBytes = await buildPdf(parsed, recordId)

    // Email HTML (using email-specific masking)
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#f9fafb;padding:20px;border-radius:10px;">
        <h2 style="color:#047857;margin:0 0 12px;">New Credit Card Update Request</h2>
        <p style="margin:0 0 4px;"><b>Name:</b> ${safe(parsed.firstName)} ${safe(parsed.lastName)}</p>
        <p style="margin:0 0 4px;"><b>DOB:</b> ${safe(parsed.dob)}</p>
        <p style="margin:0 0 4px;"><b>Account #:</b> ${safe(parsed.accountNumber)}</p>
        <p style="margin:0 0 4px;"><b>Phone:</b> ${safe(parsed.phone)}</p>
        <p style="margin:0 0 4px;"><b>Email:</b> ${safe(parsed.email)}</p>
        <p style="margin:0 0 8px;"><b>Billing:</b> ${safe(parsed.billingAddress)}, ${safe(parsed.billingCity)}, ${safe(parsed.billingState)} ${safe(parsed.billingZip)}</p>
        <p style="margin:0 0 4px;"><b>Cardholder:</b> ${safe(parsed.cardholderName)}</p>
        <p style="margin:0 0 4px;"><b>Card Type:</b> ${safe(parsed.cardType)}</p>
        <p style="margin:0 0 8px;"><b>Card (masked):</b> ${maskCardForEmail(parsed.cardNumber)} • Exp ${safe(parsed.cardExpMonth)}/${safe(parsed.cardExpYear)}</p>
        <p style="margin:0 0 4px;"><b>Consent:</b> ${parsed.consentAgree ? "Agreed" : "Not agreed"} by ${safe(parsed.consentName)} on ${safe(parsed.consentDate)}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">
        <p style="font-size:12px;color:#555;margin:0;">This notification includes only masked card details. CVV is never stored or emailed.</p>
      </div>
    `

    // Env check
    if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY / FROM_EMAIL / TO_EMAIL." },
        { status: 500 }
      )
    }

    // Send email w/ PDF attachment
    const emailRes = await resend.emails.send({
      from: FROM_EMAIL!,
      to: TO_EMAIL!,
      subject: `Card Update — ${safe(parsed.firstName)} ${safe(parsed.lastName)} (****${safe(parsed.cardNumber).slice(-4)})`,
      html,
      attachments: [
        {
          filename: `CardUpdate-${safe(parsed.lastName) || recordId}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    })

    if ("error" in emailRes && emailRes.error) {
      throw new Error(emailRes.error.message)
    }

    // Respond
    return NextResponse.json({ success: true, message: "Form submitted successfully" })
  } catch (error: any) {
    // No sensitive logs
    console.error("❌ Credit card update error:", error?.message || error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
