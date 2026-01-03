import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/lib/i18n"
import { FormdataProvider } from "@/hooks/FormdataProvider"
import { AuthProvider } from "@/components/auth-provider"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "CarValue",
  description: "Créé au SP98",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <Suspense fallback={<div>Loading...</div>}>
          <AuthProvider>
            <LanguageProvider>
              <FormdataProvider>
                {children}
                <CookieConsentBanner />
              </FormdataProvider>
            </LanguageProvider>
          </AuthProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
