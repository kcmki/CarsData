"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Cookie, Shield, BarChart3, Settings } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { Navigation } from "@/components/landing/navigation"
import { Footer } from "@/components/landing/footer"

export default function CookiesPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Navigation />
      
      <main className="container max-w-4xl mx-auto px-4 py-24">
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Cookie className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-transparent bg-clip-text">
              {t("cookies.page.title")}
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {t("cookies.page.intro")}
          </p>
        </div>

        {/* What Are Cookies */}
        <Card className="mb-6 border-2 hover:border-blue-500/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-blue-600" />
              {t("cookies.page.what.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {t("cookies.page.what.desc")}
            </p>
          </CardContent>
        </Card>

        {/* Types of Cookies */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">{t("cookies.page.types.title")}</h2>
          
          <div className="space-y-4">
            {/* Essential Cookies */}
            <Card className="border-2 hover:border-blue-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                  {t("cookies.page.essential.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {t("cookies.page.essential.desc")}
                </p>
              </CardContent>
            </Card>

            {/* Functional Cookies */}
            <Card className="border-2 hover:border-blue-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-blue-600" />
                  {t("cookies.page.functional.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {t("cookies.page.functional.desc")}
                </p>
              </CardContent>
            </Card>

            {/* Analytics Cookies */}
            <Card className="border-2 hover:border-blue-500/30 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  {t("cookies.page.analytics.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {t("cookies.page.analytics.desc")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Managing Cookies */}
        <Card className="mb-6 border-2 hover:border-blue-500/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              {t("cookies.page.manage.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {t("cookies.page.manage.desc")}
            </p>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 p-6 rounded-xl bg-muted/50 border">
          <p className="text-sm text-muted-foreground mb-2">
            {t("cookies.page.contact")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("cookies.page.updated")}
          </p>
        </div>

        {/* Back to Home Button */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
              Back to Home
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
