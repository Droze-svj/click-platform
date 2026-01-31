'use client'

import { useEffect } from 'react'
import { useTranslation } from '../hooks/useTranslation'

export default function LangAttribute() {
  const { language } = useTranslation()

  useEffect(() => {
    const html = document.documentElement
    if (html.getAttribute('lang') !== language) {
      html.setAttribute('lang', language)
    }
  }, [language])

  return null
}
