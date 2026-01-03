import { type NextRequest, NextResponse } from "next/server"
import { signUp } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password, phone } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const result = signUp(email, password, phone)

    if (!result) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 })
    }

    const response = NextResponse.json(result, { status: 201 })
    response.cookies.set("auth_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
