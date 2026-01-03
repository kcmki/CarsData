"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, TrendingUp, DollarSign, FileText, Download } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { getTranslatedFuel, getTranslatedTransmission, getTranslatedColor } from "@/lib/translation-helpers"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useState } from "react"

// Helper function to extract year from ISO date string or return year as-is
const extractYear = (dateOrYear: string | number): string => {
  if (!dateOrYear) return ""
  const dateStr = String(dateOrYear)
  // If it's an ISO date string, extract the year (first 4 characters)
  if (dateStr.includes("-") || dateStr.includes("T")) {
    return dateStr.substring(0, 4)
  }
  // If it's just a year, return it
  return dateStr.length > 4 ? dateStr.substring(0, 4) : dateStr
}

interface EvaluationResultProps {
  result: {
    estimatedPrice: number
    priceRangeMin: number
    priceRangeMax: number
    evaluationNotes: string
    similarCars: Array<{
      id: string
      make: string
      model: string
      year: number
      price: number
      mileage: number
      fuel?: string
      transmission?: string
      color?: string
      doors?: number | string
      seats?: number | string
      horsepower?: number | string
      url?: string
    }>
  }
  carData: {
    carBrand?: string
    make?: string
    carModel?: string
    model?: string
    regdate?: string
    year?: string
    mileage: string | number
    fuelLabel?: string
    fuelType?: string
    gearboxLabel?: string
    transmission?: string
    vehiculeColor?: string
    color?: string
    doors?: string
    seats?: string
    horsepowerDin?: string
    subject?: string
  }
  evaluationsRemaining?: number
  onNewEvaluation: () => void
}

