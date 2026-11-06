import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { hashPassword, createSession } from "@/lib/portal-auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { account_number, email, password, phone } = await req.json()

    if (!account_number || !email || !password) {
      return NextResponse.json({ error: "Account number, email, and password are required." }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const emailLower = email.trim().toLowerCase()

    // Check if account already registered
    const { data: existing } = await sb
      .from("portal_users")
      .select("id")
      .eq("account_number", account_number.trim())
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "This account number already has a portal login. Please sign in instead." }, { status: 409 })
    }

    // Check if account_number exists in our customer records
    const { data: customer } = await sb
      .from("customers")
      .select("account_number, first_name, last_name, email, phone")
      .eq("account_number", account_number.trim())
      .maybeSingle()

    if (!customer) {
      return NextResponse.json({
        error: "We couldn't find this account number in our records. Please check the number on your statement or contact the pharmacy.",
      }, { status: 404 })
    }

    // Check email match
    const customerEmail = (customer.email || "").trim().toLowerCase()
    const emailMatches = customerEmail && customerEmail === emailLower

    if (!emailMatches) {
      // No email match — create an access request for admin review
      // Check for duplicate pending request
      const { data: pendingReq } = await sb
        .from("portal_access_requests")
        .select("id")
        .eq("account_number", account_number.trim())
        .eq("status", "pending")
        .maybeSingle()

      if (pendingReq) {
        return NextResponse.json({
          pending: true,
          message: "Your request is already pending admin approval. We'll notify you once it's reviewed.",
        })
      }

      await sb.from("portal_access_requests").insert({
        account_number: account_number.trim(),
        email: emailLower,
        phone: phone?.trim() || null,
        first_name: customer.first_name,
        last_name: customer.last_name,
      })

      return NextResponse.json({
        pending: true,
        message: "We don't have your email on file yet. Your request has been sent to the pharmacy for approval. Once approved, you can create your account.",
      })
    }

    // Email matches — create account immediately
    const hash = await hashPassword(password)
    const { data: user, error: insertErr } = await sb
      .from("portal_users")
      .insert({
        account_number: account_number.trim(),
        email: emailLower,
        password_hash: hash,
        phone: phone?.trim() || customer.phone || null,
      })
      .select("id")
      .single()

    if (insertErr) {
      if (insertErr.message?.includes("duplicate")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
      }
      return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 })
    }

    await createSession(user.id)
    return NextResponse.json({ ok: true, message: "Account created! Redirecting to your dashboard..." })
  } catch (e: any) {
    console.error("Register error:", e)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
