'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { supportedLanguages, defaultLanguage, type SupportedLanguage } from '../i18n/config'

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
}

const DEFAULT_PREFERENCES: UserPreferences = {
    isOledTheme: false,
    language: 'en',
    sidebarCollapsed: false,
    propertyPanelCollapsed: false,
    defaultPlaybackSpeed: 1.0,
    showAiPreviews: true,
    autoSaveEnabled: true
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

    useEffect(() => {
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
    }, [])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('click-user-preferences', JSON.stringify(preferences))
        }
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
