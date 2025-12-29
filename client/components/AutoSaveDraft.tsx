'use client'

import { useEffect, useRef, useState } from 'react'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'

interface AutoSaveDraftProps {
  content: string
  title?: string
  onSave: (content: string, title?: string) => Promise<void>
  saveInterval?: number // in milliseconds
}

export default function AutoSaveDraft({ 
  content, 
  title, 
  onSave, 
  saveInterval = 30000 // 30 seconds default
}: AutoSaveDraftProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string>(content)

  useEffect(() => {
    // Only save if content has changed
    if (content !== lastContentRef.current && content.trim().length > 0) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Set new timeout
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await onSave(content, title)
          setSaveStatus('saved')
          setLastSaved(new Date())
          lastContentRef.current = content
          
          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (error) {
          console.error('Auto-save error:', error)
          setSaveStatus('error')
          setTimeout(() => setSaveStatus('idle'), 3000)
        }
      }, saveInterval)
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, title, onSave, saveInterval])

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Save className="w-4 h-4 animate-pulse text-blue-600" />
      case 'saved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : 'Saved'
      case 'error':
        return 'Save failed'
      default:
        return 'Auto-saving...'
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  )
}


