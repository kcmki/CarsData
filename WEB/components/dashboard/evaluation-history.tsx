"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"
import { getTranslatedCondition, getTranslatedFuel, getTranslatedTransmission } from "@/lib/translation-helpers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, DollarSign, Download, Eye } from "lucide-react"
import { EvaluationDetailsDialog } from "./evaluation-details-dialog"
import type { Evaluation } from "@/lib/types"

interface EvaluationHistoryProps {
  evaluations: Evaluation[]
}

export function EvaluationHistory({ evaluations }: EvaluationHistoryProps) {
  const { t } = useTranslation()
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const handleViewDetails = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setIsDetailsOpen(true)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">{t("history.noEvaluations")}</p>
          <Button onClick={() => (window.location.href = "/evaluate")}>{t("history.createFirst")}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {evaluations.map((evaluation) => (
        <Card key={evaluation.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">
                  {evaluation.year} {evaluation.make} {evaluation.model}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(evaluation.created_at)}
                  </span>
                  <span>{evaluation.mileage.toLocaleString()} {t("result.km")}</span>
                  <Badge variant={evaluation.condition === "excellent" ? "default" : "secondary"}>
                    {t(`conditions.${evaluation.condition}`) || evaluation.condition}
                  </Badge>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {formatPrice(Number(evaluation.estimated_price))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPrice(Number(evaluation.price_range_min))} - {formatPrice(Number(evaluation.price_range_max))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {evaluation.is_paid ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {t("details.paid")}
                  </Badge>
                                ) : (
                  <Badge variant="outline">{t("details.free")}</Badge>
                )}
                {evaluation.fuel_type && <span className="text-sm text-muted-foreground">{t(`fuel.${evaluation.fuel_type}`) || evaluation.fuel_type}</span>}
                {evaluation.transmission && (
                  <span className="text-sm text-muted-foreground">{t(`transmission.${evaluation.transmission}`) || evaluation.transmission}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleViewDetails(evaluation)}>
                  <Eye className="h-4 w-4 mr-2" />
                  {t("history.viewDetails")}
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {t("history.download")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <EvaluationDetailsDialog
        evaluation={selectedEvaluation}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>
  )
}
