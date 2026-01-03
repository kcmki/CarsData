"use client"
import { EvaluationForm } from "@/components/evaluation/evaluation-form"
import { Navigation } from "@/components/landing/navigation"
import { useTranslation } from "@/lib/i18n"

export default function EvaluatePage() {
  const {t} = useTranslation()
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <EvaluationForm />
          </div>
        </div>
      </main>
    </div>
  )
}
