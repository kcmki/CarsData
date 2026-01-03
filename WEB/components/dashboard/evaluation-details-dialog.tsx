"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"
import { getTranslatedCondition, getTranslatedFuel, getTranslatedTransmission, getTranslatedColor } from "@/lib/translation-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Car, DollarSign, Download, Fuel, Gauge, MapPin, Settings } from "lucide-react"
import type { Evaluation } from "@/lib/types"

interface EvaluationDetailsDialogProps {
  evaluation: Evaluation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EvaluationDetailsDialog({ evaluation, open, onOpenChange }: EvaluationDetailsDialogProps) {
  const { t } = useTranslation()
  if (!evaluation) return null

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
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {evaluation.year} {evaluation.make} {evaluation.model}
          </DialogTitle>
          <DialogDescription>{t("details.title")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price Section */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">{t("result.estimatedValue")}</p>
              <p className="text-4xl font-bold text-foreground mb-2">
                {formatPrice(Number(evaluation.estimated_price))}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("result.range")}: {formatPrice(Number(evaluation.price_range_min))} -{" "}
                {formatPrice(Number(evaluation.price_range_max))}
              </p>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("details.make")}:</span>
                <span className="font-medium">{evaluation.make}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("details.year")}:</span>
                <span className="font-medium">{evaluation.year}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("result.mileage")}:</span>
                <span className="font-medium">{evaluation.mileage.toLocaleString()} {t("result.km")}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("result.condition")}:</span>
                <Badge variant={evaluation.condition === "excellent" ? "default" : "secondary"}>
                  {getTranslatedCondition(t, evaluation.condition)}
                </Badge>
              </div>
              {evaluation.fuel_type && (
                <div className="flex items-center gap-2 text-sm">
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("details.fuel")}:</span>
                  <span className="font-medium">{getTranslatedFuel(t, evaluation.fuel_type)}</span>
                </div>
              )}
              {evaluation.transmission && (
                <div className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("result.transmission")}:</span>
                  <span className="font-medium">{getTranslatedTransmission(t, evaluation.transmission)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Additional Details */}
          {evaluation.color && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("result.color")}</p>
              <p className="text-sm text-muted-foreground">{getTranslatedColor(t, evaluation.color)}</p>
            </div>
          )}

          {evaluation.additional_features && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("details.additionalFeatures")}</p>
              <p className="text-sm text-muted-foreground">{evaluation.additional_features}</p>
            </div>
          )}

          {/* Evaluation Info */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("details.evaluationDate")}:</span>
              <span className="font-medium">{formatDate(evaluation.created_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("details.status")}:</span>
              {evaluation.is_paid ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {t("details.paid")}
                </Badge>
              ) : (
                <Badge variant="outline">{t("details.free")}</Badge>
              )}
            </div>
            {evaluation.payment_amount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("details.amountPaid")}:</span>
                <span className="font-medium">€{Number(evaluation.payment_amount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button className="flex-1" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {t("result.downloadReport")}
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              onClick={() => onOpenChange(false)}
            >
              {t("details.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
