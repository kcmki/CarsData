"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Car, AlertCircle, CheckCircle, Sparkles, ChevronRight, Check } from "lucide-react"
import { VerificationModal } from "./verification-modal"
import { EvaluationResult } from "./evaluation-result"
import { ContactFormModal } from "./contact-form-modal"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"
import { useFormData } from "@/hooks/FormdataProvider"
import { SearchSelect } from "@/components/ui/search-select"
import { useAuth } from "@/components/auth-provider"

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

const DEMO_MODE = false // Set to false to disable demo mode

export function EvaluationForm() {
  const { t } = useTranslation()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { 
    brands, models, colors, countries, cities, fuelTypes, gearboxTypes,
    setSelectedBrand, setSelectedCountry, loading: isLoadingOptions,
    loadingModels, loadingCities
  } = useFormData()
  
  const [step, setStep] = useState<"form" | "verification" | "contact" | "result">("form")
  const [isLoading, setIsLoading] = useState(false)
  const [useFancyMode, setUseFancyMode] = useState(!user) // Default to fancy for non-logged-in, simple for logged-in
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1) // Multi-step form progress
  
  const [formData, setFormData] = useState({
    carBrand: "",
    carModel: "",
    regdate: "",
    mileage: "",
    fuelLabel: "",
    gearboxLabel: "",
    vehiculeColor: "",
    subject: "",
    locationCountryId: "",
    locationCity: "",
    doors: "",
    seats: "",
    horsepowerDin: "",
  })
  const [evaluationResult, setEvaluationResult] = useState<any>(null)
  const [noSimilarCarsError, setNoSimilarCarsError] = useState<{ brand: string; model: string } | null>(null)
  const [contactInfo, setContactInfo] = useState({ email: "", phone: "" })
  const [evaluationsUsedToday, setEvaluationsUsedToday] = useState(0)
  const [evaluationsRemaining, setEvaluationsRemaining] = useState(10)
  const { toast } = useToast()

  // Restore state from URL on mount
  useEffect(() => {
    const urlStep = searchParams.get("step") as any
    const evaluationId = searchParams.get("evaluationId")

    if (evaluationId && urlStep === "result") {
      try {
        const cached = localStorage.getItem(`evaluation_${evaluationId}`)
        if (cached) {
          const { result, carData, contactInfo: savedContactInfo } = JSON.parse(cached)
          setEvaluationResult(result)
          setFormData(carData)
          if (savedContactInfo) {
            setContactInfo(savedContactInfo)
          }
          setStep("result")
        }
      } catch (error) {
        console.error("Failed to restore evaluation state from localStorage:", error)
      }
    }
  }, [searchParams])

  // Keep contact info in sync with authenticated user for a consistent header/form state
  useEffect(() => {
    if (user) {
      setContactInfo({ email: user.email || "", phone: user.phone || "" })
    }
  }, [user])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Reset model when brand changes
    if (field === "carBrand") {
      setSelectedBrand(value)
      setFormData((prev) => ({ ...prev, carModel: "" }))
    }
    // Reset city when country changes
    if (field === "locationCountryId") {
      setSelectedCountry(value)
      setFormData((prev) => ({ ...prev, locationCity: "" }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please authenticate to run an evaluation. We keep you signed in with secure session cookies.",
        variant: "destructive",
      })
      setIsLoading(false)
      setStep("verification")
      return
    }

    try {
      const response = await fetch("/api/evaluations/check-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactInfo.email,
          phone: contactInfo.phone,
        }),
      })

      const limitData = await response.json()

      if (response.status === 429) {
        toast({
          title: "Daily Limit Reached",
          description: limitData.message || "You've reached your daily limit of 10 evaluations.",
          variant: "destructive",
        })
        setIsLoading(false)
        setStep("contact")
        return
      }

      setEvaluationsRemaining(limitData.evaluationsRemaining)
      setEvaluationsUsedToday(limitData.evaluationsUsedToday)

      // Proceed with evaluation using new API
      const evalResponse = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carBrand: formData.carBrand,
          carModel: formData.carModel,
          regdate: formData.regdate,
          mileage: formData.mileage,
          fuelLabel: formData.fuelLabel,
          gearboxLabel: formData.gearboxLabel,
          vehiculeColor: formData.vehiculeColor,
          subject: formData.subject,
          locationCountryId: formData.locationCountryId,
          locationCity: formData.locationCity,
          doors: formData.doors,
          seats: formData.seats,
          horsepowerDin: formData.horsepowerDin,
          userId: contactInfo.email, // Use email as userId for now
        }),
      })

      const data = await evalResponse.json()
      console.log("Evaluation API Response:", data)
      
      // Check for "no similar cars found" error
      if (data.error === "No similar cars found" || data.error?.includes("No similar cars")) {
        setNoSimilarCarsError({
          brand: formData.carBrand,
          model: formData.carModel,
        })
        setIsLoading(false)
        setStep("result")
        return
      }
      
      if (!evalResponse.ok) {
        throw new Error(data.error || data.message || "Failed to create evaluation")
      }
      console.log("Response is ok")
      
      // Transform API response to match existing result format
      const prediction = data.prediction || {}
      const metadata = data.metadata || {}
      const similarCarsData = data.similarCars || []
      const evaluationId = data.evaluationId || `eval_${Date.now()}`
      
      const resultData = {
        estimatedPrice: prediction.estimatedPrice || 0,
        priceRangeMin: prediction.priceRangeMin || 0,
        priceRangeMax: prediction.priceRangeMax || 0,
        confidence: prediction.confidence || 0,
        evaluationId: evaluationId,
        similarCars: similarCarsData.map((car: any, index: number) => ({
          id: (car.id || index).toString(),
          make: car.carBrand || "N/A",
          model: car.carModel || "N/A",
          year: car.regdate || car.year || "",
          price: car.price || 0,
          mileage: car.mileage || 0,
          fuelLabel: car.fuelLabel || "",
          gearboxLabel: car.gearboxLabel || "",
          vehiculeColor: car.vehiculeColor || "",
          doors: car.doors || "",
          seats: car.seats || "",
          horsepowerDin: car.horsepowerDin || "",
        })),
        evaluationNotes: `Based on ${metadata.totalSimilarCars || similarCarsData.length} similar cars in our database. Confidence: ${Math.round((prediction.confidence || 0) * 100)}%`,
      }
      
      setEvaluationResult(resultData)
      setNoSimilarCarsError(null)
      
      // Save to localStorage and update URL with evaluationId
      localStorage.setItem(
        `evaluation_${evaluationId}`,
        JSON.stringify({
          result: resultData,
          carData: formData,
          contactInfo: contactInfo,
        })
      )
      
      router.push(`/evaluate?step=result&evaluationId=${evaluationId}`)
      setIsLoading(false)
      setStep("result")
      console.log(evaluationResult)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleVerificationComplete = (email: string, phone: string) => {
    setContactInfo({ email, phone })
    setStep("form")
  }

  const handleNewEvaluation = () => {
    // Clear URL params when starting a new evaluation
    router.push("/evaluate")
    setStep("form")
    setEvaluationResult(null)
    setNoSimilarCarsError(null)
    setFormData({
      carBrand: "",
      carModel: "",
      regdate: "",
      mileage: "",
      fuelLabel: "",
      gearboxLabel: "",
      vehiculeColor: "",
      subject: "",
      locationCountryId: "",
      locationCity: "",
      doors: "",
      seats: "",
      horsepowerDin: "",
    })
  }


  if (step === "verification") {
    return <VerificationModal onComplete={handleVerificationComplete} onBack={() => setStep("form")} />
  }

  if (step === "contact") {
    return <ContactFormModal onBack={() => setStep("form")} />
  }

  // Handle "no similar cars found" error state
  if (step === "result" && noSimilarCarsError) {
    return (
      <Card className="border-2 border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="h-6 w-6" />
            {t("eval.noResultsTitle") || "No Matching Cars Found"}
          </CardTitle>
          <CardDescription className="text-orange-600">
            {(t("eval.noResultsMessage") || "We couldn't find similar {brand} {model} vehicles in our database")
              .replace("{brand}", noSimilarCarsError.brand)
              .replace("{model}", noSimilarCarsError.model)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-white p-4 border border-orange-200">
            <h4 className="font-medium text-gray-900 mb-2">{t("eval.searchedFor") || "We searched for:"}</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div><span className="font-medium">{t("eval.make") || "Make"}:</span> {formData.carBrand}</div>
              <div><span className="font-medium">{t("eval.model") || "Model"}:</span> {formData.carModel}</div>
              <div><span className="font-medium">{t("eval.year") || "Year"}:</span> {formData.regdate}</div>
              <div><span className="font-medium">{t("eval.mileage") || "Mileage"}:</span> {formData.mileage} km</div>
            </div>
          </div>
          
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">{t("eval.suggestions") || "Suggestions:"}</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>{t("eval.suggestionCheckSpelling") || "Check the spelling of the brand and model"}</li>
              <li>{t("eval.suggestionTryDifferent") || "Try a different model or variant name"}</li>
              <li>{t("eval.suggestionContactSupport") || "Contact support if you believe this is an error"}</li>
            </ul>
          </div>
          
          <Button 
            onClick={() => {
              setNoSimilarCarsError(null)
              setStep("form")
            }} 
            className="w-full"
          >
            <Car className="h-4 w-4 mr-2" />
            {t("result.newEvaluation") || "Try Another Evaluation"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === "result" && evaluationResult) {
    return (
      <EvaluationResult
        result={evaluationResult}
        carData={formData}
        evaluationsRemaining={evaluationsRemaining}
        onNewEvaluation={handleNewEvaluation}
      />
    )
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-6 w-6 text-blue-600" />
          {t("eval.title")}
        </CardTitle>
        <CardDescription>{t("eval.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingOptions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-muted-foreground">{t("common.loading")}</span>
          </div>
        ) : (
          <>
            {/* Form Mode Toggle - only show for logged-in users */}
            {user && !authLoading && (
              <div className="mb-6 flex gap-2">
                <Button
                  variant={!useFancyMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setUseFancyMode(false); setFormStep(1); }}
                >
                  Quick Evaluate
                </Button>
                <Button
                  variant={useFancyMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setUseFancyMode(true); setFormStep(1); }}
                  className="gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Fancy Mode
                </Button>
              </div>
            )}

            {/* Fancy Multi-step Form for non-logged-in or when selected */}
            {useFancyMode ? (
              <FancyMultiStepForm
                formData={formData}
                formStep={formStep}
                setFormStep={setFormStep}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                user={user}
                authLoading={authLoading}
                isLoading={isLoading}
                setStep={setStep}
                contactInfo={contactInfo}
                setContactInfo={setContactInfo}
                evaluationsRemaining={evaluationsRemaining}
                brands={brands}
                models={models}
                colors={colors}
                countries={countries}
                cities={cities}
                fuelTypes={fuelTypes}
                gearboxTypes={gearboxTypes}
                isLoadingOptions={isLoadingOptions}
                loadingModels={loadingModels}
                loadingCities={loadingCities}
                years={years}
                t={t}
              />
            ) : (
              /* Simple Form for logged-in users */
              <SimpleForm
                formData={formData}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                user={user}
                authLoading={authLoading}
                isLoading={isLoading}
                setStep={setStep}
                contactInfo={contactInfo}
                evaluationsRemaining={evaluationsRemaining}
                brands={brands}
                models={models}
                colors={colors}
                countries={countries}
                cities={cities}
                fuelTypes={fuelTypes}
                gearboxTypes={gearboxTypes}
                isLoadingOptions={isLoadingOptions}
                loadingModels={loadingModels}
                loadingCities={loadingCities}
                years={years}
                t={t}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Simple form component for quick evaluations
 */
function SimpleForm({
  formData,
  handleInputChange,
  handleSubmit,
  user,
  authLoading,
  isLoading,
  setStep,
  contactInfo,
  evaluationsRemaining,
  brands,
  models,
  colors,
  countries,
  cities,
  fuelTypes,
  gearboxTypes,
  isLoadingOptions,
  loadingModels,
  loadingCities,
  years,
  t,
}: any) {
  return (
    <>
      {(!user || authLoading) && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg">
          <p className="text-sm font-semibold text-foreground">{t("auth.requiredTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("auth.requiredDesc")}
          </p>
          {authLoading ? (
            <p className="text-sm text-muted-foreground mt-2">{t("auth.checkingSession")}</p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setStep("verification")}
            >
              {t("auth.authToContinue")}
            </Button>
          )}
        </div>
      )}

      {user && !authLoading && (
        <div className="mb-4 text-sm text-muted-foreground">
          {t("auth.signedInAs").replace("{identifier}", user.email || user.phone || "")}&nbsp;{t("auth.sessionActive")}
        </div>
      )}

      {evaluationsRemaining <= 3 && evaluationsRemaining > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900 dark:text-yellow-100">
              Only {evaluationsRemaining} evaluations left today
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              You can request unlimited access through our contact form.
            </p>
          </div>
        </div>
      )}

      {(contactInfo.email || contactInfo.phone) && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">Verified Contact</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{contactInfo.email || contactInfo.phone}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Make and Model */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="carBrand">{t("eval.make")} *</Label>
            <SearchSelect
              value={formData.carBrand}
              onChange={(value) => handleInputChange("carBrand", value)}
              options={brands}
              placeholder={t("eval.selectMake")}
              searchPlaceholder="Search make..."
              isLoading={isLoadingOptions}
              disabled={isLoadingOptions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="carModel">{t("eval.model")} *</Label>
            <SearchSelect
              value={formData.carModel}
              onChange={(value) => handleInputChange("carModel", value)}
              options={models}
              placeholder={formData.carBrand ? t("eval.selectModel") : t("eval.selectMakeFirst")}
              searchPlaceholder="Search model..."
              isLoading={loadingModels}
              disabled={!formData.carBrand}
            />
          </div>
        </div>

        {/* Year and Mileage */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="regdate">{t("eval.year")} *</Label>
            <Select value={formData.regdate} onValueChange={(value) => handleInputChange("regdate", value)} required>
              <SelectTrigger id="regdate">
                <SelectValue placeholder={t("eval.selectYear")} />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage">{t("eval.mileage")} *</Label>
            <Input
              id="mileage"
              type="number"
              placeholder={t("eval.mileagePlaceholder")}
              value={formData.mileage}
              onChange={(e) => handleInputChange("mileage", e.target.value)}
              required
            />
          </div>
        </div>

        {/* Doors and Seats */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="doors">{t("eval.doors")}</Label>
            <Select value={formData.doors} onValueChange={(value) => handleInputChange("doors", value)}>
              <SelectTrigger id="doors">
                <SelectValue placeholder={t("eval.selectDoors")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seats">{t("eval.seats")}</Label>
            <Select value={formData.seats} onValueChange={(value) => handleInputChange("seats", value)}>
              <SelectTrigger id="seats">
                <SelectValue placeholder={t("eval.selectSeats")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fuel Type and Transmission */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fuelLabel">{t("eval.fuelType")}</Label>
            <SearchSelect
              value={formData.fuelLabel}
              onChange={(value) => handleInputChange("fuelLabel", value)}
              options={fuelTypes}
              placeholder={t("eval.selectFuel")}
              searchPlaceholder="Search fuel type..."
              isLoading={isLoadingOptions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gearboxLabel">{t("eval.transmission")}</Label>
            <SearchSelect
              value={formData.gearboxLabel}
              onChange={(value) => handleInputChange("gearboxLabel", value)}
              options={gearboxTypes}
              placeholder={t("eval.selectTransmission")}
              searchPlaceholder="Search transmission..."
              isLoading={isLoadingOptions}
            />
          </div>
        </div>

        {/* Color and Horsepower */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vehiculeColor">{t("eval.color")}</Label>
            <SearchSelect
              value={formData.vehiculeColor}
              onChange={(value) => handleInputChange("vehiculeColor", value)}
              options={colors}
              placeholder={t("eval.colorPlaceholder")}
              searchPlaceholder="Search color..."
              isLoading={isLoadingOptions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="horsepowerDin">{t("eval.horsepower")}</Label>
            <Input
              id="horsepowerDin"
              type="number"
              placeholder={t("eval.horsepowerPlaceholder")}
              value={formData.horsepowerDin}
              onChange={(e) => handleInputChange("horsepowerDin", e.target.value)}
            />
          </div>
        </div>

        {/* Location Fields */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="locationCountryId">{t("eval.country")}</Label>
            <SearchSelect
              value={formData.locationCountryId}
              onChange={(value) => handleInputChange("locationCountryId", value)}
              options={countries}
              placeholder={t("eval.countryPlaceholder")}
              searchPlaceholder="Search country..."
              isLoading={isLoadingOptions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationCity">{t("eval.city")}</Label>
            <SearchSelect
              value={formData.locationCity}
              onChange={(value) => handleInputChange("locationCity", value)}
              options={cities}
              placeholder={formData.locationCountryId ? t("eval.cityPlaceholder") : t("eval.selectCountryFirst")}
              searchPlaceholder="Search city..."
              isLoading={loadingCities}
              disabled={!formData.locationCountryId}
            />
          </div>
        </div>

        {/* Subject/Description */}
        <div className="space-y-2">
          <Label htmlFor="subject">{t("eval.description")}</Label>
          <Textarea
            id="subject"
            placeholder={t("eval.descriptionPlaceholder")}
            value={formData.subject}
            onChange={(e) => handleInputChange("subject", e.target.value)}
            rows={3}
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
          size="lg"
          disabled={isLoading || (!contactInfo.email && !contactInfo.phone)}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("eval.processing")}
            </>
          ) : (
            t("eval.submit")
          )}
        </Button>
      </form>
    </>
  )
}

/**
 * Fancy multi-step form with animations
 */
function FancyMultiStepForm({
  formData,
  formStep,
  setFormStep,
  handleInputChange,
  handleSubmit,
  user,
  authLoading,
  isLoading,
  setStep,
  contactInfo,
  evaluationsRemaining,
  brands,
  models,
  colors,
  countries,
  cities,
  fuelTypes,
  gearboxTypes,
  isLoadingOptions,
  loadingModels,
  loadingCities,
  years,
  t,
}: any) {
  const isStep1Valid = formData.carBrand && formData.carModel
  const isStep2Valid = formData.regdate && formData.mileage

  const steps = [
    { id: 1, title: t("eval.vehicle"), icon: Car },
    { id: 2, title: t("eval.details"), icon: AlertCircle },
    { id: 3, title: t("eval.description"), icon: CheckCircle },
  ]

  return (
    <div className="w-full max-w-4xl mx-auto">
      <style jsx>{`
        @keyframes gradientShimmer {
          0%, 100% {
            background-position: 0% center;
          }
          50% {
            background-position: 100% center;
          }
        }
        .progress-line {
          animation: gradientShimmer 3s ease-in-out infinite;
        }
      `}</style>
      
      {/* Stepper */}
      <div className="mb-12 relative h-16">
        {/* Background line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200/90 dark:bg-gray-700/80 rounded-full" />
        
        {/* Animated progress line */}
        <div 
          className="progress-line absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-all duration-700 ease-in-out"
          style={{ 
            width: `${((formStep - 1) / (steps.length - 1)) * 100}%`,
            background: 'linear-gradient(90deg, #60a5fa, #38bdf8, #22d3ee, #38bdf8, #60a5fa)',
            backgroundSize: '180% 100%',
            boxShadow: '0 2px 8px rgba(56, 189, 248, 0.2)',
            minWidth: formStep === 1 ? '0' : '6px',
          }}
        />
        
        <div className="flex items-center justify-between w-full relative z-10">
          {steps.map((step) => {
            const Icon = step.icon
            const isActive = formStep >= step.id
            const isCompleted = formStep > step.id
            const isCurrent = formStep === step.id
            
            return (
              <div key={step.id} className="flex flex-col items-center bg-background px-4">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isActive 
                      ? "border-blue-600 bg-blue-600 text-white shadow-lg scale-110" 
                      : "border-gray-200 dark:border-gray-700 text-gray-400 bg-background"
                  }`}
                >
                  {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`mt-3 text-sm font-medium transition-colors duration-300 ${
                  isCurrent ? "text-blue-600 font-bold" : isActive ? "text-gray-700 dark:text-gray-300" : "text-gray-400"
                }`}>
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Content */}
      <Card className="border-none shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6 md:p-10">
          
          {/* Step Header */}
          <div className="mb-8 text-center md:text-left border-b pb-4 border-gray-100 dark:border-gray-800">
             <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
               {t("eval.stepProgress").replace("{current}", formStep.toString()).replace("{total}", "3")}
             </span>
             <h2 className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{steps[formStep-1].title}</h2>
             <p className="text-muted-foreground mt-1">
               {formStep === 1 && t("eval.step1Description")}
               {formStep === 2 && t("eval.step2Description").replace("{brand}", formData.carBrand || "").replace("{model}", formData.carModel || "")}
               {formStep === 3 && t("eval.step3Description")}
             </p>
          </div>

          {/* Grid Container for Steps */}
          <div className="grid grid-cols-1 relative ">
            
            {/* Step 1: Vehicle Selection */}
            <div
              className={`w-full transition-all duration-500 ease-in-out flex flex-col ${
                formStep === 1
                  ? "relative col-start-1 row-start-1 opacity-100 translate-x-0 pointer-events-auto z-10"
                  : formStep > 1
                    ? "absolute top-0 left-0 opacity-0 -translate-x-full pointer-events-none z-0"
                    : "absolute top-0 left-0 opacity-0 translate-x-full pointer-events-none z-0"
              }`}
            >
              <div className="space-y-8 flex-1">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="carBrand" className="text-base font-medium">{t("eval.make")} <span className="text-red-500">*</span></Label>
                    <SearchSelect
                      value={formData.carBrand}
                      onChange={(value) => handleInputChange("carBrand", value)}
                      options={brands}
                      placeholder={t("eval.selectMake")}
                      searchPlaceholder="Search make..."
                      isLoading={isLoadingOptions}
                      disabled={isLoadingOptions}
                      className="h-12 text-base w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="carModel" className="text-base font-medium">{t("eval.model")} <span className="text-red-500">*</span></Label>
                    <SearchSelect
                      value={formData.carModel}
                      onChange={(value) => handleInputChange("carModel", value)}
                      options={models}
                      placeholder={formData.carBrand ? t("eval.selectModel") : t("eval.selectMakeFirst")}
                      searchPlaceholder="Search model..."
                      isLoading={loadingModels}
                      disabled={!formData.carBrand}
                      className="h-12 text-base w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <Button
                  onClick={() => setFormStep(2)}
                  disabled={!isStep1Valid}
                  className="w-full h-12 text-lg font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Continue <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Step 2: Vehicle Details */}
            <div
              className={`w-full transition-all duration-500 ease-in-out flex flex-col ${
                formStep === 2
                  ? "relative col-start-1 row-start-1 opacity-100 translate-x-0 pointer-events-auto z-10"
                  : formStep > 2
                    ? "absolute top-0 left-0 opacity-0 -translate-x-full pointer-events-none z-0"
                    : "absolute top-0 left-0 opacity-0 translate-x-full pointer-events-none z-0"
              }`}
            >
              <div className="space-y-8 flex-1">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="regdate" className="text-base font-medium">{t("eval.year")} <span className="text-red-500">*</span></Label>
                    <Select value={formData.regdate} onValueChange={(value) => handleInputChange("regdate", value)} required>
                      <SelectTrigger id="regdate" className="h-12 text-base w-full">
                        <SelectValue placeholder={t("eval.selectYear")} />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="mileage" className="text-base font-medium">{t("eval.mileage")} <span className="text-red-500">*</span></Label>
                    <Input
                      id="mileage"
                      type="number"
                      placeholder={t("eval.mileagePlaceholder")}
                      value={formData.mileage}
                      onChange={(e) => handleInputChange("mileage", e.target.value)}
                      required
                      className="h-12 text-base w-full"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="doors" className="text-base font-medium">{t("eval.doors")}</Label>
                    <Select value={formData.doors} onValueChange={(value) => handleInputChange("doors", value)}>
                      <SelectTrigger id="doors" className="h-12 text-base w-full">
                        <SelectValue placeholder={t("eval.selectDoors")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="seats" className="text-base font-medium">{t("eval.seats")}</Label>
                    <Select value={formData.seats} onValueChange={(value) => handleInputChange("seats", value)}>
                      <SelectTrigger id="seats" className="h-12 text-base w-full">
                        <SelectValue placeholder={t("eval.selectSeats")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="7">7</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="fuelLabel" className="text-base font-medium">{t("eval.fuelType")}</Label>
                    <SearchSelect
                      value={formData.fuelLabel}
                      onChange={(value) => handleInputChange("fuelLabel", value)}
                      options={fuelTypes}
                      placeholder={t("eval.selectFuel")}
                      searchPlaceholder="Search fuel type..."
                      isLoading={isLoadingOptions}
                      className="h-12 text-base w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="gearboxLabel" className="text-base font-medium">{t("eval.transmission")}</Label>
                    <SearchSelect
                      value={formData.gearboxLabel}
                      onChange={(value) => handleInputChange("gearboxLabel", value)}
                      options={gearboxTypes}
                      placeholder={t("eval.selectTransmission")}
                      searchPlaceholder="Search transmission..."
                      isLoading={isLoadingOptions}
                      className="h-12 text-base w-full"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="vehiculeColor" className="text-base font-medium">{t("eval.color")}</Label>
                    <SearchSelect
                      value={formData.vehiculeColor}
                      onChange={(value) => handleInputChange("vehiculeColor", value)}
                      options={colors}
                      placeholder={t("eval.colorPlaceholder")}
                      searchPlaceholder="Search color..."
                      isLoading={isLoadingOptions}
                      className="h-12 text-base w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="horsepowerDin" className="text-base font-medium">{t("eval.horsepower")}</Label>
                    <Input
                      id="horsepowerDin"
                      type="number"
                      placeholder={t("eval.horsepowerPlaceholder")}
                      value={formData.horsepowerDin}
                      onChange={(e) => handleInputChange("horsepowerDin", e.target.value)}
                      className="h-12 text-base w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-8">
                <Button
                  onClick={() => setFormStep(1)}
                  variant="outline"
                  className="flex-1 h-12 text-lg"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setFormStep(3)}
                  disabled={!isStep2Valid}
                  className="flex-[2] h-12 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Continue <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Step 3: Location & Description */}
            <div
              className={`w-full transition-all duration-500 ease-in-out flex flex-col ${
                formStep === 3
                  ? "relative col-start-1 row-start-1 opacity-100 translate-x-0 pointer-events-auto z-10"
                  : formStep < 3
                    ? "absolute top-0 left-0 opacity-0 translate-x-full pointer-events-none z-0"
                    : "absolute top-0 left-0 opacity-0 -translate-x-full pointer-events-none z-0"
              }`}
            >
              <div className="space-y-8 flex-1">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="locationCountryId" className="text-base font-medium">{t("eval.country")}</Label>
                    <SearchSelect
                      value={formData.locationCountryId}
                      onChange={(value) => handleInputChange("locationCountryId", value)}
                      options={countries}
                      placeholder={t("eval.countryPlaceholder")}
                      searchPlaceholder="Search country..."
                      isLoading={isLoadingOptions}
                      className="h-12 text-base w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="locationCity" className="text-base font-medium">{t("eval.city")}</Label>
                    <SearchSelect
                      value={formData.locationCity}
                      onChange={(value) => handleInputChange("locationCity", value)}
                      options={cities}
                      placeholder={formData.locationCountryId ? t("eval.cityPlaceholder") : t("eval.selectCountryFirst")}
                      searchPlaceholder="Search city..."
                      isLoading={loadingCities}
                      disabled={!formData.locationCountryId}
                      className="h-12 text-base w-full"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="subject" className="text-base font-medium">{t("eval.description")}</Label>
                  <Textarea
                    id="subject"
                    placeholder={t("eval.descriptionPlaceholder")}
                    value={formData.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    rows={5}
                    className="resize-none text-base w-full"
                  />
                </div>

                {/* Non-logged-in teasing message */}
                {!user && !authLoading && (
                  <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-xl shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                        <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-purple-900 dark:text-purple-100 mb-1">
                          Unlock Instant Valuation
                        </h4>
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          Sign in to get your instant car evaluation and compare with similar vehicles in our database. It's free and takes seconds!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-auto pt-8">
                <Button
                  onClick={() => setFormStep(2)}
                  variant="outline"
                  className="flex-1 h-12 text-lg"
                >
                  Back
                </Button>
                <div className="flex-[2]">
                  <Button
                    type="button"
                    disabled={isLoading || (!contactInfo.email && !contactInfo.phone && user)}
                    className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={(e) => {
                      if (!user && !authLoading) {
                        e.preventDefault()
                        setStep("verification")
                      } else {
                        handleSubmit(e)
                      }
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("eval.processing")}
                      </>
                    ) : user ? (
                      <>
                        Get Evaluation
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    ) : (
                      <>
                        Sign in to Evaluate
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
