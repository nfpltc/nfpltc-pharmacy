// lib/vaccine-consent-pdf.ts
//
// Builds the PDF summary of a Vaccine Administration Consent submission.
//
// Extracted out of app/api/forms/vaccine-consent/route.ts so the same builder
// serves three callers: the submission email, the patient's "Download PDF"
// button, and the admin dashboard download. One builder means the patient and
// the pharmacy can never end up looking at differently-shaped documents.

import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"
import {
  ADMIN_TABLE_COLUMNS,
  ADMIN_TABLE_ROWS,
  COVID_SCREENING,
  GENERAL_SCREENING,
  LIVE_VACCINE_SCREENING,
  Q17_FOOTNOTE,
  Q18_CONDITIONS,
  VACCINE_OPTIONS,
  type ScreeningQuestion,
} from "./vaccine-consent-form"

const PAGE_W = 612
const PAGE_H = 900
const MARGIN = 40
const GREEN = rgb(0.07, 0.45, 0.33)
const HEADING = "Vaccine Administration Consent Form"

function safe(v: any): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

/**
 * pdf-lib's standard fonts are WinAnsi-encoded and *throw* on any character
 * outside that set. The consent questions contain "Guillain-Barré" and
 * "Humira™", and patients paste all sorts of things into the free-text
 * fields, so every string is scrubbed before it reaches drawText.
 */
function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E¡-ÿ™€]/g, "")
}

/** Redact all but the last four digits of a Social Security Number. */
export function maskSsn(ssn: any): string {
  const digits = safe(ssn).replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length <= 4) return `***-**-${digits}`
  return `***-**-${digits.slice(-4)}`
}

async function embedLogo(pdf: PDFDocument) {
  // The site logo is an SVG, which pdf-lib cannot embed. Prefer a raster logo if
  // one is present, else fall back to a text wordmark. Each path is written as a
  // literal (not a loop variable) so Next's file tracer includes exactly these
  // files instead of globbing all of /public into the function bundle.
  try {
    const img = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo.png")))
    return { node: img, width: img.width, height: img.height }
  } catch { /* try next candidate */ }
  try {
    const img = await pdf.embedJpg(await readFile(path.join(process.cwd(), "public", "logo.jpg")))
    return { node: img, width: img.width, height: img.height }
  } catch { /* try next candidate */ }
  try {
    const img = await pdf.embedJpg(await readFile(path.join(process.cwd(), "public", "logo.jpeg")))
    return { node: img, width: img.width, height: img.height }
  } catch { /* fall through to wordmark */ }
  return null
}

