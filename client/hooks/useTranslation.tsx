'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { supportedLanguages, defaultLanguage, type SupportedLanguage } from '../i18n/config'

interface TranslationContextType {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (key: string) => string
}

const TranslationContext = createContext<TranslationContextType | null>(null)

let translations: Record<string, any> = {}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem('language') as SupportedLanguage
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      setLanguageState(savedLanguage)
    }

    // Load translations
    loadTranslations(language).then(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadTranslations(language)
    localStorage.setItem('language', language)
  }, [language])

  const loadTranslations = async (lang: SupportedLanguage) => {
    try {
      const response = await fetch(`/i18n/locales/${lang}.json`)
      translations = await response.json()
    } catch (error) {
      console.error('Failed to load translations:', error)
      // Fallback to English
      if (lang !== 'en') {
        try {
          const fallback = await fetch('/i18n/locales/en.json')
          translations = await fallback.json()
        } catch (e) {
          console.error('Failed to load fallback translations:', e)
        }
      }
    }
  }

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations
    
    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) {
        return key // Return key if translation not found
      }
    }
    
    return typeof value === 'string' ? value : key
  }

  if (isLoading) {
    return <>{children}</> // Render without translations while loading
  }

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (!context) {
    // Fallback if provider not available
    return {
      language: defaultLanguage,
      setLanguage: () => {},
      t: (key: string) => key,
    }
  }
  return context
}






