import { NextRequest, NextResponse } from "next/server"
import { processEmailOutbox } from "@/lib/email-outbox-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/cron/email-outbox — sends scheduled emails whose time has passed.
// Auth: CRON_SECRET via `Authorization: Bearer <secret>` or `?secret=<secret>`.
// Point an external cron (e.g. cron-job.org) here every 5-15 min, or rely on the
// social-queue cron which also runs this.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    const param = new URL(req.url).searchParams.get("secret") || ""
    if (auth !== `Bearer ${secret}` && param !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  const res = await processEmailOutbox()
  return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() })
}
