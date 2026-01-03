"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import en from "./translations/en"
import es from "./translations/es"
import fr from "./translations/fr"
import de from "./translations/de"
import it from "./translations/it"
import pt from "./translations/pt"
import nl from "./translations/nl"
import pl from "./translations/pl"
import ro from "./translations/ro"
import cs from "./translations/cs"
import sv from "./translations/sv"
import da from "./translations/da"
import fi from "./translations/fi"
import no from "./translations/no"
import el from "./translations/el"
import hu from "./translations/hu"
import ar from "./translations/ar"
import zh from "./translations/zh"

export type Language =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "ro"
  | "cs"
  | "sv"
  | "da"
  | "fi"
  | "no"
  | "el"
  | "hu"
  | "ar"
  | "zh"

export const languages: Record<Language, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ro: "Română",
  cs: "Čeština",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  el: "Ελληνικά",
  hu: "Magyar",
  ar: "العربية",
  zh: "中文",
}

export const translations: Record<Language, Record<string, string>> = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  nl,
  pl,
  ro,
  cs,
  sv,
  da,
  fi,
  no,
  el,
  hu,
  ar,
  zh,
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useTranslation must be used within LanguageProvider")
  }

  const t = (key: string): string => {

    const keys = key.split(".")
    let value: any = translations[context.language]
    for (const k of keys) {
      value = value?.[k]
    }
    if (value === undefined) {
      value = translations[context.language][key]
    }
    return (value as string) || key
  }

  return { t, language: context.language, setLanguage: context.setLanguage, languages }
}
