// Client for the Python statement-service (STATEMENT_SERVICE_URL).
// Handles the heavy PDF work that can't run in Vercel serverless.

const BASE = (process.env.STATEMENT_SERVICE_URL || "").replace(/\/+$/, "")
const TOKEN = process.env.STATEMENT_SERVICE_TOKEN || ""

export function statementServiceConfigured(): boolean {
  return !!BASE
}

function authHeaders(): Record<string, string> {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
}

export interface IndexedCustomer {
  account_number: string
  first_name: string
  last_name: string
  facility: string
  amount_due: number | null
  bill_date: string | null
  start_page: number
  end_page: number
  pages: number
}
export interface IndexResult {
  meta: { total_pages: number; customers: number; month_ym: string | null; month_label: string | null }
  customers: IndexedCustomer[]
}

// Parse a bulk PDF into per-customer page ranges.
export async function serviceIndex(pdfBytes: Buffer, fileName: string, password: string): Promise<IndexResult> {
  if (!BASE) throw new Error("STATEMENT_SERVICE_URL not configured")
  const fd = new FormData()
  fd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName)
  fd.append("password", password || "")
  const r = await fetch(`${BASE}/index`, { method: "POST", headers: authHeaders(), body: fd })
  if (!r.ok) throw new Error(`index ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

// Extract one customer's pages (0-based inclusive) as PDF bytes.
export async function serviceExtract(pdfUrl: string, startPage: number, endPage: number, password: string): Promise<Buffer> {
  if (!BASE) throw new Error("STATEMENT_SERVICE_URL not configured")
  const r = await fetch(`${BASE}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ pdf_url: pdfUrl, start_page: startPage, end_page: endPage, password: password || "" }),
  })
  if (!r.ok) throw new Error(`extract ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return Buffer.from(await r.arrayBuffer())
}
