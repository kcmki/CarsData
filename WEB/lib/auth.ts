import crypto from "crypto"

export interface User {
  id: string
  email: string
  phone?: string
  createdAt: Date
  isVerified?: boolean
}

export interface Session {
  user: User
  token: string
  expiresAt: Date
}

// Use global storage to persist across hot reloads in development
const globalStore = global as unknown as {
  users: Map<string, { id: string; email: string; phone?: string; password?: string; createdAt: Date; isVerified?: boolean }>
  sessions: Map<string, Session>
  verificationCodes: Map<string, { code: string; expiresAt: Date; email?: string; phone?: string }>
}

if (!globalStore.users) globalStore.users = new Map()
if (!globalStore.sessions) globalStore.sessions = new Map()
if (!globalStore.verificationCodes) globalStore.verificationCodes = new Map()

const users = globalStore.users
const sessions = globalStore.sessions
const VERIFICATION_CODES = globalStore.verificationCodes

export function generateVerificationCode(): string {
  return Math.random().toString().slice(2, 8)
}

export function sendVerificationCode(emailOrPhone: string): string {
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  console.log("Sending verification code ", code, " to ", emailOrPhone)
  VERIFICATION_CODES.set(emailOrPhone, {
    code,
    expiresAt,
    email: emailOrPhone.includes("@") ? emailOrPhone : undefined,
    phone: !emailOrPhone.includes("@") ? emailOrPhone : undefined,
  })

  // Log code for development
  console.log(`[v0] Verification code for ${emailOrPhone}: ${code}`)
  console.log(`[v0] Current codes stored:`, Array.from(VERIFICATION_CODES.keys()))

  return code
}

export function verifyCode(emailOrPhone: string, code: string): boolean {
  const data = VERIFICATION_CODES.get(emailOrPhone)
  console.log(`[v0] Verifying code for ${emailOrPhone}. Stored: ${data?.code}, Received: ${code}`)

  if (!data) {
    console.log(`[v0] No code found for ${emailOrPhone}`)
    return false
  }
  if (data.code !== code) {
    console.log(`[v0] Code mismatch`)
    return false
  }
  if (data.expiresAt < new Date()) {
    console.log(`[v0] Code expired`)
    return false
  }

  VERIFICATION_CODES.delete(emailOrPhone)
  return true
}

export function loginWithCode(emailOrPhone: string): { user: User; token: string } {
  let userEntry = Array.from(users.values()).find((u) => u.email === emailOrPhone || u.phone === emailOrPhone)

  if (!userEntry) {
    // Create new user
    const userId = crypto.randomUUID()
    userEntry = {
      id: userId,
      email: emailOrPhone.includes("@") ? emailOrPhone : "",
      phone: !emailOrPhone.includes("@") ? emailOrPhone : undefined,
      createdAt: new Date(),
      isVerified: true,
    }
    users.set(userId, userEntry)
  } else {
    // Update existing user to verified if they logged in with code
    userEntry.isVerified = true
    users.set(userEntry.id, userEntry)
  }

  const user: User = {
    id: userEntry.id,
    email: userEntry.email,
    phone: userEntry.phone,
    createdAt: userEntry.createdAt,
    isVerified: userEntry.isVerified,
  }

  const token = generateToken(user)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  console.log("Generated token:", token)
  sessions.set(token, { user, token, expiresAt })

  return { user, token }
}

export function signUp(email: string, password: string, phone?: string): { user: User; token: string } | null {
  // Check if user already exists
  const existingUser = Array.from(users.values()).find((u) => u.email === email || u.phone === phone)
  if (existingUser) return null

  const userId = crypto.randomUUID()
  const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")

  const user: User = {
    id: userId,
    email,
    phone,
    createdAt: new Date(),
  }

  users.set(userId, {
    ...user,
    password: hashedPassword,
  })

  const token = generateToken(user)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  sessions.set(token, { user, token, expiresAt })

  return { user, token }
}

export function signIn(emailOrPhone: string, password: string): { user: User; token: string } | null {
  const userEntry = Array.from(users.values()).find((u) => u.email === emailOrPhone || u.phone === emailOrPhone)

  if (!userEntry) return null

  const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")
  if (userEntry.password !== hashedPassword) return null

  const user: User = {
    id: userEntry.id,
    email: userEntry.email,
    phone: userEntry.phone,
    createdAt: userEntry.createdAt,
  }

  const token = generateToken(user)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  sessions.set(token, { user, token, expiresAt })

  return { user, token }
}

export function generateToken(user: User): string {
  return crypto.randomBytes(32).toString("hex")
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token)

  if (!session) return null
  if (session.expiresAt < new Date()) {
    sessions.delete(token)
    return null
  }

  return session
}

export function logOut(token: string): void {
  sessions.delete(token)
}
