"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n"

export function CTASection() {
  const { t } = useTranslation()

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-500" />
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(to_bottom,transparent,black,transparent)]" />
      
      {/* Animated Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[50%] -left-[20%] w-[80%] h-[80%] bg-white/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute -bottom-[50%] -right-[20%] w-[80%] h-[80%] bg-cyan-400/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-8">
             <h2 className="text-4xl md:text-5xl font-bold text-white mb-2 text-balance drop-shadow-md">{t("cta.title")}</h2>
          </div>
          
          <p className="text-xl text-white/90 mb-10 text-balance max-w-2xl mx-auto leading-relaxed">{t("cta.subtitle")}</p>
          
          <Link href="/evaluate">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 px-8 py-6 text-lg font-semibold shadow-xl shadow-blue-900/20 group transition-all duration-300 hover:scale-105">
              {t("cta.button")}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
