"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Globe, ChevronRight } from "lucide-react"
import { useTranslation, languages } from "@/lib/i18n"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/ui/logo"
import { useAuth } from "@/components/auth-provider"

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { t, language, setLanguage } = useTranslation()
  const { user, isLoading } = useAuth()
  const userLabel = user?.email || user?.phone

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-2 left-2 right-2 md:top-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-6xl z-50 transition-all duration-500 rounded-2xl border ${
        isScrolled || isMobileMenuOpen
          ? "bg-background/80 backdrop-blur-xl border-border/50 shadow-lg" 
          : "bg-background/30 backdrop-blur-md border-white/10 shadow-sm"
      }`}
    >
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Logo />
            <span className="font-bold text-xl text-foreground tracking-tight group-hover:text-blue-600 transition-colors">CarValue</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {[
                { href: "/", label: t("nav.home") },
                { href: "/evaluate", label: t("nav.evaluate") },
                { href: "/dashboard", label: t("nav.dashboard") },
            ].map((link) => (
                <Link 
                    key={link.href} 
                    href={link.href} 
                    className="relative text-foreground/80 hover:text-foreground transition-colors py-2 group"
                >
                    {link.label}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300 group-hover:w-full" />
                </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-accent/50 rounded-full">
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 max-h-[300px] overflow-y-auto">
                {Object.entries(languages).map(([code, name]) => (
                  <DropdownMenuItem key={code} onClick={() => setLanguage(code as any)} className="cursor-pointer">
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isLoading ? (
              <span className="text-sm text-muted-foreground">{t("auth.checkingSession")}</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{t("auth.signedInAs").replace("{identifier}", userLabel || "")}</span>
                <Link href="/dashboard">
                  <Button className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300">
                    {t("nav.goToDashboard")}
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href="/evaluate">
                <Button className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300">
                  {t("hero.cta")}
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-foreground/80 hover:text-foreground transition-colors" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 mt-2 bg-background/95 backdrop-blur-xl border border-border/50 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-300 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col gap-4">
              <Link 
                href="/" 
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="font-medium">{t("nav.home")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link 
                href="/evaluate" 
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="font-medium">{t("nav.evaluate")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link 
                href="/dashboard" 
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="font-medium">{t("nav.dashboard")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              
              <div className="h-px bg-border/50 my-2" />
              
              <div className="p-3">
                <span className="text-sm text-muted-foreground block mb-3">Language</span>
                <div className="grid grid-cols-4 gap-2">
                    {Object.entries(languages).map(([code, name]) => (
                        <button
                            key={code}
                            onClick={() => setLanguage(code as any)}
                            className={`text-xs px-1 py-2 rounded-md border transition-colors text-center ${
                                language === code 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-background hover:bg-accent text-foreground border-border'
                            }`}
                        >
                            {code.toUpperCase()}
                        </button>
                    ))}
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-muted-foreground px-1 py-2">{t("auth.checkingSession")}</div>
              ) : user ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-muted-foreground px-1">{t("auth.signedInAs").replace("{identifier}", userLabel || "")}</div>
                  <Link href="/dashboard" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 h-12 text-lg shadow-lg shadow-blue-500/20 rounded-xl">
                      {t("nav.goToDashboard")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href="/evaluate" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 h-12 text-lg shadow-lg shadow-blue-500/20 rounded-xl">
                      {t("hero.cta")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
