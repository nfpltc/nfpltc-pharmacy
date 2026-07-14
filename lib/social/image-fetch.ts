import sharp from "sharp"
import dns from "node:dns/promises"
import net from "node:net"
import { request } from "undici"

// Pull the source image ourselves and re-encode it to a bounded JPEG data URL,
// so a vision model can ingest ANY image regardless of format, size, colour
// profile or where it is hosted. Used by caption-from-image so "Post from
// image" works for old library images, fresh uploads, Unsplash and AI images.
//
// The fetch path is hardened against SSRF (this runs from an unauthenticated
// route): every hop's host is DNS-resolved and every resolved IP is checked
// against private / loopback / link-local / metadata ranges, redirects are
// NOT auto-followed but read and re-validated hop by hop, and the body is
// streamed with a hard byte cap. (Residual: an active DNS-rebinding attacker
// could win the gap between our resolve and undici's connect; that only yields
// a blind request since non-image responses are rejected by sharp and never
// returned to the caller.)

const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 25 * 1024 * 1024      // hard cap on the source we pull
const MAX_REDIRECTS = 3
const MAX_INPUT_PIXELS = 60_000_000     // cap sharp decode-side memory (Groq's own limit is 33MP)

// --- SSRF: IP-range classification -----------------------------------------

// Convert an IPv4-mapped IPv6 address (::ffff:a.b.c.d or ::ffff:XXXX:XXXX) to
// its dotted IPv4 form so the IPv4 rules below catch it.
function mappedToV4(v6: string): string | null {
  const lv = v6.toLowerCase()
  let m = lv.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) return `${+m[1]}.${+m[2]}.${+m[3]}.${+m[4]}`
  m = lv.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16)
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  }
  return null
}

function isBlockedIp(ip: string): boolean {
  let v = ip
  if (net.isIPv6(ip)) {
    const asV4 = mappedToV4(ip)
    if (asV4) {
      v = asV4 // fall through to IPv4 rules
    } else {
      const lv = ip.toLowerCase()
      if (lv === "::1" || lv === "::") return true          // loopback / unspecified
      if (/^fe[89ab]/.test(lv)) return true                 // fe80::/10 link-local
      if (/^f[cd]/.test(lv)) return true                    // fc00::/7 unique-local
      return false
    }
  }
  if (net.isIPv4(v)) {
    const [a, b] = v.split(".").map(Number)
    if (a === 0 || a === 127 || a === 10) return true       // this-host / loopback / private
    if (a === 169 && b === 254) return true                 // link-local + cloud metadata
    if (a === 192 && b === 168) return true                 // private
    if (a === 172 && b >= 16 && b <= 31) return true        // private
    if (a === 100 && b >= 64 && b <= 127) return true       // CGNAT 100.64/10
    if (a >= 224) return true                               // multicast / reserved
    return false
  }
  return true // not a parseable IP → block
}

// Resolve a host to public IPs (or accept a literal public IP). Throws if the
// host is missing, unresolvable, or resolves to any non-public address.
async function resolvePublicIps(hostname: string): Promise<string[]> {
  const host = hostname.replace(/\.$/, "") // strip FQDN trailing dot
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error("Blocked host")
    return [host]
  }
  const recs = await dns.lookup(host, { all: true })
  const ips = recs.map(r => r.address)
  if (!ips.length) throw new Error("DNS: no address")
  for (const ip of ips) if (isBlockedIp(ip)) throw new Error("Blocked host (resolves to private IP)")
  // Prefer IPv4 for egress reliability, but every returned IP is validated.
  return ips.sort((a, b) => (net.isIPv4(a) ? 0 : 1) - (net.isIPv4(b) ? 0 : 1))
}

const header1 = (h: any): string => (Array.isArray(h) ? h[0] : h) ?? ""

