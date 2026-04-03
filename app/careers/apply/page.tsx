"use client"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

const steps = ["Contact", "Resume", "Experience", "Review"]

function ApplyForm() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId") || ""
  const jobTitle = searchParams.get("title") || "General Application"

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resume, setResume] = useState<File | null>(null)

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", city: "", state: "", zip: "",
    linkedin: "", portfolio: "", coverLetter: "",
    currentEmployer: "", currentTitle: "", yearsExperience: "",
    highestEducation: "", licenses: "", howHeard: "",
    startDate: "", salaryExpectation: "",
    authorizedToWork: "", requireSponsorship: "",
  })

  const u = (field: string, value: string) => {
    setForm(p => ({ ...p, [field]: value }))
    if (errors[field]) { const e = { ...errors }; delete e[field]; setErrors(e) }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (!form.firstName.trim()) e.firstName = "Required"
      if (!form.lastName.trim()) e.lastName = "Required"
      if (!form.email.trim()) e.email = "Required"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email"
      if (!form.phone.trim()) e.phone = "Required"
    }
    if (step === 1 && !resume) e.resume = "Resume is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate()) { setStep(s => Math.min(s + 1, steps.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }) } }
  const back = () => { setStep(s => Math.max(s - 1, 0)); window.scrollTo({ top: 0, behavior: "smooth" }) }

  const submit = async () => {
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (jobId) fd.append("job_id", jobId)
      fd.append("job_title", jobTitle)
      fd.append("first_name", form.firstName)
      fd.append("last_name", form.lastName)
      fd.append("email", form.email)
      fd.append("phone", form.phone)
      fd.append("address", form.address)
      fd.append("city", form.city)
      fd.append("state", form.state)
      fd.append("zip", form.zip)
      fd.append("linkedin", form.linkedin)
      fd.append("portfolio", form.portfolio)
      fd.append("cover_letter", form.coverLetter)
      fd.append("current_employer", form.currentEmployer)
      fd.append("current_title", form.currentTitle)
      fd.append("years_experience", form.yearsExperience)
      fd.append("highest_education", form.highestEducation)
      fd.append("licenses", form.licenses)
      fd.append("how_heard", form.howHeard)
      fd.append("start_date", form.startDate)
      fd.append("salary_expectation", form.salaryExpectation)
      fd.append("authorized_to_work", form.authorizedToWork === "yes" ? "true" : "false")
      fd.append("require_sponsorship", form.requireSponsorship === "yes" ? "true" : "false")
      if (resume) fd.append("resume", resume)

      const res = await fetch("/api/careers/apply", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Failed")
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch { alert("Error submitting. Please try again.") }
    finally { setSubmitting(false) }
  }

  if (submitted) return (
    <div className="min-h-screen bg-[#F7F5EF]">
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)" }}>
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-4xl">✅</div>
          <h1 className="text-4xl font-bold text-white mb-4">Application Submitted!</h1>
          <p className="text-xl text-white/85">Thank you for applying for {jobTitle}</p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border border-emerald-900/10 bg-white p-8 shadow-sm">
          <p className="text-gray-700 mb-4 text-lg">Thank you, {form.firstName}! We&apos;ve received your application.</p>
          <p className="text-gray-600 mb-4">Our hiring team will review your application and reach out within 5-7 business days if your qualifications match our needs.</p>
          <p className="text-gray-600 mb-6">Your resume will remain active in our database for future opportunities. Please check our careers page frequently as new positions become available.</p>
          <div className="border-t pt-6"><p className="text-gray-700">Thank you,<br /><strong>North Falmouth Pharmacy Team</strong></p></div>
        </div>
        <div className="mt-8 text-center">
          <Link href="/careers" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-8 py-3 font-medium text-white hover:bg-emerald-800">← View Open Positions</Link>
        </div>
      </div>
    </div>
  )

  const inputClass = (field: string) => `w-full h-11 rounded-lg border px-4 text-sm focus:border-emerald-500 focus:outline-none ${errors[field] ? "border-red-400 bg-red-50" : "border-gray-200"}`
  const label = (text: string, required = false) => <label className="mb-1 block text-sm font-medium text-gray-700">{text}{required && <span className="text-red-500"> *</span>}</label>

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg,#0EA171 0%,#0B8F79 50%,#0B7C79 100%)", padding: "48px 0 40px" }}>
        <div className="mx-auto max-w-4xl px-6">
          <Link href="/careers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">← Back to Careers</Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Apply for Position</h1>
          <p className="mt-2 text-lg text-white/85">{jobTitle}</p>
        </div>
      </section>

      {/* Progress */}
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${i < step ? "bg-emerald-600 text-white" : i === step ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`mt-1 hidden text-xs sm:block ${i === step ? "font-medium" : "text-gray-500"}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-2 h-1 w-8 rounded sm:w-16 md:w-24 ${i < step ? "bg-emerald-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm md:p-8">

          {/* Step 1: Contact */}
          {step === 0 && <>
            <h2 className="mb-6 text-xl font-bold">Contact Information</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>{label("First Name", true)}<input value={form.firstName} onChange={e => u("firstName", e.target.value)} className={inputClass("firstName")} placeholder="John" />{errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}</div>
              <div>{label("Last Name", true)}<input value={form.lastName} onChange={e => u("lastName", e.target.value)} className={inputClass("lastName")} placeholder="Doe" />{errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}</div>
              <div>{label("Email", true)}<input type="email" value={form.email} onChange={e => u("email", e.target.value)} className={inputClass("email")} placeholder="john@example.com" />{errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}</div>
              <div>{label("Phone", true)}<input type="tel" value={form.phone} onChange={e => u("phone", e.target.value)} className={inputClass("phone")} placeholder="(508) 555-0123" />{errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}</div>
              <div className="md:col-span-2">{label("Street Address")}<input value={form.address} onChange={e => u("address", e.target.value)} className={inputClass("")} placeholder="123 Main St" /></div>
              <div>{label("City")}<input value={form.city} onChange={e => u("city", e.target.value)} className={inputClass("")} placeholder="North Falmouth" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>{label("State")}<select value={form.state} onChange={e => u("state", e.target.value)} className={inputClass("")}><option value="">Select</option>{["MA","CT","NY","NJ","PA","NH","RI","VT","ME","CA","FL","TX","IL","OH","GA","NC","MI","VA","WA","AZ"].map(s => <option key={s}>{s}</option>)}</select></div>
                <div>{label("ZIP")}<input value={form.zip} onChange={e => u("zip", e.target.value)} className={inputClass("")} placeholder="02556" /></div>
              </div>
              <div>{label("LinkedIn")}<input value={form.linkedin} onChange={e => u("linkedin", e.target.value)} className={inputClass("")} placeholder="https://linkedin.com/in/..." /></div>
              <div>{label("Portfolio")}<input value={form.portfolio} onChange={e => u("portfolio", e.target.value)} className={inputClass("")} placeholder="https://..." /></div>
            </div>
          </>}

          {/* Step 2: Resume */}
          {step === 1 && <>
            <h2 className="mb-6 text-xl font-bold">Resume & Cover Letter</h2>
            <div className="mb-6">
              <p className="mb-4 text-sm text-gray-600">Upload your resume (PDF or Word, max 5MB)</p>
              <label className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${resume ? "border-emerald-400 bg-emerald-50" : errors.resume ? "border-red-300" : "border-gray-300 hover:border-gray-400"}`}>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 5*1024*1024) { setErrors({resume:"Max 5MB"}); return }; setResume(f); setErrors({}) }}} />
                <p className={`text-lg font-medium ${resume ? "text-emerald-700" : "text-gray-700"}`}>{resume ? resume.name : "Click to upload"}</p>
                <p className="mt-1 text-sm text-gray-500">{resume ? `${(resume.size/1024).toFixed(0)} KB` : "PDF or Word document"}</p>
              </label>
              {resume && <button onClick={() => setResume(null)} className="mt-2 text-sm text-red-500">Remove</button>}
              {errors.resume && <p className="mt-2 text-xs text-red-500">{errors.resume}</p>}
            </div>
            <div>{label("Cover Letter (Optional)")}<textarea value={form.coverLetter} onChange={e => u("coverLetter", e.target.value)} rows={6} className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Tell us why you're a great fit..." /></div>
          </>}

          {/* Step 3: Experience */}
          {step === 2 && <>
            <h2 className="mb-6 text-xl font-bold">Professional Experience</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>{label("Current Employer")}<input value={form.currentEmployer} onChange={e => u("currentEmployer", e.target.value)} className={inputClass("")} /></div>
              <div>{label("Current Title")}<input value={form.currentTitle} onChange={e => u("currentTitle", e.target.value)} className={inputClass("")} /></div>
              <div>{label("Years of Experience")}<select value={form.yearsExperience} onChange={e => u("yearsExperience", e.target.value)} className={inputClass("")}><option value="">Select...</option>{["0-1","1-2","3-5","5-10","10+"].map(o => <option key={o}>{o}</option>)}</select></div>
              <div>{label("Highest Education")}<select value={form.highestEducation} onChange={e => u("highestEducation", e.target.value)} className={inputClass("")}><option value="">Select...</option>{["High School/GED","Some College","Associate","Bachelor's","Master's","Doctorate"].map(o => <option key={o}>{o}</option>)}</select></div>
              <div className="md:col-span-2">{label("Licenses & Certifications")}<input value={form.licenses} onChange={e => u("licenses", e.target.value)} className={inputClass("")} placeholder="PharmD, RPH, CPhT, etc." /></div>
              <div>{label("How did you hear about us?")}<select value={form.howHeard} onChange={e => u("howHeard", e.target.value)} className={inputClass("")}><option value="">Select...</option>{["Company Website","Job Board","Referral","Social Media","Career Fair","Other"].map(o => <option key={o}>{o}</option>)}</select></div>
              <div>{label("Earliest Start Date")}<input type="date" value={form.startDate} onChange={e => u("startDate", e.target.value)} className={inputClass("")} /></div>
              <div className="md:col-span-2">{label("Salary Expectation")}<input value={form.salaryExpectation} onChange={e => u("salaryExpectation", e.target.value)} className={inputClass("")} placeholder="e.g. $50,000 - $60,000" /></div>
            </div>
            <div className="mt-8 border-t pt-6">
              <h3 className="mb-4 text-lg font-bold">Screening Questions</h3>
              <div className="space-y-4">
                {[
                  { key: "authorizedToWork", q: "Are you authorized to work in the United States?" },
                  { key: "requireSponsorship", q: "Will you require visa sponsorship?" },
                ].map(({ key, q }) => (
                  <div key={key} className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-2 font-medium text-sm">{q}</p>
                    <div className="flex gap-6">
                      {["yes", "no"].map(v => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="radio" name={key} value={v} checked={(form as any)[key] === v} onChange={e => u(key, e.target.value)} className="h-4 w-4 text-emerald-600" />
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* Step 4: Review */}
          {step === 3 && <>
            <h2 className="mb-6 text-xl font-bold">Review Your Application</h2>
            <p className="mb-6 text-sm text-gray-600">Please review your information before submitting. Click any section to edit.</p>
            {[
              { title: "Contact", s: 0, rows: [`${form.firstName} ${form.lastName}`, form.email, form.phone, form.address ? `${form.address}, ${form.city}, ${form.state} ${form.zip}` : ""].filter(Boolean) },
              { title: "Resume", s: 1, rows: [resume?.name || "Not uploaded", form.coverLetter ? `Cover letter: ${form.coverLetter.substring(0, 80)}...` : ""].filter(Boolean) },
              { title: "Experience", s: 2, rows: [form.currentEmployer && `${form.currentTitle} at ${form.currentEmployer}`, form.yearsExperience && `${form.yearsExperience} years`, form.highestEducation, `Work auth: ${form.authorizedToWork === "yes" ? "Yes" : "No"}`, `Sponsorship: ${form.requireSponsorship === "yes" ? "Yes" : "No"}`].filter(Boolean) },
            ].map(section => (
              <button key={section.title} onClick={() => setStep(section.s)} className="mb-3 w-full rounded-lg border p-4 text-left hover:bg-gray-50">
                <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">{section.title}</h3><span className="text-xs text-gray-500">Click to edit</span></div>
                <div className="space-y-1 text-sm text-gray-600">{section.rows.map((r, i) => <p key={i}>{r}</p>)}</div>
              </button>
            ))}
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded text-emerald-600" required />
                <span className="text-gray-700">I certify that the information provided is true and complete. I understand that misrepresentation may be grounds for rejection or dismissal.</span>
              </label>
            </div>
          </>}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button onClick={back} disabled={step === 0} className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium ${step === 0 ? "bg-gray-100 text-gray-400" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>← Back</button>
          {step < steps.length - 1 ? (
            <button onClick={next} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800">Next →</button>
          ) : (
            <button onClick={submit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-8 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Application ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ApplyPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F7F5EF]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /></div>}>
    <ApplyForm />
  </Suspense>
}
