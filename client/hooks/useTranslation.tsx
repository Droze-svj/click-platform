'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supportedLanguages, defaultLanguage, rtlLanguages, type SupportedLanguage } from '../i18n/config'
import { usePreferences } from './usePreferences'

/**
 * `params` lets callers interpolate variables into a translated string,
 * e.g. `t('translation.translationFailedWith', { error: err.message })`
 * against a locale value like `"Translation failed: {{error}}"`.
 *
 * Why this matters: previously the only way to inject a value into a
 * translated phrase was string concatenation (`t('foo') + ': ' + bar`),
 * which breaks in RTL languages (Arabic flips visual order of the parts)
 * and in any language where the variable doesn't naturally sit at the
 * end of the sentence. Real interpolation lets translators control where
 * the variable lands in each locale.
 */
type TranslationParams = Record<string, string | number>

interface TranslationContextType {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (key: string, params?: TranslationParams) => string
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

/**
 * Last-resort label generator when neither the active locale nor the
 * English fallback contains the key. Splits camelCase + snake_case +
 * dot.case and produces a sentence-cased phrase: `nav.aiInsights` →
 * `AI insights`, `dashboard.exportCsv` → `Export csv`. Common all-caps
 * words (AI, URL, CSV, FAQ, OAuth) are preserved.
 */
const ALL_CAPS = new Set(['ai', 'api', 'csv', 'cta', 'faq', 'gif', 'hud', 'id', 'kpi', 'oauth', 'pdf', 'png', 'roi', 'rss', 'sdk', 'sms', 'ui', 'url', 'ux'])
function humanise(key: string): string {
  const tail = key.split('.').pop() || key
  const words = tail
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return key
  const out = words.map((w, i) => {
    if (ALL_CAPS.has(w)) return w.toUpperCase()
    if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1)
    return w
  }).join(' ')
  return out
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

  // Sync <html lang> and <html dir> whenever the active language changes.
  // The root layout hardcodes `lang="en"`; without this effect, Arabic
  // users get a left-to-right page, screen readers announce English, and
  // the browser's auto-translate prompt fires on every page. Setting both
  // here means the dropdown actually flips direction + announces the
  // right locale to assistive tech.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang
    document.documentElement.dir = rtlLanguages.has(lang) ? 'rtl' : 'ltr'
  }, [lang])

  const setLanguage = useCallback(
    (language: SupportedLanguage) => {
      updatePreference('language', language)
    },
    [updatePreference]
  )

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      const primary = lookup(translations, key)
      const fallback = primary !== undefined ? primary : lookup(enFallback, key)
      // Graceful fallback when neither the active locale nor English
      // has the key — humanise the last segment so the UI never leaks
      // raw keys like `nav.aiInsights`. "aiInsights" → "AI insights",
      // "deepDiveAnalytics" → "Deep dive analytics". Previously we
      // returned the raw key, which is how `NAV.STRATEGIST` was
      // appearing in the sidebar.
      const value = fallback !== undefined ? fallback : humanise(key)
      if (!params) return value
      // `{{name}}` interpolation. Missing params become empty strings
      // rather than the literal `{{name}}`, so a partly-supplied call
      // still renders cleanly. This is the same convention as i18next.
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
        const v = params[name]
        return v === undefined || v === null ? '' : String(v)
      })
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
      // Mirror the in-context `t` signature so callers that pass params
      // don't get a runtime error in non-Provider tests / stories.
      t: (key: string, _params?: TranslationParams) => key,
      isLoading: false,
    }
  }
  return ctx
}
