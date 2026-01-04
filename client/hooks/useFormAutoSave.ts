'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseFormAutoSaveOptions {
  formKey: string
  enabled?: boolean
  debounceMs?: number
  onSave?: (data: any) => void | Promise<void>
}

/**
 * Auto-save form data to localStorage with debouncing
 */
export function useFormAutoSave({
  formKey,
  data,
  enabled = true,
  debounceMs = 1000,
  onSave
}: UseFormAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedRef = useRef<string>()

  const save = useCallback(async (dataToSave: any) => {
    try {
      const dataString = JSON.stringify(dataToSave)
      
      // Only save if data changed
      if (dataString === lastSavedRef.current) {
        return
      }

      // Save to localStorage
      localStorage.setItem(`form-draft-${formKey}`, dataString)
      lastSavedRef.current = dataString

      // Call custom save handler if provided
      if (onSave) {
        await onSave(dataToSave)
      }
    } catch (error) {
      console.error('Failed to auto-save form:', error)
    }
  }, [formKey, onSave])

  useEffect(() => {
    if (!enabled || !data) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      save(data)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, enabled, debounceMs, save])

  // Load draft on mount
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(`form-draft-${formKey}`)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load form draft:', error)
    }
    return null
  }, [formKey])

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`form-draft-${formKey}`)
      lastSavedRef.current = undefined
    } catch (error) {
      console.error('Failed to clear form draft:', error)
    }
  }, [formKey])

  return {
    loadDraft,
    clearDraft,
    save: () => save(data)
  }
}




