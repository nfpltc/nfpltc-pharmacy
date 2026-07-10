"use client"

import { useState } from "react"
import Link from "next/link"
import { Phone, Mail, MapPin, Printer } from "lucide-react"

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setSent(false)

    const form = e.currentTarget as HTMLFormElement & {
      firstName: { value: string }
      lastName: { value: string }
      email: { value: string }
      phone: { value: string }
      message: { value: string }
    }

    const formData = {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      phone: form.phone.value,
      message: form.message.value,
    }

    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })

    setLoading(false)

    if (res.ok) {
      setSent(true)
      form.reset()
    } else {
      alert("Something went wrong. Please try again.")
    }
  }

  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-semibold">Contact Us</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Get in touch with our pharmacy team. We’re here to answer questions, coordinate care, and support your
            patients every step of the way.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <div className="grid gap-12 md:grid-cols-[minmax(0,420px)_1fr] md:gap-16">
            {/* Contact Info */}
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-emerald-900">
                Contact Us Today for Personalized Support and Assistance
              </h2>
              <p className="text-gray-600">
                Our pharmacists are ready to help with medication questions, onboarding, and coordination with your care
                team.
              </p>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
                  <div>
                    <a href="tel:+15085644459" className="font-medium hover:underline">
                      (508) 564-4459
                    </a>
                    <div className="text-gray-500">Mon–Fri, 8:30am–4:30pm <br/> 24/7 on-call support</div>
                  </div>
                </li>
                {/* ✅ Fax line */}
                <li className="flex items-start gap-3">
                  <Printer className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
                  <div>
                    <span className="font-medium">Fax: (508) 564-6172</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
                  <div>
                    <a href="mailto:wecare@nfpltc.com" className="font-medium hover:underline">
                      wecare@nfpltc.com
                    </a>
                    <div className="text-gray-500">We reply within 1 business day</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
                  <div>
                    <div className="font-medium">111 County Rd, North Falmouth, MA 02556</div>
                    <div className="text-gray-500">Visit us or schedule a delivery</div>
                  </div>
                </li>
              </ul>
            </div>

            {/* Form with email sending */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="block text-sm font-medium mb-2">First Name</span>
                <input
                  name="firstName"
                  className="h-12 w-full rounded-full border border-black/10 px-5 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your first name"
                  required
                />
              </label>
              <label>
                <span className="block text-sm font-medium mb-2">Last Name</span>
                <input
                  name="lastName"
                  className="h-12 w-full rounded-full border border-black/10 px-5 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your last name"
                  required
                />
              </label>
              <label className="md:col-span-2">
                <span className="block text-sm font-medium mb-2">Email</span>
                <input
                  name="email"
                  type="email"
                  className="h-12 w-full rounded-full border border-black/10 px-5 focus:ring-2 focus:ring-emerald-500"
                  placeholder="email@domain.com"
                  required
                />
              </label>
              <label>
                <span className="block text-sm font-medium mb-2">Phone</span>
                <input
                  name="phone"
                  className="h-12 w-full rounded-full border border-black/10 px-5 focus:ring-2 focus:ring-emerald-500"
                  placeholder="+1 222-xxx"
                />
              </label>

              {/* Message + PHI disclaimer */}
              <label className="md:col-span-2">
                <span className="block text-sm font-medium mb-2">Message</span>
                <textarea
                  name="message"
                  id="message"
                  aria-describedby="phi-note"
                  className="min-h-44 w-full rounded-2xl border border-black/10 px-5 py-4 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your message"
                  required
                />
                <p id="phi-note" className="mt-2 text-xs text-gray-600">
                  <span className="font-medium">Privacy note:</span> Please do not enter any personal health information that is not requested here.
                </p>
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-700 px-7 text-white hover:bg-emerald-800 transition"
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </div>

              {sent && (
                <div className="md:col-span-2 mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status" aria-live="polite">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-emerald-900">Message sent!</h3>
                  <p className="mt-1 text-sm text-emerald-800">Thank you — we&apos;ve received your message and will get back to you soon.</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}