// Read an undici body (async-iterable Readable) into a Buffer, destroying the
// stream as soon as it exceeds `cap` so an oversized/endless body can't OOM us.
async function readCapped(body: any, cap: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of body) {
    const b = Buffer.from(chunk)
    total += b.length
    if (total > cap) { try { body.destroy() } catch { /* ignore */ } throw new Error("image too large") }
    chunks.push(b)
  }
  return Buffer.concat(chunks)
}

async function fetchBytes(startUrl: string): Promise<Buffer> {
  let url = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Unsupported URL protocol")

    // Validate the host before connecting (blocks literal private IPs and any
    // DNS name that resolves to a non-public address).
    await resolvePublicIps(u.hostname)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      // maxRedirections: 0 → we get the 3xx ourselves and re-validate the next
      // hop's host, so a redirect can't smuggle us onto an internal target.
      const { statusCode, headers, body } = await request(url, {
        method: "GET",
        maxRedirections: 0,
        signal: ctrl.signal,
        headers: { accept: "image/*,*/*;q=0.8" },
      })

      if (statusCode >= 300 && statusCode < 400) {
        try { body.destroy() } catch { /* ignore */ }
        const loc = header1(headers.location)
        if (!loc) throw new Error("redirect without location")
        url = new URL(String(loc), url).toString()
        continue
      }
      if (statusCode < 200 || statusCode >= 300) {
        try { body.destroy() } catch { /* ignore */ }
        throw new Error(`fetch ${statusCode}`)
      }
      const clen = Number(header1(headers["content-length"]) || 0)
      if (clen && clen > MAX_BYTES) { try { body.destroy() } catch { /* ignore */ } throw new Error("image too large") }
      const buf = await readCapped(body, MAX_BYTES)
      if (buf.byteLength === 0) throw new Error("empty image")
      return buf
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error("too many redirects")
}

function decodeDataUrl(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) throw new Error("bad data URL")
  const meta = dataUrl.slice(0, comma)
  const data = dataUrl.slice(comma + 1)
  if (/;base64/i.test(meta)) return Buffer.from(data, "base64")
  try { return Buffer.from(decodeURIComponent(data), "utf8") } catch { throw new Error("bad data URL") }
}

/**
 * Fetch/decode an image (http(s) OR data: URL) and return a normalised JPEG
 * data URL: auto-oriented, transparency flattened to white, downscaled to fit
 * within `maxDim`, and re-encoded so the base64 payload stays under a vision
 * model's limit. Handles PNG, WEBP, (animated) GIF, TIFF, AVIF, CMYK JPEG and
 * oversized images alike. Throws if the source can't be fetched or decoded.
 */
export async function toVisionDataUrl(
  src: string,
  opts: { maxDim?: number; maxBytes?: number } = {},
): Promise<string> {
  const maxDim = opts.maxDim ?? 1536
  // Cap the DECODED jpeg so the base64 string (~1.34x) stays well under Groq's 4MB.
  const maxBytes = opts.maxBytes ?? 2.6 * 1024 * 1024

  const input = /^data:/i.test(src) ? decodeDataUrl(src) : await fetchBytes(src)

  // `failOn: "none"` keeps sharp from rejecting slightly-malformed images.
  const base = sharp(input, { failOn: "none", animated: false, limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()                            // honour EXIF orientation
    .flatten({ background: "#ffffff" })  // drop alpha so nothing renders black

  const attempts: Array<{ q: number; dim: number }> = [
    { q: 85, dim: maxDim },
    { q: 78, dim: maxDim },
    { q: 72, dim: 1024 },
    { q: 66, dim: 768 },
    { q: 60, dim: 640 },
  ]

  let out: Buffer | null = null
  for (const a of attempts) {
    out = await base
      .clone()
      .resize({ width: a.dim, height: a.dim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: a.q })
      .toBuffer()
    if (out.byteLength <= maxBytes) break
  }
  if (!out) throw new Error("encode failed")
  return `data:image/jpeg;base64,${out.toString("base64")}`
}
