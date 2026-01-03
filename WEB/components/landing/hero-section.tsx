"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n"
import { HeroIllustration } from "./hero-illustration"

export function HeroSection() {
  
  const { t } = useTranslation()
  
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden pt-28 lg:pt-0 md:max-w-6xl mx-auto">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-background to-background dark:from-blue-950/30 dark:via-background dark:to-background" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Text Content */}
          <div className="text-center lg:text-left space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-in fade-in slide-in-from-bottom-4 duration-700 backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">AI-Powered Car Valuation</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 text-balance">
              {t("hero.title")}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 text-balance max-w-2xl mx-auto lg:mx-0">
              {t("hero.subtitle")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Link href="/evaluate" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white px-8 py-6 text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 group"
                >
                  {t("hero.cta")}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg backdrop-blur-sm hover:bg-accent/50">
                {t("hero.learnMore")}
              </Button>
            </div>

            {/* Stats */}
            <div className="flex justify-center items-center gap-8 pt-8 border-t border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                <div className="flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold text-foreground mb-1">500K+</div>
                  <div className="text-sm text-muted-foreground">{t("hero.stats.evaluations")}</div>
                </div>
                {/* <div>
                  <div className="text-3xl font-bold text-foreground mb-1">98%</div>
                  <div className="text-sm text-muted-foreground">{t("hero.stats.accuracy")}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground mb-1">24/7</div>
                  <div className="text-sm text-muted-foreground">{t("hero.stats.available")}</div>
                </div> */}
            </div>
          </div>

          {/* Right Column: Illustration */}
          <div className="relative lg:h-[600px] flex items-center justify-center animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  )
}
