import { NextResponse } from "next/server"
import { verifyCode, loginWithCode } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { email, phone, code } = await request.json()

    if (!code || (!email && !phone)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // Find user
    const identifier = email || phone
    const isValid = verifyCode(identifier, code)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 })
    }

    // Create session and get token
    const { user, token } = loginWithCode(identifier)

    const response = NextResponse.json({
      success: true,
      verified: true,
      user,
      token,
    })

    // Set HTTP-only cookie
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error("[v0] Error verifying code:", error)
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 })
  }
}
