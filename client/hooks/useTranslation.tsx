'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supportedLanguages, defaultLanguage, type SupportedLanguage } from '../i18n/config'
import { usePreferences } from './usePreferences'

interface TranslationContextType {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (key: string) => string
  isLoading: boolean
}

const TranslationContext = createContext<TranslationContextType | null>(null)

function isValidLanguage(lang: string): lang is SupportedLanguage {
  return supportedLanguages.includes(lang as SupportedLanguage)
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { preferences, updatePreference } = usePreferences()
  const lang = isValidLanguage(preferences.language) ? preferences.language : defaultLanguage
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)

  const loadTranslations = useCallback(async (language: SupportedLanguage) => {
    try {
      const res = await fetch(`/i18n/locales/${language}.json`)
      if (res.ok) {
        const data = await res.json()
        setTranslations(data)
        return
      }
      throw new Error(`HTTP ${res.status}`)
    } catch {
      if (language !== 'en') {
        try {
          const fallback = await fetch('/i18n/locales/en.json')
          if (fallback.ok) {
            const data = await fallback.json()
            setTranslations(data)
            return
          }
        } catch {
          /* ignore */
        }
      }
      setTranslations({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    loadTranslations(lang)
  }, [lang, loadTranslations])

  const setLanguage = useCallback(
    (language: SupportedLanguage) => {
      updatePreference('language', language)
    },
    [updatePreference]
  )

  const t = useCallback(
    (key: string): string => {
      const keys = key.split('.')
      let value: any = translations
      for (const k of keys) {
        value = value?.[k]
        if (value === undefined) return key
      }
      return typeof value === 'string' ? value : key
    },
    [translations]
  )

  return (
    <TranslationContext.Provider value={{ language: lang, setLanguage, t, isLoading }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(TranslationContext)
  if (!ctx) {
    return {
      language: defaultLanguage as SupportedLanguage,
      setLanguage: () => {},
      t: (key: string) => key,
      isLoading: false,
    }
  }
  return ctx
}
