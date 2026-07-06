/**
 * Health infographic HTML templates for North Falmouth Pharmacy social posts.
 *
 * Each function returns an HTML string for a single 420x525 card (renders to
 * 1080x1350 via lib/social/render-image.ts). Plain HTML/CSS strings — no React —
 * so they render identically in the browser preview and in hcti.io headless
 * Chrome. Brand palette matches the admin/site (emerald + cream).
 *
 * To tune the look, edit the palette constants or the per-template markup below.
 */

import { LOGO_WHITE, LOGO_COLOR } from "./logo-data"

// ── Brand palette (from the site's admin gradient) ──────────────────────────
const EMERALD = "#0EA171"
const EMERALD_DEEP = "#0B7C79"
const INK = "#0f2e22"
const CREAM = "#F7F5EF"
const ORANGE = "#E86E3A"

// Type. DISPLAY (Anton) is a tall condensed poster face — the editorial look of
// premium health graphics; loaded by render-image.ts. SANS for body/labels.
const DISPLAY = "'Anton','Archivo Black',Inter,sans-serif"
const SANS = "Inter,-apple-system,'Segoe UI',sans-serif"

// A logo lockup for the top of a card. `variant` picks white (dark bg) or color.
function logoMark(variant: "white" | "color" = "white", height = 34): string {
  const src = variant === "color" ? LOGO_COLOR : LOGO_WHITE
  return `<img src="${src}" alt="North Falmouth Pharmacy" style="height:${height}px;width:auto;display:block;" />`
}

export type HealthTemplate = "hero_photo" | "tip_card" | "food_as_medicine" | "quote_card"

export const TEMPLATE_LABELS: Record<HealthTemplate, string> = {
  hero_photo: "Photo headline",
  tip_card: "Wellness tips",
  food_as_medicine: "Food as medicine",
  quote_card: "Quote / announcement",
}

// Templates that read a hero photo (stock or AI). Others are pure vector.
export const PHOTO_TEMPLATES: HealthTemplate[] = ["hero_photo"]

// Data shapes each template expects (also what the AI fills in).
export interface TipCardData {
  headline: string                 // e.g. "4 habits for a healthy heart"
  tips: { emoji?: string; label: string }[]   // up to 4
}
export interface FoodAsMedicineData {
  title: string                    // e.g. "Food as medicine"
  items: { emoji?: string; food: string; benefit: string }[] // up to 4
}
export interface QuoteCardData {
  quote: string
  attribution?: string
}
export interface HeroPhotoData {
  kicker?: string          // small eyebrow, e.g. "Flu clinic"
  headline: string         // big condensed headline
  subtext?: string         // one supporting line
  image_url?: string       // hero photo (stock or AI); falls back to a gradient
}

const BRAND_FOOTER = `
  <div style="position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.20);">
    ${logoMark("white", 30)}
  </div>`

// A soft radial glow for depth.
function glow(color: string, pos: string): string {
  return `<div style="position:absolute;${pos};width:220px;height:220px;background:radial-gradient(circle,${color} 0%,transparent 70%);opacity:0.5;pointer-events:none;"></div>`
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))
}

// ── Template 1: Tip card (headline + up to 4 labeled tips) ───────────────────
function tipCard(d: TipCardData): string {
  const tips = (d.tips || []).slice(0, 4)
  const rows = tips.map((t) => `
    <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:14px 16px;">
      <div style="width:44px;height:44px;flex-shrink:0;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;">${esc(t.emoji || "🌿")}</div>
      <span style="color:#fff;font-size:17px;font-weight:600;font-family:Inter,sans-serif;line-height:1.25;">${esc(t.label)}</span>
    </div>`).join("")
  return `
  <div style="position:relative;width:420px;height:525px;overflow:hidden;background:linear-gradient(150deg,${EMERALD} 0%,${EMERALD_DEEP} 100%);font-family:Inter,sans-serif;">
    ${glow("#8FE9C2", "top:-40px;right:-40px")}
    <div style="position:relative;padding:32px 28px 20px;">
      <div style="margin-bottom:18px;">${logoMark("white", 32)}</div>
      <div style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">Wellness</div>
      <h1 style="color:#fff;font-family:${DISPLAY};font-weight:400;font-size:37px;line-height:1.0;letter-spacing:0.5px;text-transform:uppercase;margin:14px 0 22px;max-width:360px;">${esc(d.headline)}</h1>
      <div style="display:flex;flex-direction:column;gap:12px;">${rows}</div>
    </div>
    ${BRAND_FOOTER}
  </div>`
}

