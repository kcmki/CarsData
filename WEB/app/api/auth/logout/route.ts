import { type NextRequest, NextResponse } from "next/server"
import { logOut } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value

  if (token) {
    logOut(token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete("auth_token")

  return response
}