export function EvaluationResult({ result, carData, evaluationsRemaining, onNewEvaluation }: EvaluationResultProps) {
  const { t } = useTranslation()
  const [hoveredCar, setHoveredCar] = useState<string | null>(null)

  // Normalize car data to handle both form field names and mapped names
  const normalizedCarData = {
    year: carData.year || carData.regdate,
    make: carData.make || carData.carBrand,
    model: carData.model || carData.carModel,
    mileage: carData.mileage,
    fuelType: carData.fuelType || carData.fuelLabel,
    transmission: carData.transmission || carData.gearboxLabel,
    color: carData.color || carData.vehiculeColor,
    doors: carData.doors,
    seats: carData.seats,
    horsepowerDin: carData.horsepowerDin,
    subject: carData.subject,
  }

  const chartData = [
    {
      id: "user-car",
      x: Number.parseInt(normalizedCarData.mileage.toString()),
      y: result.estimatedPrice,
      name: `${extractYear(normalizedCarData.year)} (Your Car)`,
      isUserCar: true,
      price: result.estimatedPrice,
      mileage: normalizedCarData.mileage,
    },
    ...result.similarCars.map((car) => ({
      id: car.id,
      x: car.mileage,
      y: car.price,
      name: `${extractYear(car.year)}`,
      isUserCar: false,
      price: car.price,
      mileage: car.mileage,
    })),
  ]

  // Calculate dynamic axis domains based on actual data
  const mileages = chartData.map((d) => d.x)
  const prices = chartData.map((d) => d.y)
  
  const minMileage = Math.min(...mileages)
  const maxMileage = Math.max(...mileages)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  
  // Add 10% padding to make the chart more readable
  const mileagePadding = (maxMileage - minMileage) * 0.1
  const pricePadding = (maxPrice - minPrice) * 0.1
  
  const xAxisDomain = [
    Math.max(0, minMileage - mileagePadding),
    maxMileage + mileagePadding
  ]
  const yAxisDomain = [
    Math.max(0, minPrice - pricePadding),
    maxPrice + pricePadding
  ]

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const userCarData = chartData[0]

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
        <CardContent>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100">{t("result.complete")}</h3>
              <p className="text-green-700 dark:text-green-300">{t("result.ready")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <div className="grid md:grid-cols-2 gap-6">


          {/* Right Side - Price and Chart */}
          <div className="md:col-span-2 space-y-4">
            {/* Estimated Price */}
            <Card className="border-2 bg-linear-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
              <CardContent className="pt-8">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">{t("result.estimatedValue")}</span>
                  </div>
                  <div className="text-5xl font-bold text-foreground">{formatPrice(result.estimatedPrice)}</div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground pt-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">
                      {t("result.range")}: {formatPrice(result.priceRangeMin)} - {formatPrice(result.priceRangeMax)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">{t("result.marketComparison")}</CardTitle>
                <CardDescription>{t("result.chartDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={t("result.mileage")}
                      domain={xAxisDomain}
                      ticks={[Math.floor(xAxisDomain[0]), Math.ceil(xAxisDomain[1])]}
                      label={{ value: `${t("result.mileage")} (${t("result.km")})`, position: "insideBottomRight", offset: -5 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={t("result.price")}
                      domain={yAxisDomain}
                      ticks={[Math.floor(yAxisDomain[0]), Math.ceil(yAxisDomain[1])]}
                      label={{ value: t("result.priceLabel"), angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-sm">{data.name}</p>
                              <p className="text-xs text-muted-foreground">{t("result.price")}: {formatPrice(data.price)}</p>
                              <p className="text-xs text-muted-foreground">{t("result.mileage")}: {data.mileage.toLocaleString()} {t("result.km")}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    {/* Similar cars in blue */}
                    <Scatter
                      name={t("result.similarCars")}
                      data={chartData.filter((d) => !d.isUserCar)}
                      fill="#3b82f6"
                      onMouseEnter={(data) => setHoveredCar(data.id)}
                      onMouseLeave={() => setHoveredCar(null)}
                      shape={<ScatterPoint />}
                    />
                    {/* User car in green/highlight */}
                    <Scatter
                      name={t("result.yourCar")}
                      data={chartData.filter((d) => d.isUserCar)}
                      fill="#10b981"
                      shape={<ScatterPoint isUserCar />}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Evaluation Notes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold">{t("result.evaluationNotes")}</h4>
              </div>
              <p className="text-muted-foreground">{result.evaluationNotes}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                <Download className="mr-2 h-4 w-4" />
                {t("result.downloadReport")}
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent" onClick={onNewEvaluation}>
                {t("result.newEvaluation")}
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed Similar Cars Comparison */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("result.detailedComparison")}</CardTitle>
            <CardDescription>{t("result.comparisonDesc") || "Detailed information about similar cars on the market"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Your Car Summary */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.yourCar")}</p>
                    <p className="text-sm font-semibold">{extractYear(normalizedCarData.year)} {normalizedCarData.make} {normalizedCarData.model}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.price")}</p>
                    <p className="text-sm font-bold text-green-600">{formatPrice(result.estimatedPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.mileage")}</p>
                    <p className="text-sm font-semibold">{Number.parseInt(normalizedCarData.mileage.toString()).toLocaleString()} {t("result.km")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.fuelType")}</p>
                    <p className="text-sm font-semibold capitalize">{getTranslatedFuel(t, normalizedCarData.fuelType)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.transmission")}</p>
                    <p className="text-sm font-semibold capitalize">{getTranslatedTransmission(t, normalizedCarData.transmission)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">{t("result.color")}</p>
                    <p className="text-sm font-semibold capitalize">{getTranslatedColor(t, normalizedCarData.color)}</p>
                  </div>
                </div>
              </div>

              {/* Similar Cars Grid */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">{t("result.marketComparables")} ({result.similarCars.length})</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.similarCars.map((car, index) => {
                    const priceDiff = car.price - result.estimatedPrice
                    const priceDiffPercent = ((priceDiff / result.estimatedPrice) * 100).toFixed(1)
                    const mileageDiff = car.mileage - Number.parseInt(normalizedCarData.mileage.toString())
                    
                    return (
                      <div
                        key={car.id}
                        className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onMouseEnter={() => setHoveredCar(car.id)}
                        onMouseLeave={() => setHoveredCar(null)}
                      >
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-base">{extractYear(car.year)}</p>
                              <p className="text-xs text-muted-foreground">{t("result.comparable")} #{index + 1}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{formatPrice(car.price)}</p>
                              <p className={`text-xs font-semibold ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {priceDiff > 0 ? '+' : ''}{formatPrice(priceDiff)} ({priceDiffPercent}%)
                              </p>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">{t("result.mileage")}</p>
                              <p className="font-semibold">{car.mileage.toLocaleString()} {t("result.km")}</p>
                              <p className={`text-xs ${mileageDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {mileageDiff > 0 ? '+' : ''}{mileageDiff.toLocaleString()} {t("result.km")}
                              </p>
                            </div>
                            {car.fuel && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.fuelType")}</p>
                                <p className="font-semibold capitalize">{getTranslatedFuel(t, car.fuel)}</p>
                              </div>
                            )}
                            {car.transmission && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.transmission")}</p>
                                <p className="font-semibold capitalize">{getTranslatedTransmission(t, car.transmission)}</p>
                              </div>
                            )}
                            {car.color && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.color")}</p>
                                <p className="font-semibold capitalize">{getTranslatedColor(t, car.color)}</p>
                              </div>
                            )}
                            {car.doors && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.doors")}</p>
                                <p className="font-semibold">{car.doors}</p>
                              </div>
                            )}
                            {car.seats && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.seats")}</p>
                                <p className="font-semibold">{car.seats}</p>
                              </div>
                            )}
                            {car.horsepower && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">{t("result.horsepower")}</p>
                                <p className="font-semibold">{car.horsepower} DIN</p>
                              </div>
                            )}
                          </div>

                          {/* Link Button */}
                          {car.url && (
                            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                              <a href={car.url} target="_blank" rel="noopener noreferrer">
                                {t("result.viewListing")} ↗
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-4">{t("result.complete")}</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  {t("result.evaluationsRemaining").replace("{count}", String(evaluationsRemaining))}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  {t("result.needUnlimited")}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

function ScatterPoint({ cx, cy, fill, isUserCar }: any) {
  if (isUserCar) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={fill} />
        <circle cx={cx} cy={cy} r={12} fill="none" stroke={fill} strokeWidth={2} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={6} fill={fill} />
}
