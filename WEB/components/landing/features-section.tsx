"use client"

import { Zap, TrendingUp, FileText, Shield, Clock, Globe } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"

const features = [
  {
    icon: Zap,
    titleKey: "features.item2.title",
    descKey: "features.item2.description",
  },
  {
    icon: TrendingUp,
    titleKey: "features.item3.title",
    descKey: "features.item3.description",
  },
  {
    icon: FileText,
    titleKey: "features.item1.title",
    descKey: "features.item1.description",
  },
  {
    icon: Shield,
    titleKey: "features.item4.title",
    descKey: "features.item4.description",
  },
  {
    icon: Clock,
    titleKey: "dashboard.noEvaluations",
    descKey: "common.loading",
  },
  {
    icon: Globe,
    titleKey: "nav.evaluate",
    descKey: "common.success",
  },
]

export function FeaturesSection() {
  const { t } = useTranslation()

  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">{t("features.title")}</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">{t("features.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-2 bg-background/50 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 group"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{t(feature.titleKey)}</h3>
                <p className="text-muted-foreground">{t(feature.descKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
