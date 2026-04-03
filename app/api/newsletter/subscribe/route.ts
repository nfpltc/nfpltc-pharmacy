import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const { email, source } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Check if already subscribed
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .single()

    if (existing) {
      if (existing.status === "active") {
        return NextResponse.json({ message: "You're already subscribed!" })
      }
      // Reactivate
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "active", source: source || "blog" })
        .eq("id", existing.id)
      return NextResponse.json({ message: "Welcome back! Subscription reactivated." })
    }

    // New subscriber
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: email.toLowerCase(),
      status: "active",
      source: source || "blog",
    })

    if (error) {
      console.error("Subscribe error:", error)
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
    }

    return NextResponse.json({ message: "Thanks for subscribing!" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