export async function createConsentPdf(
  form: Record<string, any>,
  recordId: string,
  opts: { blank?: boolean } = {},
) {
  // Blank mode prints an empty, fillable form (write-in lines + checkboxes) for
  // patients who prefer to complete it by hand. The same builder is used so the
  // paper and the online form can never drift apart.
  const blank = !!opts.blank
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 20

  // ---- Header: logo (or wordmark) + green title bar -----------------------
  const logo = await embedLogo(pdf)
  if (logo) {
    const targetW = 170
    const targetH = logo.height * (targetW / logo.width)
    page.drawImage(logo.node, { x: MARGIN, y: y - targetH, width: targetW, height: targetH })
    y -= targetH
  } else {
    page.drawText("North Falmouth Pharmacy", {
      x: MARGIN,
      y: y - 16,
      size: 16,
      font: bold,
      color: GREEN,
    })
    y -= 24
  }

  const drawTitleBar = (atY: number) => {
    page.drawRectangle({ x: 0, y: atY, width: PAGE_W, height: 36, color: GREEN })
    const w = bold.widthOfTextAtSize(HEADING, 13)
    page.drawText(HEADING, {
      x: (PAGE_W - w) / 2,
      y: atY + (36 - 13) / 2 + 3,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    })
  }

  const barY = y - 14 - 36
  drawTitleBar(barY)
  y = barY - 28

  const newPage = () => {
    page.drawText("- Continued on next page -", {
      x: 230,
      y: 40,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    page = pdf.addPage([PAGE_W, PAGE_H])
    drawTitleBar(PAGE_H - 60)
    y = PAGE_H - 60 - 28
  }

  /** Word-wrap to a pixel width, hard-breaking words that are too long alone. */
  const wrap = (text: string, theFont: PDFFont, size: number, maxWidth: number): string[] => {
    const s = toWinAnsi(String(text ?? ""))
    if (!s) return [""]
    const lines: string[] = []
    let current = ""
    for (const word of s.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (theFont.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      if (theFont.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = ""
        for (const ch of word) {
          if (theFont.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            if (chunk) lines.push(chunk)
            chunk = ch
          } else chunk += ch
        }
        current = chunk
      } else current = word
    }
    if (current) lines.push(current)
    return lines.length ? lines : [""]
  }

  const block = (title: string) => {
    y -= 25
    if (y < 90) newPage()
    page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_W - MARGIN * 2, height: 22, color: rgb(0.9, 0.97, 0.94) })
    page.drawText(toWinAnsi(title), { x: MARGIN + 10, y, size: 12, font: bold, color: GREEN })
    y -= 10
  }

  const LABEL_X = MARGIN + 10
  const VALUE_X = 200
  const VALUE_W = PAGE_W - VALUE_X - MARGIN

  const line = (label: string, value: any) => {
    if (blank) {
      if (y - 16 < 60) newPage()
      y -= 16
      page.drawText(toWinAnsi(`${label}:`), { x: LABEL_X, y, size: 10, font: bold })
      page.drawLine({ start: { x: VALUE_X, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) })
      return
    }
    const text = value === null || value === undefined || value === "" ? "-" : String(value)
    const wrapped = wrap(text, font, 10, VALUE_W)
    if (y - (14 + (wrapped.length - 1) * 13) < 60) newPage()
    y -= 14
    page.drawText(toWinAnsi(`${label}:`), { x: LABEL_X, y, size: 10, font: bold })
    page.drawText(wrapped[0], { x: VALUE_X, y, size: 10, font })
    for (let i = 1; i < wrapped.length; i++) {
      y -= 13
      page.drawText(wrapped[i], { x: VALUE_X, y, size: 10, font })
    }
  }

  // A small empty checkbox for the printable blank form.
  const checkbox = (x: number, atY: number) => {
    page.drawRectangle({ x, y: atY - 1, width: 9, height: 9, borderColor: rgb(0.45, 0.45, 0.45), borderWidth: 0.8, color: rgb(1, 1, 1) })
  }

  // A checkbox list of options — used in blank mode for the multi-select fields.
  const optionList = (items: readonly string[]) => {
    for (const item of items) {
      const wrapped = wrap(item, font, 9.5, PAGE_W - MARGIN * 2 - 30)
      if (y - wrapped.length * 12 < 60) newPage()
      y -= 14
      checkbox(LABEL_X, y)
      page.drawText(toWinAnsi(wrapped[0]), { x: LABEL_X + 16, y, size: 9.5, font })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(toWinAnsi(wrapped[i]), { x: LABEL_X + 16, y, size: 9.5, font })
      }
    }
  }

  /**
   * Render one screening question: the full question text wrapped across the
   * page with its Yes/No answer right-aligned, matching the paper layout so a
   * pharmacist can check the two side by side.
   */
  const question = (q: ScreeningQuestion) => {
    if (blank) {
      const label = q.note ? `${q.number}. ${q.text} (${q.note})` : `${q.number}. ${q.text}`
      const wrapped = wrap(label, font, 9.5, PAGE_W - MARGIN * 2 - 96)
      if (y - (wrapped.length * 12 + 18) < 60) newPage()
      y -= 14
      page.drawText(wrapped[0], { x: LABEL_X, y, size: 9.5, font })
      checkbox(PAGE_W - MARGIN - 84, y)
      page.drawText("Yes", { x: PAGE_W - MARGIN - 72, y, size: 9, font })
      checkbox(PAGE_W - MARGIN - 40, y)
      page.drawText("No", { x: PAGE_W - MARGIN - 28, y, size: 9, font })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(wrapped[i], { x: LABEL_X, y, size: 9.5, font })
      }
      if (q.detail || q.detailDate) {
        if (y - 13 < 60) newPage()
        y -= 13
        const flabel = q.detailDate ? "If yes, date of last dose:" : "If yes, please list:"
        page.drawText(flabel, { x: LABEL_X + 14, y, size: 8.5, font: italic, color: rgb(0.4, 0.4, 0.4) })
        const fx = LABEL_X + 14 + italic.widthOfTextAtSize(flabel, 8.5) + 6
        page.drawLine({ start: { x: fx, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) })
      }
      return
    }
    const answer = safe(form[q.key]) || "-"
    const label = q.note ? `${q.number}. ${q.text} (${q.note})` : `${q.number}. ${q.text}`
    const wrapped = wrap(label, font, 9.5, PAGE_W - MARGIN * 2 - 60)
    if (y - (wrapped.length * 12 + 6) < 60) newPage()
    y -= 14
    const answerColor = answer === "Yes" ? rgb(0.72, 0.25, 0.05) : rgb(0.2, 0.2, 0.2)
    page.drawText(wrapped[0], { x: LABEL_X, y, size: 9.5, font })
    page.drawText(toWinAnsi(answer), {
      x: PAGE_W - MARGIN - 34,
      y,
      size: 10,
      font: bold,
      color: answerColor,
    })
    for (let i = 1; i < wrapped.length; i++) {
      y -= 12
      page.drawText(wrapped[i], { x: LABEL_X, y, size: 9.5, font })
    }

    const detailKey = q.detail?.key ?? q.detailDate?.key
    const detailValue = detailKey ? safe(form[detailKey]) : ""
    if (detailValue) {
      const detailLabel = q.detailDate ? "Date of last dose" : "Listed"
      for (const l of wrap(`${detailLabel}: ${detailValue}`, italic, 9, PAGE_W - MARGIN * 2 - 80)) {
        if (y - 12 < 60) newPage()
        y -= 12
        page.drawText(l, { x: LABEL_X + 14, y, size: 9, font: italic, color: rgb(0.35, 0.35, 0.35) })
      }
    }
  }

  const bullets = (items: string[]) => {
    if (!items.length) {
      y -= 14
      page.drawText("None selected", { x: LABEL_X, y, size: 10, font, color: rgb(0.45, 0.45, 0.45) })
      return
    }
    for (const item of items) {
      const wrapped = wrap(item, font, 9.5, PAGE_W - MARGIN * 2 - 30)
      if (y - wrapped.length * 12 < 60) newPage()
      y -= 13
      page.drawText("-", { x: LABEL_X, y, size: 9.5, font: bold, color: GREEN })
      page.drawText(wrapped[0], { x: LABEL_X + 12, y, size: 9.5, font })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(wrapped[i], { x: LABEL_X + 12, y, size: 9.5, font })
      }
    }
  }

  // ---- Meta ---------------------------------------------------------------
  if (!blank) {
    line("Record ID", recordId)
    line("Submitted", new Date().toLocaleString())
  }

  // ---- Section A ----------------------------------------------------------
  block("Section A - Patient Information")
  line("Name", `${safe(form.firstName)} ${safe(form.lastName)}`.trim())
  line("Date of birth", safe(form.dob))
  line("Age", safe(form.age))
  line("Gender", safe(form.gender))
  line("Race", safe(form.race))
  line("Ethnicity", safe(form.ethnicity))
  line(
    "Home address",
    [safe(form.address), safe(form.city), `${safe(form.state)} ${safe(form.zip)}`.trim()]
      .filter(Boolean)
      .join(", ")
  )
  line("Email", safe(form.email))
  line("Phone", safe(form.phone))
  line("Primary care physician", safe(form.physicianName))
  line("Physician phone", safe(form.physicianPhone))
  line("Physician fax", safe(form.physicianFax))

  // ---- Vaccines requested -------------------------------------------------
  block("Vaccinations Requested Today")
  if (blank) {
    optionList(VACCINE_OPTIONS)
  } else {
    const requested: string[] = Array.isArray(form.vaccinesRequested) ? [...form.vaccinesRequested] : []
    const requestedDisplay = requested.map((v) =>
      v === "Other" && form.otherVaccineText ? `Other: ${safe(form.otherVaccineText)}` : v
    )
    bullets(requestedDisplay)
  }

  // ---- Section B ----------------------------------------------------------
  block("Section B - General Vaccine Screening")
  GENERAL_SCREENING.forEach(question)

  block("Section B - Live Vaccine Screening")
  LIVE_VACCINE_SCREENING.forEach(question)

  // ---- Section C ----------------------------------------------------------
  block("Section C - COVID-19 Vaccine Screening")
  COVID_SCREENING.forEach(question)
  y -= 6
  for (const l of wrap(Q17_FOOTNOTE, italic, 8, PAGE_W - MARGIN * 2 - 20)) {
    if (y - 11 < 60) newPage()
    y -= 11
    page.drawText(l, { x: LABEL_X, y, size: 8, font: italic, color: rgb(0.45, 0.45, 0.45) })
  }

  y -= 8
  if (y < 90) newPage()
  y -= 14
  page.drawText("18. Check all that apply to you:", { x: LABEL_X, y, size: 9.5, font: bold })
  if (blank) optionList(Q18_CONDITIONS)
  else bullets(Array.isArray(form.q18Conditions) ? form.q18Conditions : [])

  // ---- Section D — consent ------------------------------------------------
  block("Section D - Consent and Release")
  for (const l of wrap(
    "I understand the benefits and risks of the vaccination(s) as described in the Vaccine " +
      "Information Statement (VIS), a copy of which was provided with this Consent and Release. " +
      "I request the vaccine(s) be given to me or to the person named below, a minor for whom I " +
      "represent that I am authorized to sign this Consent and Release.",
    font,
    9,
    PAGE_W - MARGIN * 2 - 20
  )) {
    if (y - 12 < 60) newPage()
    y -= 12
    page.drawText(l, { x: LABEL_X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  }
  y -= 4
  line("Signature (typed)", safe(form.consentName))
  line("Date", safe(form.consentDate))
  line("Agreed to consent", form?.consentAgree ? "Yes" : "No")

  // ---- Section D — insurance ---------------------------------------------
  block("Insurance Information and Authorization")
  line(
    "Coverage type",
    Array.isArray(form.insuranceTypes) && form.insuranceTypes.length
      ? form.insuranceTypes.join(", ")
      : ""
  )
  line("Insurance plan name", safe(form.insurancePlanName))
  line("Member/recipient ID", safe(form.memberId))
  line("RX BIN", safe(form.rxBin))
  line("RX PCN", safe(form.rxPcn))
  line("Group No.", safe(form.groupNo))
  line("Medicare Card No.", safe(form.medicareCardNo))
  line("Medicare ID", safe(form.medicareId))
  // Only the last four digits are ever rendered — see the SSN note in
  // app/api/forms/vaccine-consent/route.ts.
  line("SSN", maskSsn(form.ssn))
  line("Authorizes billing", form?.authorizeBilling ? "Yes" : "No")

  // ---- Vaccine Administration (Pharmacy Use Only) — always printed --------
  // The immunizer completes this at the appointment, so the grid is always on
  // the document: empty on a fresh submission / blank form, filled once an
  // admin records the doses.
  const filledRows = Array.isArray(form.vaccineRows)
    ? form.vaccineRows.filter((r: any) => r && Object.values(r).some((v) => safe(v).trim() !== ""))
    : []
  const adminRows: any[] = filledRows.length ? filledRows : ADMIN_TABLE_ROWS.map((name) => ({ vaccine: name }))

  block("Vaccine Administration (Pharmacy Use Only)")
  if (y - 14 < 70) newPage()
  y -= 12
  page.drawText("Completed by the immunizer at the time of the appointment.", {
    x: LABEL_X, y, size: 8.5, font: italic, color: rgb(0.45, 0.45, 0.45),
  })

  const COL_W = (PAGE_W - MARGIN * 2) / 3
  const cellField = (colX: number, atY: number, label: string, value: string) => {
    page.drawText(toWinAnsi(label), { x: colX, y: atY, size: 7.5, font, color: rgb(0.45, 0.45, 0.45) })
    if (value) page.drawText(toWinAnsi(value), { x: colX, y: atY - 12, size: 9, font })
    page.drawLine({ start: { x: colX, y: atY - 14 }, end: { x: colX + COL_W - 14, y: atY - 14 }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) })
  }

  for (const row of adminRows) {
    if (y - 92 < 60) newPage()
    y -= 22
    for (let r = 0; r < 3; r++) {
      const cols = ADMIN_TABLE_COLUMNS.slice(r * 3, r * 3 + 3)
      cols.forEach((col, c) => cellField(MARGIN + c * COL_W, y, col.label, safe(row[col.key])))
      y -= 26
    }
  }

  if (y - 22 < 60) newPage()
  y -= 22
  const imLabel = "Immunizer name (print):"
  page.drawText(imLabel, { x: LABEL_X, y, size: 9, font: bold })
  const imX = LABEL_X + bold.widthOfTextAtSize(imLabel, 9) + 8
  if (form.immunizerName && !blank) page.drawText(toWinAnsi(safe(form.immunizerName)), { x: imX, y, size: 9, font })
  page.drawLine({ start: { x: imX, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) })

  // ---- Footer on every page ----------------------------------------------
  const stamp = `Generated by North Falmouth Pharmacy | ${new Date().toLocaleString()}`
  for (const p of pdf.getPages()) {
    p.drawLine({
      start: { x: MARGIN, y: 50 },
      end: { x: PAGE_W - MARGIN, y: 50 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
    p.drawText(toWinAnsi(stamp), { x: MARGIN, y: 35, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
  }

  return await pdf.save()
}

/** Filename used for both the email attachment and the browser download. */
export function consentPdfFilename(form: Record<string, any>, recordId: string) {
  const name = [safe(form.firstName), safe(form.lastName)]
    .filter(Boolean)
    .join("-")
    // Fold accents to their base letter before stripping. Without the NFD pass
    // a plain [^A-Za-z0-9-] strip *deletes* accented characters outright, which
    // turned "María Sørensen" into "Mara Srensen" on the attachment.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return `VaccineConsent-${name || recordId}.pdf`
}
