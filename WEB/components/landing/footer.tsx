"use client"

import Link from "next/link"
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { Logo } from "@/components/ui/logo"

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-background border-t border-border/50 py-16 relative overflow-hidden ">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background to-muted/20 -z-10" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10 md:max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2 group cursor-pointer">
              <Logo />
              <span className="font-bold text-2xl text-foreground group-hover:text-blue-600 transition-colors">CarValue</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{t("footer.tagline")}</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">{t("footer.product")}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/evaluate" className="text-muted-foreground hover:text-blue-600 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/0 group-hover:bg-blue-500 transition-colors" />
                  {t("nav.evaluate")}
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-muted-foreground hover:text-blue-600 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/0 group-hover:bg-blue-500 transition-colors" />
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-blue-600 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/0 group-hover:bg-blue-500 transition-colors" />
                  {t("nav.dashboard")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">{t("footer.company")}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/cookies" className="text-muted-foreground hover:text-blue-600 transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/0 group-hover:bg-blue-500 transition-colors" />
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">{t("footer.follow")}</h3>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm hover:shadow-blue-500/25"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm hover:shadow-blue-500/25"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm hover:shadow-blue-500/25"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm hover:shadow-blue-500/25"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 text-center text-muted-foreground text-sm">
          <p>&copy; 2025 CarValue. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  )
}
