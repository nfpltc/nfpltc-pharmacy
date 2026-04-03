"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useMemo } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Phone, Menu, ChevronDown } from "lucide-react"
import { services } from "@/lib/services"

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [formsOpen, setFormsOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const pathname = usePathname()

  const handleNavigate = () => {
    setOpen(false)
    setFormsOpen(false)
    setServicesOpen(false)
  }

  // Primary nav
  const nav = [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
  ]

  // Services dropdown built from the source of truth (services lib)
  const serviceLinks = useMemo(() => {
    return services
      .map((s) => ({
        label: s.title, // you can change to a shorter label field later if you want
        href: `/services/${s.slug}`,
        slug: s.slug,
      }))
      // nice stable ordering (optional). If you want your custom order, I can add an order array.
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname?.startsWith(href + "/")
  }

  return (
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center" onClick={handleNavigate}>
          <Image
            src="/logo.svg"
            alt="North Falmouth Pharmacy"
            width={1000}
            height={300}
            priority
            style={{
              height: "clamp(80px, 5.5vw, 56px)",
              width: "auto",
              display: "block",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))",
            }}
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex relative">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              className={`text-sm transition-colors ${
                isActive(item.href)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* Services Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={servicesOpen}
              className={`flex items-center gap-1 text-sm transition-colors ${
                pathname?.startsWith("/services")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setServicesOpen((v) => !v)}
            >
              Services <ChevronDown className="h-4 w-4" />
            </button>

            <div
              className={`absolute left-0 top-full z-30 mt-1 w-72 rounded-md border bg-white p-1 shadow-lg transition-all duration-150 ${
                servicesOpen ? "opacity-100 visible" : "opacity-0 invisible"
              }`}
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              {serviceLinks.map((item) => (
                <Link
                  key={item.slug}
                  href={item.href}
                  onClick={handleNavigate}
                  className="block rounded-sm px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Statements */}
          <Link
            href="/forms/statements"
            onClick={handleNavigate}
            className={`text-sm transition-colors ${
              pathname === "/forms/statements"
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Statements
          </Link>

          {/* Forms Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setFormsOpen(true)}
            onMouseLeave={() => setFormsOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={formsOpen}
              className={`flex items-center gap-1 text-sm transition-colors ${
                pathname?.startsWith("/forms")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFormsOpen((v) => !v)}
            >
              Forms <ChevronDown className="h-4 w-4" />
            </button>

            <div
              className={`absolute left-0 top-full z-30 mt-1 w-64 rounded-md border bg-white p-1 shadow-lg transition-all duration-150 ${
                formsOpen ? "opacity-100 visible" : "opacity-0 invisible"
              }`}
              onMouseEnter={() => setFormsOpen(true)}
              onMouseLeave={() => setFormsOpen(false)}
            >
              {[
                ["Enrollment Form", "/forms/enrollment"],
                ["Credit Card Update Form", "/forms/credit-card-update"],
                ["Vaccine Consent Form", "/forms/vaccine-consent"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={handleNavigate}
                  className="block rounded-sm px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Call Now */}
        <div className="hidden items-center gap-2 md:flex">
          <a
            href="tel:+15085644459"
            onClick={handleNavigate}
            className="flex items-center gap-2 text-emerald-700 font-medium"
          >
            <Button
              variant="outline"
              className="gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                padding: "6px 14px",
                borderRadius: "8px",
              }}
            >
              <Phone className="h-4 w-4" /> (508) 564-4459
            </Button>
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          aria-label="Open menu"
          className="md:hidden"
          onClick={() => setOpen((p) => !p)}
          style={{ padding: "4px" }}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden animate-fade-in">
          <div className="mx-auto grid max-w-6xl gap-2 px-4 pb-4">
            <Link
              href="/about"
              onClick={handleNavigate}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              About Us
            </Link>

            <Link
              href="/contact"
              onClick={handleNavigate}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              Contact
            </Link>

            {/* Services */}
            <div className="rounded-md border p-2">
              <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                Services
              </div>

              {serviceLinks.map((item) => (
                <Link
                  key={item.slug}
                  href={item.href}
                  onClick={handleNavigate}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <Link
              href="/forms/statements"
              onClick={handleNavigate}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              Statements
            </Link>

            {/* Forms */}
            <div className="rounded-md border p-2">
              <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                Forms
              </div>

              {[
                ["Vaccine Consent Form", "/forms/vaccine-consent"],
                ["Enrollment Form", "/forms/enrollment"],
                ["Credit Card Update Form", "/forms/credit-card-update"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={handleNavigate}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Call Now */}
            <a href="tel:+15085644459" className="mt-2" onClick={handleNavigate}>
              <Button
                variant="outline"
                className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "8px 14px",
                  borderRadius: "8px",
                }}
              >
                <Phone className="h-4 w-4" /> (508) 564-4459
              </Button>
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
