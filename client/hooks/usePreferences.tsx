'use client'

import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supportedLanguages, defaultLanguage, type SupportedLanguage } from '../i18n/config'
import { apiGet, apiPut } from '../lib/api'

function isValidLanguage(lang: string): lang is SupportedLanguage {
  return supportedLanguages.includes(lang as SupportedLanguage)
}

interface UserPreferences {
  isOledTheme: boolean
  language: string
  sidebarCollapsed: boolean
  propertyPanelCollapsed: boolean
  defaultPlaybackSpeed: number
  showAiPreviews: boolean
  autoSaveEnabled: boolean
  translationAccuracy: 'standard' | 'neural' | 'quantum'
  clickFastExport: boolean
}

const DEFAULT_PREFERENCES: UserPreferences = {
  isOledTheme: false,
  language: 'en',
  sidebarCollapsed: false,
  propertyPanelCollapsed: false,
  defaultPlaybackSpeed: 1.0,
  showAiPreviews: true,
  autoSaveEnabled: true,
  translationAccuracy: 'neural',
  clickFastExport: true
}

interface PreferencesContextType {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  resetPreferences: () => void
}

const PreferencesContext = createContext<PreferencesContextType | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [isLoaded, setIsLoaded] = useState(false)
  // Track the most-recent values we *wrote* to the server so we don't echo
  // server hydrates back at the server (causes a benign but wasteful loop).
  const lastServerSyncRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 1) Read localStorage immediately so the UI renders the user's last
    //    language without waiting on a network round-trip.
    const saved = localStorage.getItem('click-user-preferences')
    if (saved) {
      try {
        const parsed = { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) }
        if (parsed.language && !isValidLanguage(parsed.language)) {
          parsed.language = defaultLanguage
        }
        setPreferences(parsed)
      } catch (e) {
        console.error('Failed to parse preferences', e)
      }
    }
    setIsLoaded(true)

    // 2) Hydrate from the server in the background — but only if the user
    //    is actually logged in. Without a token we skip the call to avoid
    //    a guaranteed 401 every page load.
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
    if (!hasToken) return
    apiGet<any>('/user/settings')
      .then((res: any) => {
        const serverPrefs = res?.data?.preferences || res?.preferences
        if (!serverPrefs || typeof serverPrefs !== 'object') return
        setPreferences(prev => {
          const merged: UserPreferences = { ...prev }
          // Server overrides local for language/theme/timezone (cross-device
          // sync). Anything else stays local — those are device-specific
          // preferences (sidebar collapsed, playback speed, etc.).
          if (typeof serverPrefs.language === 'string' && isValidLanguage(serverPrefs.language)) {
            merged.language = serverPrefs.language
          }
          if (typeof serverPrefs.theme === 'string') {
            merged.isOledTheme = serverPrefs.theme === 'oled' || serverPrefs.theme === 'dark'
          }
          lastServerSyncRef.current = JSON.stringify({
            language: merged.language,
            theme: serverPrefs.theme || null,
          })
          return merged
        })
      })
      .catch(() => { /* offline / 401 / Mongo unavailable — keep local */ })
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    // Local cache update — always immediate, no debounce.
    localStorage.setItem('click-user-preferences', JSON.stringify(preferences))

    // Server sync — debounce 500ms so a flurry of rapid changes (theme
    // toggle + language change) becomes one network call. Only push the
    // cross-device fields (language + theme).
    const desired = JSON.stringify({
      language: preferences.language,
      theme: preferences.isOledTheme ? 'oled' : 'auto',
    })
    if (desired === lastServerSyncRef.current) return
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
    if (!hasToken) return

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      apiPut('/user/settings', {
        preferences: {
          language: preferences.language,
          theme: preferences.isOledTheme ? 'oled' : 'auto',
        },
      })
        .then(() => { lastServerSyncRef.current = desired })
        .catch(() => { /* best-effort; local cache still authoritative */ })
    }, 500)

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [preferences, isLoaded])

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'language' && typeof value === 'string' && !isValidLanguage(value)) {
        next.language = defaultLanguage
      }
      return next
    })
  }

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
  }

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
