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

// Cache English once — it's the universal fallback. Loaded lazily on first use.
let enCache: Record<string, any> | null = null
async function loadEn(): Promise<Record<string, any>> {
  if (enCache) return enCache
  try {
    const res = await fetch('/i18n/locales/en.json')
    if (res.ok) {
      enCache = await res.json()
      return enCache as Record<string, any>
    }
  } catch {
    /* network failure — give up and return empty */
  }
  return {}
}

function lookup(dict: Record<string, any> | null | undefined, key: string): string | undefined {
  if (!dict) return undefined
  const keys = key.split('.')
  let v: any = dict
  for (const k of keys) {
    v = v?.[k]
    if (v === undefined) return undefined
  }
  return typeof v === 'string' ? v : undefined
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { preferences, updatePreference } = usePreferences()
  const lang = isValidLanguage(preferences.language) ? preferences.language : defaultLanguage
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [enFallback, setEnFallback] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)

  const loadTranslations = useCallback(async (language: SupportedLanguage) => {
    // Always have English available as a fallback for missing keys.
    const en = await loadEn()
    setEnFallback(en)

    if (language === 'en') {
      setTranslations(en)
      return
    }
    try {
      const res = await fetch(`/i18n/locales/${language}.json`)
      if (res.ok) {
        setTranslations(await res.json())
        return
      }
      throw new Error(`HTTP ${res.status}`)
    } catch {
      // Missing/invalid locale file — keep English so the UI never shows raw keys.
      setTranslations(en)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    loadTranslations(lang).finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [lang, loadTranslations])

  const setLanguage = useCallback(
    (language: SupportedLanguage) => {
      updatePreference('language', language)
    },
    [updatePreference]
  )

  const t = useCallback(
    (key: string): string => {
      const primary = lookup(translations, key)
      if (primary !== undefined) return primary
      const fallback = lookup(enFallback, key)
      if (fallback !== undefined) return fallback
      return key
    },
    [translations, enFallback]
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
