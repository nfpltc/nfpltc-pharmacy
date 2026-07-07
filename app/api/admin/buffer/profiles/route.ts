import { NextResponse } from "next/server"
import { getChannels } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/buffer/profiles → connected channels, service names normalized.
export async function GET() {
  const { channels, error } = await getChannels()
  if (error && !channels.length) return NextResponse.json({ error, channels: [] }, { status: 500 })
  return NextResponse.json({ channels })
}
