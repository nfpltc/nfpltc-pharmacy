// lib/vaccine-consent-pdf.ts
//
// Builds the PDF summary of a Vaccine Administration Consent submission.
//
// Extracted out of app/api/forms/vaccine-consent/route.ts so the same builder
// serves three callers: the submission email, the patient's "Download PDF"
// button, and the admin dashboard download. One builder means the patient and
// the pharmacy can never end up looking at differently-shaped documents.

import { PDFDocument, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib"
import { readFile } from "fs/promises"
import path from "path"
import sharp from "sharp"
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
const HEADING = "Vaccine Administration Consent Form"

// Brand palette — matches the site's hero gradient (emerald-600 -> teal-600)
// and its emerald-700 accent text/links, so the PDF reads as the same brand.
const PRIMARY = rgb(0x04 / 255, 0x78 / 255, 0x57 / 255) // emerald-700 #047857
const ACCENT = rgb(0x0d / 255, 0x94 / 255, 0x88 / 255) // teal-600    #0d9488
const TINT = rgb(0.91, 0.97, 0.95) // soft green card background
const INK = rgb(0.2, 0.2, 0.2)
const MUTED = rgb(0.46, 0.46, 0.46)
const RULE = rgb(0.83, 0.88, 0.86)
const WHITE = rgb(1, 1, 1)

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
    .replace(/ /g, " ")
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
  // Prefer the real vector logo, rasterized crisp via sharp (pdf-lib cannot
  // embed SVG directly). Fall back to a raster logo file if one is ever added,
  // then to a text wordmark if no logo can be loaded at all. Each path is a
  // literal (not a loop variable) so Next's file tracer includes exactly these
  // files instead of globbing all of /public into the function bundle.
  try {
    const svg = await readFile(path.join(process.cwd(), "public", "logo.svg"))
    // density=200 gives a crisp result at the ~2.5in display width below
    // without producing an oversized embed.
    const png = await sharp(svg, { density: 200 }).png().toBuffer()
    const img = await pdf.embedPng(png)
    return { node: img, width: img.width, height: img.height }
  } catch { /* try next candidate */ }
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
  let y = PAGE_H - 24

  // A left-to-right gradient between two brand colors, approximated with thin
  // vertical bands (pdf-lib has no native gradient fill).
  const gradientRect = (x: number, atY: number, w: number, h: number, from: RGB, to: RGB) => {
    const bands = 32
    const bw = w / bands
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1)
      page.drawRectangle({
        x: x + i * bw, y: atY, width: bw + 0.75, height: h,
        color: rgb(from.red + (to.red - from.red) * t, from.green + (to.green - from.green) * t, from.blue + (to.blue - from.blue) * t),
      })
    }
  }

  // ---- Header: logo (or wordmark) + gradient title card --------------------
  const logo = await embedLogo(pdf)
  if (logo) {
    const targetW = 190
    const targetH = logo.height * (targetW / logo.width)
    page.drawImage(logo.node, { x: MARGIN, y: y - targetH, width: targetW, height: targetH })
    y -= targetH
  } else {
    page.drawText("North Falmouth Pharmacy", { x: MARGIN, y: y - 18, size: 18, font: bold, color: PRIMARY })
    y -= 26
  }

  const TITLE_BAR_H = 40
  const drawTitleBar = (atY: number) => {
    gradientRect(MARGIN, atY, PAGE_W - MARGIN * 2, TITLE_BAR_H, PRIMARY, ACCENT)
    const size = 14
    const w = bold.widthOfTextAtSize(HEADING, size)
    page.drawText(HEADING, { x: (PAGE_W - w) / 2, y: atY + (TITLE_BAR_H - size) / 2 + 3, size, font: bold, color: WHITE })
  }

  const barY = y - 18 - TITLE_BAR_H
  drawTitleBar(barY)
  y = barY - 28

  const newPage = () => {
    page.drawText("- Continued on next page -", { x: 230, y: 62, size: 9, font: italic, color: MUTED })
    page = pdf.addPage([PAGE_W, PAGE_H])
    drawTitleBar(PAGE_H - 70)
    y = PAGE_H - 70 - 28
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
    y -= 26
    if (y < 92) newPage()
    const h = 23
    page.drawRectangle({ x: MARGIN, y: y - 6, width: PAGE_W - MARGIN * 2, height: h, color: TINT })
    // Thin accent tab on the left edge of the card for a bit of visual polish.
    page.drawRectangle({ x: MARGIN, y: y - 6, width: 3.5, height: h, color: ACCENT })
    page.drawText(toWinAnsi(title), { x: MARGIN + 12, y, size: 12, font: bold, color: PRIMARY })
    y -= 11
  }

  const LABEL_X = MARGIN + 10
  const VALUE_X = 200
  const VALUE_W = PAGE_W - VALUE_X - MARGIN

  const line = (label: string, value: any) => {
    if (blank) {
      if (y - 16 < 60) newPage()
      y -= 16
      page.drawText(toWinAnsi(`${label}:`), { x: LABEL_X, y, size: 10, font: bold, color: INK })
      page.drawLine({ start: { x: VALUE_X, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.75, color: RULE })
      return
    }
    const text = value === null || value === undefined || value === "" ? "-" : String(value)
    const wrapped = wrap(text, font, 10, VALUE_W)
    if (y - (14 + (wrapped.length - 1) * 13) < 60) newPage()
    y -= 14
    page.drawText(toWinAnsi(`${label}:`), { x: LABEL_X, y, size: 10, font: bold, color: INK })
    page.drawText(wrapped[0], { x: VALUE_X, y, size: 10, font, color: INK })
    for (let i = 1; i < wrapped.length; i++) {
      y -= 13
      page.drawText(wrapped[i], { x: VALUE_X, y, size: 10, font, color: INK })
    }
  }

  // A small checkbox for the printable blank form — brand-tinted, so it reads
  // as a deliberate form control rather than a plain HTML default.
  const checkbox = (x: number, atY: number) => {
    page.drawRectangle({ x, y: atY - 1, width: 10, height: 10, color: rgb(0.96, 0.99, 0.98), borderColor: ACCENT, borderWidth: 1 })
  }

  // A checkbox list of options — used in blank mode for the multi-select fields.
  const optionList = (items: readonly string[]) => {
    for (const item of items) {
      const wrapped = wrap(item, font, 9.5, PAGE_W - MARGIN * 2 - 32)
      if (y - wrapped.length * 12 < 60) newPage()
      y -= 14
      checkbox(LABEL_X, y - 1)
      page.drawText(toWinAnsi(wrapped[0]), { x: LABEL_X + 17, y, size: 9.5, font, color: INK })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(toWinAnsi(wrapped[i]), { x: LABEL_X + 17, y, size: 9.5, font, color: INK })
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
      page.drawText(wrapped[0], { x: LABEL_X, y, size: 9.5, font, color: INK })
      checkbox(PAGE_W - MARGIN - 84, y - 1)
      page.drawText("Yes", { x: PAGE_W - MARGIN - 71, y, size: 9, font, color: INK })
      checkbox(PAGE_W - MARGIN - 40, y - 1)
      page.drawText("No", { x: PAGE_W - MARGIN - 27, y, size: 9, font, color: INK })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(wrapped[i], { x: LABEL_X, y, size: 9.5, font, color: INK })
      }
      if (q.detail || q.detailDate) {
        if (y - 13 < 60) newPage()
        y -= 13
        const flabel = q.detailDate ? "If yes, date of last dose:" : "If yes, please list:"
        page.drawText(flabel, { x: LABEL_X + 14, y, size: 8.5, font: italic, color: MUTED })
        const fx = LABEL_X + 14 + italic.widthOfTextAtSize(flabel, 8.5) + 6
        page.drawLine({ start: { x: fx, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.75, color: RULE })
      }
      return
    }
    const answer = safe(form[q.key]) || "-"
    const label = q.note ? `${q.number}. ${q.text} (${q.note})` : `${q.number}. ${q.text}`
    const wrapped = wrap(label, font, 9.5, PAGE_W - MARGIN * 2 - 60)
    if (y - (wrapped.length * 12 + 6) < 60) newPage()
    y -= 14
    const answerColor = answer === "Yes" ? rgb(0.72, 0.25, 0.05) : INK
    page.drawText(wrapped[0], { x: LABEL_X, y, size: 9.5, font, color: INK })
    page.drawText(toWinAnsi(answer), {
      x: PAGE_W - MARGIN - 34,
      y,
      size: 10,
      font: bold,
      color: answerColor,
    })
    for (let i = 1; i < wrapped.length; i++) {
      y -= 12
      page.drawText(wrapped[i], { x: LABEL_X, y, size: 9.5, font, color: INK })
    }

    const detailKey = q.detail?.key ?? q.detailDate?.key
    const detailValue = detailKey ? safe(form[detailKey]) : ""
    if (detailValue) {
      const detailLabel = q.detailDate ? "Date of last dose" : "Listed"
      for (const l of wrap(`${detailLabel}: ${detailValue}`, italic, 9, PAGE_W - MARGIN * 2 - 80)) {
        if (y - 12 < 60) newPage()
        y -= 12
        page.drawText(l, { x: LABEL_X + 14, y, size: 9, font: italic, color: MUTED })
      }
    }
  }

  const bullets = (items: string[]) => {
    if (!items.length) {
      y -= 14
      page.drawText("None selected", { x: LABEL_X, y, size: 10, font, color: MUTED })
      return
    }
    for (const item of items) {
      const wrapped = wrap(item, font, 9.5, PAGE_W - MARGIN * 2 - 30)
      if (y - wrapped.length * 12 < 60) newPage()
      y -= 13
      page.drawText("-", { x: LABEL_X, y, size: 9.5, font: bold, color: PRIMARY })
      page.drawText(wrapped[0], { x: LABEL_X + 12, y, size: 9.5, font, color: INK })
      for (let i = 1; i < wrapped.length; i++) {
        y -= 12
        page.drawText(wrapped[i], { x: LABEL_X + 12, y, size: 9.5, font, color: INK })
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
    page.drawText(l, { x: LABEL_X, y, size: 8, font: italic, color: MUTED })
  }

  y -= 8
  if (y < 90) newPage()
  y -= 14
  page.drawText("18. Check all that apply to you:", { x: LABEL_X, y, size: 9.5, font: bold, color: INK })
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
    page.drawText(l, { x: LABEL_X, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) })
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
    x: LABEL_X, y, size: 8.5, font: italic, color: MUTED,
  })

  const COL_W = (PAGE_W - MARGIN * 2) / 3
  const cellField = (colX: number, atY: number, label: string, value: string) => {
    page.drawText(toWinAnsi(label), { x: colX, y: atY, size: 7.5, font, color: MUTED })
    if (value) page.drawText(toWinAnsi(value), { x: colX, y: atY - 12, size: 9, font, color: INK })
    page.drawLine({ start: { x: colX, y: atY - 14 }, end: { x: colX + COL_W - 14, y: atY - 14 }, thickness: 0.75, color: RULE })
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
  page.drawText(imLabel, { x: LABEL_X, y, size: 9, font: bold, color: INK })
  const imX = LABEL_X + bold.widthOfTextAtSize(imLabel, 9) + 8
  if (form.immunizerName && !blank) page.drawText(toWinAnsi(safe(form.immunizerName)), { x: imX, y, size: 9, font, color: INK })
  page.drawLine({ start: { x: imX, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.75, color: RULE })

  // ---- Footer on every page: stamp, page count, copyright -----------------
  const stamp = `Generated by North Falmouth Pharmacy | ${new Date().toLocaleString()}`
  const copyright = `© ${new Date().getFullYear()} NFPLTC. All Rights Reserved.`
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 52 }, end: { x: PAGE_W - MARGIN, y: 52 }, thickness: 0.75, color: RULE })
    p.drawText(toWinAnsi(stamp), { x: MARGIN, y: 37, size: 8, font, color: MUTED })
    const pageLabel = `Page ${i + 1} of ${pages.length}`
    p.drawText(pageLabel, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageLabel, 8), y: 37, size: 8, font, color: MUTED })
    const cw = font.widthOfTextAtSize(copyright, 7.5)
    p.drawText(copyright, { x: (PAGE_W - cw) / 2, y: 24, size: 7.5, font, color: rgb(0.6, 0.6, 0.6) })
  })

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
