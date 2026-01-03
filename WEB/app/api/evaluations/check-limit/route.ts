import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory store for demo (in production, use a database)
const evaluationLimits: Record<string, { count: number; resetTime: number }> = {}

export async function POST(request: NextRequest) {
  try {
    const { email, phone } = await request.json()

    const contactKey = email || phone
    if (!contactKey) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 })
    }

    const now = Date.now()
    const dayInMs = 24 * 60 * 60 * 1000

    if (!evaluationLimits[contactKey]) {
      evaluationLimits[contactKey] = {
        count: 0,
        resetTime: now + dayInMs,
      }
    }

    const userLimit = evaluationLimits[contactKey]

    // Reset if day has passed
    if (now > userLimit.resetTime) {
      userLimit.count = 0
      userLimit.resetTime = now + dayInMs
    }

    const remaining = 10 - userLimit.count

    if (userLimit.count >= 10) {
      return NextResponse.json(
        {
          message:
            "You have reached your daily limit of 10 evaluations. Please try again tomorrow or contact us for unlimited access.",
          evaluationsRemaining: 0,
          evaluationsUsedToday: 10,
        },
        { status: 429 },
      )
    }

    return NextResponse.json({
      evaluationsRemaining: remaining,
      evaluationsUsedToday: userLimit.count,
      canEvaluate: true,
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to check evaluation limit" }, { status: 500 })
  }
}
