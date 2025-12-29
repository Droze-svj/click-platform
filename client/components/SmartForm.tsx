'use client'

import { useEffect } from 'react'
import { useSmartDefaults } from '../hooks/useSmartDefaults'

interface SmartFormProps {
  children: React.ReactNode
  onDefaultsLoaded?: (defaults: any) => void
  formType: 'video' | 'content' | 'script' | 'quote'
}

export default function SmartForm({ children, onDefaultsLoaded, formType }: SmartFormProps) {
  const { preferences, getDefaultPlatforms, getDefaultEffects, getDefaultMusicGenre } = useSmartDefaults()

  useEffect(() => {
    if (preferences && onDefaultsLoaded) {
      const defaults: any = {}

      if (formType === 'content') {
        defaults.platforms = getDefaultPlatforms()
      } else if (formType === 'video') {
        defaults.effects = getDefaultEffects()
        defaults.musicGenre = getDefaultMusicGenre()
      }

      onDefaultsLoaded(defaults)
    }
  }, [preferences, formType, onDefaultsLoaded, getDefaultPlatforms, getDefaultEffects, getDefaultMusicGenre])

  return <>{children}</>
}







