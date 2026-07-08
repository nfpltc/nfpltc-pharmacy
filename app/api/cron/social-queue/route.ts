import { NextRequest, NextResponse } from "next/server"
import { processDue } from "@/lib/social/queue-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/cron/social-queue — fires all pending items whose due_at has passed.
// Auth: CRON_SECRET via `Authorization: Bearer <secret>` or `?secret=<secret>`.
// A Vercel cron hits this once daily (Hobby plan allows only daily crons — see
// vercel.json). For minute-level scheduling, point an external cron (e.g.
// cron-job.org) at this URL with ?secret=CRON_SECRET every 5 minutes.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    const param = new URL(req.url).searchParams.get("secret") || ""
    if (auth !== `Bearer ${secret}` && param !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  const res = await processDue()
  return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() })
}
