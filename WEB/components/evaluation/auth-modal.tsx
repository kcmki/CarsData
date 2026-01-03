"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Mail, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"
import { useAuth } from "@/components/auth-provider"

interface AuthModalProps {
  onComplete: () => void
  onBack: () => void
}

export function AuthModal({ onComplete, onBack }: AuthModalProps) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [step, setStep] = useState<"input" | "verify">("input")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send verification code")
      }

      const data = await response.json()

      toast({
        title: t("auth.codeSent"),
        description: t("auth.checkEmail"),
      })

      // In development, show the code
      if (data.code) {
        toast({
          title: "Development Mode",
          description: `Verification code: ${data.code}`,
        })
      }

      setStep("verify")
    } catch (error: any) {
      toast({
        title: t("auth.error"),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Invalid verification code")
      }

      const data = await response.json()

      login(data.token, data.user)

      toast({
        title: t("auth.success"),
        description: t("auth.verified"),
      })

      onComplete()
    } catch (error: any) {
      toast({
        title: t("auth.error"),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("auth.back")}
        </Button>
        <CardTitle>{step === "input" ? t("auth.enterEmail") : t("auth.verifyTitle")}</CardTitle>
        <CardDescription>
          {step === "input" ? t("auth.enterEmailDesc") : t("auth.verifyDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "input" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="h-4 w-4 inline mr-2" />
                {t("auth.email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.sending")}
                </>
              ) : (
                t("auth.sendCode")
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("auth.code")}</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {t("auth.codeSentTo")} <span className="font-medium">{email}</span>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.verifying")}
                </>
              ) : (
                t("auth.verify")
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("input")}
              disabled={isLoading}
            >
              {t("auth.changeEmail")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
