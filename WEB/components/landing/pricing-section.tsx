"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Mail } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useState } from "react"
import { ContactFormModal } from "@/components/evaluation/contact-form-modal"

export function PricingSection() {
  const { t } = useTranslation()
  const [showContactForm, setShowContactForm] = useState(false)

  if (showContactForm) {
    return <ContactFormModal onBack={() => setShowContactForm(false)} />
  }

  return (
    <section id="pricing" className="py-24 relative">
      {/* Background Blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">{t("pricing.title")}</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-center">
          {/* Free Plan */}
          <Card className="relative border-2 bg-background/50 backdrop-blur-sm hover:border-blue-500/30 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-2xl">{t("pricing.free.title")}</CardTitle>
              <CardDescription>{t("pricing.free.description")}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">{t("pricing.free.price")}</span>
                <span className="text-muted-foreground ml-2">{t("pricing.free.period")}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{t("pricing.free.feature1")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{t("pricing.free.feature2")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{t("pricing.free.feature3")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{t("pricing.free.feature4")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{t("pricing.free.feature5")}</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline" onClick={() => (window.location.href = "/evaluate")}>
                {t("pricing.free.cta")}
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-2 border-blue-500 shadow-2xl shadow-blue-500/20 scale-105 bg-background/80 backdrop-blur-md">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-500/30">
              {t("pricing.premium.badge")}
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">{t("pricing.premium.title")}</CardTitle>
              <CardDescription>{t("pricing.premium.description")}</CardDescription>
              <div className="mt-4">
                <span className="text-xl font-bold text-foreground">{t("pricing.premium.price")}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature1")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature2")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature3")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature4")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature5")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="p-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-foreground font-medium">{t("pricing.premium.feature6")}</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25"
                onClick={() => setShowContactForm(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                {t("pricing.premium.cta")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  )
}
