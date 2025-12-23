import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { FooterInLayout } from "@/components/footer-in-layout"
import { Suspense } from "react"
import { HeaderInLayout } from "@/components/header-in-layout"

export const metadata: Metadata = {
  title: "North Falmouth Pharmacy",
  description: "Trusted pharmacy care for Cape Cod, specializing in long-term care, assisted living, eMAR integration, blister packaging, and clinical services.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          <HeaderInLayout />
          {children}
          <FooterInLayout />
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
