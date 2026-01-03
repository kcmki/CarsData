"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Phone, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AccountSettingsProps {
  user: any
  onUpdate: () => void
}

export function AccountSettings({ user, onUpdate }: AccountSettingsProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()

  const handleLogout = () => {
    localStorage.removeItem("user")
    window.location.href = "/"
  }

  const handleSave = () => {
    toast({
      title: t("settings.settingsSaved"),
      description: t("settings.settingsUpdated"),
    })
    setIsEditing(false)
    onUpdate()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.accountInfo")}</CardTitle>
          <CardDescription>{t("settings.manageAccount")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("settings.emailAddress")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={user.email || t("settings.notSet")} disabled={!isEditing} className="pl-10" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("settings.phoneNumber")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" value={user.phone || t("settings.notSet")} disabled={!isEditing} className="pl-10" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.accountStatus")}</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {user.isVerified || user.is_verified ? (
                    <span className="text-green-600 font-medium">{t("settings.verifiedAccount")}</span>
                  ) : (
                    <span className="text-yellow-600 font-medium">{t("settings.pendingVerification")}</span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.memberSince")}</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">
                  {new Date(user.createdAt || user.created_at || Date.now()).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="flex-1">
                  {t("settings.saveChanges")}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 bg-transparent">
                  {t("settings.cancel")}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="flex-1">
                {t("settings.editProfile")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.dangerZone")}</CardTitle>
          <CardDescription>{t("settings.irreversibleActions")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            {t("dashboard.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
