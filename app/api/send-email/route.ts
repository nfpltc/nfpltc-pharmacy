import { Resend } from "resend"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { firstName, lastName, email, phone, message } = await req.json()

    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: process.env.TO_EMAIL!,
      subject: `📩 New Contact Form Message from ${firstName} ${lastName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-line">${message}</p>
      `,
    })

    // Save to Supabase so admin can view in dashboard
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
        await sb.from("contact_submissions").insert({
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          phone: phone || null,
          message: message || null,
          status: "new",
        })
      }
    } catch (dbErr) { console.error("Supabase save error (contact):", dbErr) }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Email sending failed:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
