"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Car, CreditCard, FileText, Settings, TrendingUp, DollarSign } from "lucide-react"
import { EvaluationHistory } from "./evaluation-history"
import { SubscriptionCard } from "./subscription-card"
import { AccountSettings } from "./account-settings"
import type { Subscription, Evaluation } from "@/lib/types"

interface User {
  id: string
  email?: string
  phone?: string
}

export function DashboardContent() {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Get authenticated user
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (!response.ok) {
        setIsLoading(false)
        return
      }

      const userData = await response.json()
      setUser(userData.user)
      setEvaluations(userData.evaluations || [])
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    window.location.href = "/"
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{t("dashboard.loading")}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{t("dashboard.pleaseSignIn")}</p>
            <Button onClick={() => (window.location.href = "/evaluate")}>{t("dashboard.goToEvaluation")}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalEvaluations = evaluations.length
  const paidEvaluations = evaluations.filter((e) => e.is_paid).length
  const totalSpent = evaluations.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0)

  return (
    <div className="container mx-auto px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.welcomeBack")}, {user.email || user.phone}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          {t("dashboard.signOut")}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalEvaluations")}</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalEvaluations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.paidEvaluations")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{paidEvaluations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalSpent")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">€{totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.status")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              <span className="text-blue-600">{t("dashboard.free")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="evaluations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="evaluations">
            <FileText className="h-4 w-4 mr-2" />
            {t("dashboard.tabs.evaluations")}
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="h-4 w-4 mr-2" />
            {t("dashboard.tabs.subscription")}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            {t("dashboard.tabs.settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evaluations">
          <EvaluationHistory evaluations={evaluations} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionCard user={user} subscription={subscription} onUpdate={loadDashboardData} />
        </TabsContent>

        <TabsContent value="settings">
          <AccountSettings user={user} onUpdate={loadDashboardData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
