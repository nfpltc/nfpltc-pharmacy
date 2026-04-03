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
  title: "North Falmouth Pharmacy | Long Term Care Pharmacy",
  description: "North Falmouth Pharmacy — Licensed long-term care pharmacy serving Cape Cod since 2013. Blister packaging, medication management, and delivery services.",
  generator: "Next.js",
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