// ── Template 2: Food as medicine (grid of food -> benefit) ───────────────────
function foodAsMedicine(d: FoodAsMedicineData): string {
  const items = (d.items || []).slice(0, 4)
  const cells = items.map((it) => `
    <div style="background:#fff;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,0.10);">
      <div style="font-size:30px;line-height:1;">${esc(it.emoji || "🥗")}</div>
      <div style="color:${INK};font-size:16px;font-weight:800;font-family:Inter,sans-serif;">${esc(it.food)}</div>
      <div style="color:${EMERALD_DEEP};font-size:13px;font-weight:600;font-family:Inter,sans-serif;line-height:1.3;">${esc(it.benefit)}</div>
    </div>`).join("")
  return `
  <div style="position:relative;width:420px;height:525px;overflow:hidden;background:${CREAM};font-family:Inter,sans-serif;">
    <div style="background:linear-gradient(120deg,${EMERALD} 0%,${EMERALD_DEEP} 100%);padding:26px 28px;">
      <div style="margin-bottom:14px;">${logoMark("white", 30)}</div>
      <h1 style="color:#fff;font-family:${DISPLAY};font-weight:400;font-size:37px;letter-spacing:1px;text-transform:uppercase;line-height:0.98;">${esc(d.title || "Food as medicine")}</h1>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:22px;">${cells}</div>
    ${BRAND_FOOTER}
  </div>`
}

// ── Template 3: Quote / announcement card ────────────────────────────────────
function quoteCard(d: QuoteCardData): string {
  return `
  <div style="position:relative;width:420px;height:525px;overflow:hidden;background:${CREAM};font-family:Inter,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:56px 34px 78px;">
    ${glow(EMERALD, "top:-60px;left:-60px")}
    <div style="position:absolute;top:30px;left:0;right:0;display:flex;justify-content:center;">${logoMark("color", 32)}</div>
    <div style="position:absolute;top:98px;left:34px;font-size:78px;line-height:1;color:${EMERALD};opacity:0.16;font-weight:900;">&ldquo;</div>
    <p style="position:relative;color:${INK};font-size:26px;font-weight:700;line-height:1.35;">${esc(d.quote)}</p>
    ${d.attribution ? `<p style="margin-top:18px;color:${ORANGE};font-size:15px;font-weight:700;">— ${esc(d.attribution)}</p>` : ""}
    ${BRAND_FOOTER}
  </div>`
}

// ── Flagship: Photo headline (full-bleed photo + condensed headline) ─────────
function heroPhoto(d: HeroPhotoData): string {
  const bg = d.image_url
    ? `background:#0b1220 url('${d.image_url}') center/cover no-repeat;`
    : `background:linear-gradient(150deg,${EMERALD},${EMERALD_DEEP});`
  return `
  <div style="position:relative;width:420px;height:525px;overflow:hidden;font-family:${SANS};${bg}">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,12,9,0.55) 0%,rgba(4,12,9,0.04) 32%,rgba(4,12,9,0.42) 62%,rgba(4,12,9,0.88) 100%);"></div>
    <div style="position:absolute;top:26px;left:28px;">${logoMark("white", 32)}</div>
    <div style="position:absolute;left:28px;right:28px;bottom:76px;">
      ${d.kicker ? `<div style="display:inline-block;background:${EMERALD};color:#fff;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:6px;margin-bottom:14px;">${esc(d.kicker)}</div>` : ""}
      <h1 style="color:#fff;font-family:${DISPLAY};font-weight:400;font-size:52px;line-height:0.94;letter-spacing:0.5px;text-transform:uppercase;margin:0;text-shadow:0 2px 20px rgba(0,0,0,0.45);">${esc(d.headline)}</h1>
      ${d.subtext ? `<p style="color:#EAF3EE;font-size:16px;font-weight:500;line-height:1.4;margin:14px 0 0;max-width:340px;">${esc(d.subtext)}</p>` : ""}
    </div>
    ${BRAND_FOOTER}
  </div>`
}

/** Render a template by name. Returns the HTML string (420x525). */
export function renderHealthTemplate(template: HealthTemplate, data: any): string {
  switch (template) {
    case "hero_photo": return heroPhoto(data as HeroPhotoData)
    case "food_as_medicine": return foodAsMedicine(data as FoodAsMedicineData)
    case "quote_card": return quoteCard(data as QuoteCardData)
    case "tip_card":
    default: return tipCard(data as TipCardData)
  }
}
