'use client'

import { useEffect } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { rtlLanguages } from '../i18n/config'

/**
 * Small effect-only component that mirrors the active language to
 * `document.documentElement.lang` + `dir`. The root `<html>` ships static
 * defaults from server render; this component flips them on the client when
 * the user changes language. Renders nothing.
 */
export default function LocaleSync() {
  const { language } = useTranslation()
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.lang = language
    root.dir = rtlLanguages.has(language) ? 'rtl' : 'ltr'
  }, [language])
  return null
}
