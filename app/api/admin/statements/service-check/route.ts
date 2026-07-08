import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/statements/service-check
// Diagnostic: shows the EXACT statement-service URL the live app is using and
// whether the server can reach it. Open in a browser to debug config.
export async function GET() {
  const raw = process.env.STATEMENT_SERVICE_URL || ""
  const base = raw.replace(/\/+$/, "")
  const indexUrl = `${base}/index`

  let health: any = null
  let health_error: string | null = null
  try {
    if (base) {
      const r = await fetch(`${base}/health`)
      health = { status: r.status, body: (await r.text()).slice(0, 120) }
    }
  } catch (e: any) {
    health_error = e.message
  }

  return NextResponse.json({
    statement_service_url_env: raw,           // exactly what's stored (look for /health, spaces)
    env_length: raw.length,                    // longer than the visible URL => hidden whitespace
    computed_index_url: indexUrl,              // the URL the upload actually POSTs to
    has_token: !!process.env.STATEMENT_SERVICE_TOKEN,
    server_can_reach_health: health,           // status 200 => server reaches the service
    health_error,
  })
}
