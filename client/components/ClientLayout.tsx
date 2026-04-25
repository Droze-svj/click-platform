'use client'

import React from 'react'
import { ToastProvider } from '../contexts/ToastContext'
import ToastContainer from '../components/ToastContainer'
import PWAManager from '../components/PWAManager'
import { TranslationProvider } from '../hooks/useTranslation'
import { PreferencesProvider } from '../hooks/usePreferences'
import { ThemeProvider } from '../components/ThemeProvider'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ThemeProvider>
        <TranslationProvider>
          <ToastProvider>
            <PWAManager>
              {children}
            </PWAManager>
            <ToastContainer />
          </ToastProvider>
        </TranslationProvider>
      </ThemeProvider>
    </PreferencesProvider>
  )
}
