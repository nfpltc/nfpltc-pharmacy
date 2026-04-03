"use client"

import Image from "next/image"
import Link from "next/link"
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Instagram,
  Clock,
  Printer,
} from "lucide-react"

export function SiteFooter() {
  return (
    <footer
      className="mt-16 bg-gradient-to-r from-emerald-700 to-teal-700 text-white"
      id="contact"
      style={{ boxShadow: "0 -2px 8px rgba(0,0,0,0.1)" }}
    >
      {/* 🔹 Top Info Bar */}
      <div className="py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-8 md:gap-0">
          {/* Phone */}
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 flex-1">
            <Phone className="text-white h-10 w-10" />
            <div>
              <h4 className="font-semibold text-lg text-white">Need Our Services?</h4>
              <p className="text-white/80 text-sm">
                Call: <span className="font-medium">(508) 564-4459</span>
                <br/> Fax: <span className="font-medium">(508) 564-6172</span>
              </p>
            </div>
          </div>

          {/* Work Hours */}
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 flex-1">
            <Clock className="text-white h-10 w-10" />
            <div>
              <h4 className="font-semibold text-lg text-white">Work Hours</h4>
              <p className="text-white/80 text-sm">
                Monday – Friday: <span className="font-medium">8:30 AM – 4:30 PM</span>
              </p>
              <p className="text-white/80 text-sm">
                24/7 : <span className="font-medium">On-Call Support</span>
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 flex-1">
            <Mail className="text-white h-10 w-10" />
            <div>
              <h4 className="font-semibold text-lg text-white">Email Us</h4>
              <p className="text-white/80 text-sm">
                <a
                  href="mailto:wecare@nfpltc.com"
                  className="hover:text-white transition-colors"
                >
                  wecare@nfpltc.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔹 Main Footer */}
      <div className="pt-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-4">
          {/* ✅ Logo & Intro */}
          <div>
            <div className="mb-3 flex items-center gap-2" style={{ lineHeight: 0 }}>
              <Image
                src="/logowhite.svg"
                alt="North Falmouth Pharmacy"
                width={500}
                height={150}
                priority
                style={{
                  height: "clamp(80px, 5vw, 52px)",
                  width: "auto",
                  display: "block",
                }}
              />
            </div>

            <p
              className="text-sm text-white/80 leading-relaxed"
              style={{ maxWidth: "280px" }}
            >
              Trusted locally for over 30 years — delivering personalized pharmacy
              care and long-term care support across Cape Cod and beyond.
            </p>

            {/* ✅ Social Links */}
            <div className="mt-4 flex gap-4 text-white/90">
              <a
                href="https://www.instagram.com/nfpltc/"
                aria-label="Instagram"
                className="hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-5 w-5" />
              </a>

              <a
                href="https://www.linkedin.com/company/North%20Falmouth%20Pharmacy/"
                aria-label="LinkedIn"
                className="hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* ✅ Services */}
          <div>
            <h4 className="mb-3 font-medium text-white">Services</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li>
                <Link
                  href="/services/ltc"
                  className="hover:text-white transition-colors"
                >
                  Long-Term Care Pharmacy
                </Link>
              </li>
              <li>
                <Link
                  href="/services/map-consulting"
                  className="hover:text-white transition-colors"
                >
                  MAP Consulting
                </Link>
              </li>
              <li>
                <Link
                  href="/services/mpchs-student-training"
                  className="hover:text-white transition-colors"
                >
                  MPCHS Student Training
                </Link>
              </li>
              <li>
                <Link
                  href="/services/specialty-schools-medication-support"
                  className="hover:text-white transition-colors"
                >
                  Specialty Schools Medication Support
                </Link>
              </li>
              <li>
                <Link
                  href="/services/free-prescription-delivery"
                  className="hover:text-white transition-colors"
                >
                  Relaible Prescription Delivery
                </Link>
              </li>
              <li>
                <Link
                  href="/services/blister-packaging"
                  className="hover:text-white transition-colors"
                >
                  Blister & Compliance Packaging
                </Link>
              </li>
              <li>
                <Link
                  href="/services/assisted-living"
                  className="hover:text-white transition-colors"
                >
                  Assisted Living & Memory Care
                </Link>
              </li>
              <li>
                <Link
                  href="/services/group-home"
                  className="hover:text-white transition-colors"
                >
                  Group Home & Rest Home Services
                </Link>
              </li>
              <li>
                <Link
                  href="/services/immunizations"
                  className="hover:text-white transition-colors"
                >
                  Immunizations & Clinical Services
                </Link>
              </li>
              <li>
                <Link
                  href="/services/emar"
                  className="hover:text-white transition-colors"
                >
                  eMAR Integration
                </Link>
              </li>
            </ul>
          </div>

          {/* ✅ Company */}
          <div>
            <h4 className="mb-3 font-medium text-white">Company</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* ✅ Contact */}
          <div>
            <h4 className="mb-3 font-medium text-white">Contact</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> (508) 564-4459
              </li>
              <li className="flex items-center gap-2">
                <Printer className="h-4 w-4" /> (508) 564-6172
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> wecare@nfpltc.com
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1" />
                111 County Road, North Falmouth, MA 02556
              </li>
            </ul>
          </div>
        </div>

        {/* ✅ Bottom Bar */}
        <div className="mt-10 border-t border-white/15">
          <div className="mx-auto flex max-w-6xl flex-col md:flex-row items-center justify-between px-4 py-6 text-xs text-white/70 gap-2">
            <p>
              © {new Date().getFullYear()} North Falmouth Pharmacy. All rights reserved.
            </p>
            <p>
              <a
                href="https://www.linkedin.com/company/North%20Falmouth%20Pharmacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Follow us on LinkedIn
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
