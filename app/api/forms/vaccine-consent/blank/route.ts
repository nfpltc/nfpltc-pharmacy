// app/api/forms/vaccine-consent/blank/route.ts
//
// GET /api/forms/vaccine-consent/blank — a blank, printable Vaccine Consent
// form. Unlike the admin download this carries NO patient data (it renders an
// empty form with write-in lines and checkboxes), so it is intentionally
// public: a visitor can print it, fill it in by pen, and bring it to the
// pharmacy. Same builder as the submitted PDF, so paper and screen never drift.

import { NextResponse } from "next/server"
import { createConsentPdf } from "@/lib/vaccine-consent-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const pdfBytes = await createConsentPdf({}, "BLANK", { blank: true })
    return new NextResponse(Buffer.from(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="NFP-Vaccine-Consent-Form.pdf"',
        // No PHI in a blank form, so it is safe to cache.
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err: any) {
    console.error("❌ Blank vaccine form error:", err)
    return NextResponse.json({ error: "Failed to build the blank form" }, { status: 500 })
  }
}
