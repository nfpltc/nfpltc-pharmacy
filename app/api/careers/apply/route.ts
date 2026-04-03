import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const first_name = formData.get("first_name") as string
    const last_name = formData.get("last_name") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string

    if (!first_name || !last_name || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required fields: first_name, last_name, email, phone" },
        { status: 400 }
      )
    }

    const data: Record<string, any> = {
      job_id: (formData.get("job_id") as string) || null,
      job_title: (formData.get("job_title") as string) || "General Application",
      first_name, last_name, email, phone,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      zip: (formData.get("zip") as string) || null,
      linkedin: (formData.get("linkedin") as string) || null,
      portfolio: (formData.get("portfolio") as string) || null,
      current_employer: (formData.get("current_employer") as string) || null,
      current_title: (formData.get("current_title") as string) || null,
      years_experience: (formData.get("years_experience") as string) || null,
      highest_education: (formData.get("highest_education") as string) || null,
      licenses: (formData.get("licenses") as string) || null,
      cover_letter: (formData.get("cover_letter") as string) || null,
      how_heard: (formData.get("how_heard") as string) || null,
      start_date: (formData.get("start_date") as string) || null,
      salary_expectation: (formData.get("salary_expectation") as string) || null,
      authorized_to_work: formData.get("authorized_to_work") === "true",
      require_sponsorship: formData.get("require_sponsorship") === "true",
      status: "new",
    }

    // Upload resume
    const resumeFile = formData.get("resume") as File | null
    let resume_url: string | null = null
    let resume_filename: string | null = null

    if (resumeFile && resumeFile.size > 0) {
      const safeName = `${first_name}-${last_name}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
      const ext = resumeFile.name.split(".").pop() || "pdf"
      const path = `applications/${safeName}.${ext}`
      const buffer = Buffer.from(await resumeFile.arrayBuffer())

      const { error: uploadErr } = await supabase.storage
        .from("resumes")
        .upload(path, buffer, { contentType: resumeFile.type || "application/pdf" })

      if (!uploadErr) {
        resume_url = path
        resume_filename = resumeFile.name
      }
    }

    // Save to database
    const { data: application, error: dbError } = await supabase
      .from("job_applications")
      .insert({ ...data, resume_url, resume_filename })
      .select()
      .single()

    if (dbError) {
      console.error("DB error:", dbError)
      return NextResponse.json({ error: "Failed to save application" }, { status: 500 })
    }

    // Email admin
    try {
      const attachments: any[] = []
      if (resumeFile && resumeFile.size > 0) {
        attachments.push({
          filename: resume_filename || "resume.pdf",
          content: Buffer.from(await resumeFile.arrayBuffer()),
        })
      }

      await resend.emails.send({
        from: process.env.FROM_EMAIL || "noreply@nfpltc.com",
        to: process.env.TO_EMAIL || "wecare@nfpltc.com",
        subject: `New Application: ${data.job_title} — ${first_name} ${last_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;">
            <h2 style="color:#059669;">New Job Application</h2>
            <p><b>Position:</b> ${data.job_title}</p>
            <p><b>Name:</b> ${first_name} ${last_name}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Phone:</b> ${phone}</p>
            <p><b>Experience:</b> ${data.years_experience || "—"}</p>
            <p><b>Education:</b> ${data.highest_education || "—"}</p>
            <p style="margin-top:20px;"><a href="https://nfpltc.com/admin/candidates" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">View in Admin</a></p>
          </div>
        `,
        ...(attachments.length > 0 ? { attachments } : {}),
      })
    } catch (e) { console.error("Admin email error:", e) }

    // Confirmation email to applicant
    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL || "noreply@nfpltc.com",
        to: email,
        subject: `Application Received — ${data.job_title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;">
            <h2 style="color:#059669;">Thank You, ${first_name}!</h2>
            <p>We've received your application for <b>${data.job_title}</b> at North Falmouth Pharmacy.</p>
            <p>Our hiring team will review your application and reach out within 5-7 business days if your qualifications match our needs.</p>
            <p>Best regards,<br><b>North Falmouth Pharmacy Team</b><br>(508) 564-4459</p>
          </div>
        `,
      })
    } catch (e) { console.error("Applicant email error:", e) }

    return NextResponse.json({ success: true, message: "Application submitted", applicationId: application.id })
  } catch (error: any) {
    console.error("Apply error:", error)
    return NextResponse.json({ error: "Submission failed" }, { status: 500 })
  }
}
