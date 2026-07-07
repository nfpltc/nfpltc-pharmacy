// Bakes the real North Falmouth Pharmacy logo into the social image templates.
// Reads public/logowhite.svg + public/logo.svg, encodes each as a data URI, and
// replaces the LOGO_WHITE / LOGO_COLOR constants in the template library.
// Idempotent — safe to re-run after updating the logo files.
//
//   node scripts/inline-logo.mjs
import fs from "node:fs"

const TARGET = "lib/social/logo-data.ts"
const toDataUri = (p) =>
  "data:image/svg+xml;base64," + Buffer.from(fs.readFileSync(p, "utf8").trim(), "utf8").toString("base64")

const white = toDataUri("public/logowhite.svg")
const color = toDataUri("public/logo.svg")

let src = fs.readFileSync(TARGET, "utf8")
src = src.replace(/export const LOGO_WHITE = "[^"]*"/, `export const LOGO_WHITE = "${white}"`)
src = src.replace(/export const LOGO_COLOR = "[^"]*"/, `export const LOGO_COLOR = "${color}"`)
fs.writeFileSync(TARGET, src)

console.log(`LOGO_WHITE: ${white.length} chars, LOGO_COLOR: ${color.length} chars — injected into ${TARGET}`)
