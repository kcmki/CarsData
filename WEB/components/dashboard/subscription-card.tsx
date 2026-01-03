"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Mail, AlertCircle, Zap } from "lucide-react"
import { useState } from "react"
import { ContactFormModal } from "./contact-form-modal"
import type { User } from "@/lib/types"

interface SubscriptionCardProps {
  user: User
  onUpdate: () => void
}

export function SubscriptionCard({ user, onUpdate }: SubscriptionCardProps) {
  const { t } = useTranslation()
  const [showContactForm, setShowContactForm] = useState(false)

  if (showContactForm) {
    return <ContactFormModal onBack={() => setShowContactForm(false)} />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            {t("subscription.freePlan")}
          </CardTitle>
          <CardDescription>{t("subscription.unlimitedDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">{t("subscription.youreOnFree")}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {t("subscription.freeDesc")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">{t("subscription.whatsIncluded")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="text-sm text-muted-foreground">✓ {t("subscription.includes.dailyLimit")}</li>
                  <li className="text-sm text-muted-foreground">✓ {t("subscription.includes.reports")}</li>
                  <li className="text-sm text-muted-foreground">✓ {t("subscription.includes.analysis")}</li>
                  <li className="text-sm text-muted-foreground">✓ {t("subscription.includes.history")}</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-500 shadow-lg">
              <CardHeader>
                <Badge className="w-fit mb-2 bg-blue-600">{t("subscription.premiumAccess")}</Badge>
                <CardTitle className="text-lg">{t("subscription.needMore")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("subscription.customPricing")}
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                  onClick={() => setShowContactForm(true)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t("subscription.requestUnlimited")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
