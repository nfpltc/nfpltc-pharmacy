import { NextRequest, NextResponse } from "next/server"
import { processDue } from "@/lib/social/queue-runner"
import { processEmailOutbox } from "@/lib/email-outbox-runner"
import { runAutoDrip, type DripResult } from "@/lib/social/auto-drip"

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

  // Auto-drip: pick an unused image, generate captions, queue for all channels.
  // Runs BEFORE processDue so the freshly-queued items get sent in the same pass.
  let drip: DripResult = { ok: true, skipped: "not attempted" }
  try {
    drip = await runAutoDrip()
  } catch (e: any) {
    console.error("Auto-drip error:", e)
    drip = { ok: false, error: e.message }
  }

  const res = await processDue()
  const mail = await processEmailOutbox()
  return NextResponse.json({ ok: true, ...res, drip, mail, at: new Date().toISOString() })
}
