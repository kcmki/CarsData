"use client"

import { useState, useEffect } from "react"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { Navigation } from "@/components/landing/navigation"
import { DashboardAuthModal } from "@/components/dashboard/dashboard-auth-modal"

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (response.ok) {
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-24 pb-16 md:max-w-6xl mx-auto">
        {isLoading ? (
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          </div>
        ) : isAuthenticated ? (
          <DashboardContent />
        ) : (
          <DashboardAuthModal onAuthSuccess={handleAuthSuccess} />
        )}
      </main>
    </div>
  )
}
