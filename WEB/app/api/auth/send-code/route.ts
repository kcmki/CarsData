import { NextResponse } from "next/server"
import { sendVerificationCode } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { email, phone } = await request.json()

    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 })
    }
    
    const code = sendVerificationCode(email || phone)

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      ...(process.env.NODE_ENV === "development" && { code }),
    })
  } catch (error) {
    console.error("[v0] Error sending verification code:", error)
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 })
  }
}
