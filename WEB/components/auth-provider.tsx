"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  phone?: string
  createdAt: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('auth_user') : null
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        if (savedToken) {
          setToken(savedToken)
        }
      } catch (error) {
        console.error('Failed to parse saved auth user', error)
        localStorage.removeItem('auth_user')
      }
    }

    const persistAuth = (nextUser: User, nextToken: string | null) => {
      setUser(nextUser)
      setToken(nextToken)
      localStorage.setItem('auth_user', JSON.stringify(nextUser))
      if (nextToken) {
        localStorage.setItem('auth_token', nextToken)
      }
    }

    const clearAuth = () => {
      setUser(null)
      setToken(null)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }

    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          persistAuth(data.user, savedToken || token)
        } else {
          // Session invalid
          clearAuth()
        }
      } catch (error) {
        console.error('Failed to check session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = (newToken: string, newUser: User) => {
    // The API sets an HTTP-only cookie; we mirror minimal data locally for quicker UI hydration
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    // Optional: Call logout API
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(console.error)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
