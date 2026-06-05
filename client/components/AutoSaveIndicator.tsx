'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface AutoSaveIndicatorProps {
  onSave: () => Promise<void>
  saveInterval?: number // milliseconds
  content: string | object
}

export default function AutoSaveIndicator({ 
  onSave, 
  saveInterval = 30000, // 30 seconds default
  content
}: AutoSaveIndicatorProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const save = useCallback(async () => {
    if (!content || (typeof content === 'string' && content.trim() === '')) {
      return
    }

    setStatus('saving')
    try {
      await onSave()
      setStatus('saved')
      setLastSaved(new Date())
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus('idle')
      }, 2000)
    } catch (error) {
      setStatus('error')
      setTimeout(() => {
        setStatus('idle')
      }, 3000)
    }
  }, [content, onSave])

  useEffect(() => {
    // Auto-save on content change
    const timer = setTimeout(() => {
      if (content && status !== 'saving') {
        save()
      }
    }, saveInterval)

    return () => clearTimeout(timer)
  }, [content, saveInterval, save, status])

  // Also save on blur (user leaves field)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (content && status !== 'saving') {
        // Use sendBeacon for reliable save on page unload
        save()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [content, save, status])

  if (status === 'idle' && !lastSaved) {
    return null
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Save className="w-3 h-3 animate-pulse" />,
          text: t('autoSaveIndicator.saving'),
          color: 'text-blue-600 dark:text-blue-400',
        }
      case 'saved':
        return {
          icon: <CheckCircle2 className="w-3 h-3" />,
          text: lastSaved
            ? t('autoSaveIndicator.savedAgo', { time: formatTimeAgo(lastSaved, t) })
            : t('autoSaveIndicator.saved'),
          color: 'text-green-600 dark:text-green-400',
        }
      case 'error':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          text: t('autoSaveIndicator.saveFailed'),
          color: 'text-red-600 dark:text-red-400',
        }
      default:
        return null
    }
  }

  const statusDisplay = getStatusDisplay()
  if (!statusDisplay) return null

  return (
    <div className={`flex items-center gap-1.5 text-xs ${statusDisplay.color} transition-colors`}>
      {statusDisplay.icon}
      <span>{statusDisplay.text}</span>
    </div>
  )
}

function formatTimeAgo(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return t('autoSaveIndicator.justNow')
  if (seconds < 3600) return t('autoSaveIndicator.minutesAgo', { minutes: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('autoSaveIndicator.hoursAgo', { hours: Math.floor(seconds / 3600) })
  return t('autoSaveIndicator.daysAgo', { days: Math.floor(seconds / 86400) })
}






