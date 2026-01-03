import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"

// In-memory storage for evaluations and daily limits
const evaluations = new Map<string, any>()
const dailyEvaluationCounts = new Map<string, { count: number; date: string }>()

const DAILY_LIMIT = 10

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const session = getSession(token)
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { carData } = await request.json()

    if (!carData) {
      return NextResponse.json({ error: "Missing car data" }, { status: 400 })
    }

    const today = new Date().toISOString().split("T")[0]
    const userDailyCount = dailyEvaluationCounts.get(session.user.id) || { count: 0, date: today }

    // Reset count if it's a new day
    if (userDailyCount.date !== today) {
      userDailyCount.count = 0
      userDailyCount.date = today
    }

    // Check if user has reached daily limit
    if (userDailyCount.count >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: "Daily evaluation limit reached",
          message: `You have reached your daily limit of ${DAILY_LIMIT} evaluations. Please contact us for unlimited access.`,
          limitReached: true,
        },
        { status: 429 },
      )
    }

    // Increment evaluation count
    userDailyCount.count++
    dailyEvaluationCounts.set(session.user.id, userDailyCount)

    // Calculate estimated price
    const basePrice = 30000
    const yearDepreciation = (new Date().getFullYear() - Number.parseInt(carData.year)) * 1500
    const mileageDepreciation = (Number.parseInt(carData.mileage) / 10000) * 500
    const conditionMultiplier =
      {
        excellent: 1.1,
        good: 1.0,
        fair: 0.85,
        poor: 0.7,
      }[carData.condition] || 1.0

    const estimatedPrice = Math.round((basePrice - yearDepreciation - mileageDepreciation) * conditionMultiplier)
    const priceRangeMin = Math.round(estimatedPrice * 0.92)
    const priceRangeMax = Math.round(estimatedPrice * 1.08)

    const evaluation = {
      id: Math.random().toString(36).substring(7),
      user_id: session.user.id,
      make: carData.make,
      model: carData.model,
      year: Number.parseInt(carData.year),
      mileage: Number.parseInt(carData.mileage),
      condition: carData.condition,
      fuel_type: carData.fuelType || null,
      transmission: carData.transmission || null,
      color: carData.color || null,
      additional_features: carData.additionalFeatures || null,
      estimated_price: estimatedPrice,
      price_range_min: priceRangeMin,
      price_range_max: priceRangeMax,
      evaluation_notes: "Based on current market conditions, vehicle age, mileage, and reported condition.",
      is_paid: false,
      created_at: new Date(),
    }

    evaluations.set(evaluation.id, evaluation)

    return NextResponse.json({
      evaluation,
      needsPayment: false,
      hasActiveSubscription: false,
      evaluationsUsedToday: userDailyCount.count,
      evaluationsRemaining: DAILY_LIMIT - userDailyCount.count,
    })
  } catch (error: any) {
    console.error("[v0] Error creating evaluation:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
