"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Cookie } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasAccepted = localStorage.getItem("cookieConsent")
    if (!hasAccepted) {
      // Show banner after a short delay
      setTimeout(() => setIsVisible(true), 1000)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem("cookieConsent", "true")
    setIsVisible(false)
  }

  const dismissBanner = () => {
    // Also consider dismissing as implicit acceptance
    localStorage.setItem("cookieConsent", "true")
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-500">
      <Card className="relative bg-background/95 backdrop-blur-lg border-2 shadow-2xl">
        <button
          onClick={dismissBanner}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-5 pr-10">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Cookie className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground/90 leading-relaxed">
                {t("cookies.banner.message")}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              onClick={acceptCookies}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
            >
              {t("cookies.banner.accept")}
            </Button>
            <Link href="/cookies" className="flex-1">
              <Button variant="outline" className="w-full">
                {t("cookies.banner.learnMore")}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
