'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Save, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { apiPost } from '../lib/api'

interface VideoEditorState {
  videoFilters: any
  textOverlays: any[]
  timelineSegments: any[]
  colorGradeSettings: any
  chromaKeySettings?: any
  playbackSpeed?: number
  filterIntensity?: number
  showBeforeAfter?: boolean
  videoId?: string
  videoUrl?: string
  projectName?: string
  [key: string]: any
}

interface UseVideoEditorAutosaveOptions {
  state: VideoEditorState
  videoId?: string
  name?: string
  folderId?: string
  enabled?: boolean
  debounceMs?: number
}

interface AutosaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved: Date | null
  message: string
}

const BACKUP_SUFFIXES = ['backup-0', 'backup-1'] as const
const SAVED_DISPLAY_MS = 4000
const ERROR_DISPLAY_MS = 5000
const SERVER_RETRIES = 2
const SERVER_RETRY_DELAY_MS = 600

export function useVideoEditorAutosave({
  state,
  videoId,
  name,
  folderId,
  enabled = true,
  debounceMs = 2500
}: UseVideoEditorAutosaveOptions) {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
    status: 'idle',
    lastSaved: null,
    message: ''
  })
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const lastSavedRef = useRef<string>()
  const lastSavedDateRef = useRef<Date | null>(null)
  const saveKey = `video-editor-state-${videoId || 'local'}`
  const backupIndexRef = useRef(0)

  const saveToLocalStorage = useCallback(
    (stateString: string) => {
      localStorage.setItem(saveKey, stateString)
      localStorage.setItem(`${saveKey}-timestamp`, new Date().toISOString())
      const idx = backupIndexRef.current % 2
      backupIndexRef.current += 1
      localStorage.setItem(`${saveKey}-${BACKUP_SUFFIXES[idx]}`, stateString)
    },
    [saveKey]
  )

  const saveState = useCallback(
    async (stateToSave: VideoEditorState) => {
      const stateString = JSON.stringify(stateToSave)
      if (stateString === lastSavedRef.current) return

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = undefined
      }
      setAutosaveStatus((prev) => ({ ...prev, status: 'saving', message: 'Saving...' }))

      try {
        let serverOk = false
        if (videoId) {
          for (let attempt = 0; attempt <= SERVER_RETRIES; attempt++) {
            try {
              await apiPost('/video/editor/save', {
                videoId,
                name: name ?? stateToSave.projectName,
                folderId,
                editorState: stateToSave
              })
              serverOk = true
              break
            } catch (e) {
              if (attempt < SERVER_RETRIES) {
                await new Promise((r) => setTimeout(r, SERVER_RETRY_DELAY_MS * (attempt + 1)))
              } else {
                console.warn('Server save failed after retries, using local only:', e)
              }
            }
          }
        }

        try {
          saveToLocalStorage(stateString)
        } catch (storageError: any) {
          if (storageError?.name === 'QuotaExceededError') {
            try {
              const ours = new Set([
                saveKey,
                `${saveKey}-timestamp`,
                ...BACKUP_SUFFIXES.map((b) => `${saveKey}-${b}`)
              ])
              const keys = Object.keys(localStorage).filter(
                (k) => k.startsWith('video-editor-state-') && !ours.has(k)
              )
              keys.slice(0, 5).forEach((k) => localStorage.removeItem(k))
              saveToLocalStorage(stateString)
            } catch {
              throw new Error('Storage full. Free some space and try again.')
            }
          } else throw storageError
        }

        lastSavedRef.current = stateString
        const now = new Date()
        lastSavedDateRef.current = now
        setAutosaveStatus({
          status: 'saved',
          lastSaved: now,
          message: serverOk ? 'Saved' : 'Saved locally'
        })

        idleTimeoutRef.current = setTimeout(() => {
          idleTimeoutRef.current = undefined
          setAutosaveStatus((prev) => ({
            ...prev,
            status: 'idle',
            message:
              prev.lastSaved != null
                ? `Saved at ${prev.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''
          }))
        }, SAVED_DISPLAY_MS)
      } catch (error) {
        console.error('Autosave failed:', error)
        setAutosaveStatus({
          status: 'error',
          lastSaved: lastSavedDateRef.current,
          message: error instanceof Error ? error.message : 'Failed to save'
        })
        idleTimeoutRef.current = setTimeout(() => {
          idleTimeoutRef.current = undefined
          setAutosaveStatus((prev) => ({ ...prev, status: 'idle', message: '' }))
        }, ERROR_DISPLAY_MS)
      }
    },
    [videoId, name, folderId, saveToLocalStorage]
  )

  useEffect(() => {
    if (!enabled) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = undefined
      saveState(state)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }
  }, [state, enabled, debounceMs, saveState])

  useEffect(() => {
    const handleVisibility = () => {
      if (!enabled || !state || document.visibilityState !== 'hidden') return
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
      saveState(state)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [state, enabled, saveState])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!enabled || !state) return
      try {
        const stateString = JSON.stringify(state)
        localStorage.setItem(saveKey, stateString)
        localStorage.setItem(`${saveKey}-timestamp`, new Date().toISOString())
      } catch (e) {
        console.error('Save on unload failed', e)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [state, enabled, saveKey])

  const loadSavedState = useCallback((): (VideoEditorState & { _loadedAt?: Date }) | null => {
    try {
      let raw = localStorage.getItem(saveKey)
      if (!raw) {
        for (const b of BACKUP_SUFFIXES) {
          raw = localStorage.getItem(`${saveKey}-${b}`)
          if (raw) break
        }
      }
      if (!raw) return null
      const parsed = JSON.parse(raw) as VideoEditorState
      const ts = localStorage.getItem(`${saveKey}-timestamp`)
      return { ...parsed, _loadedAt: ts ? new Date(ts) : new Date() }
    } catch (e) {
      console.error('Load saved state failed', e)
      return null
    }
  }, [saveKey])

  const clearSavedState = useCallback(() => {
    try {
      localStorage.removeItem(saveKey)
      localStorage.removeItem(`${saveKey}-timestamp`)
      BACKUP_SUFFIXES.forEach((b) => localStorage.removeItem(`${saveKey}-${b}`))
      lastSavedRef.current = undefined
      lastSavedDateRef.current = null
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = undefined
      }
      setAutosaveStatus({ status: 'idle', lastSaved: null, message: '' })
    } catch (e) {
      console.error('Clear saved state failed', e)
    }
  }, [saveKey])

  const manualSave = useCallback(() => {
    setAutosaveStatus((prev) => ({ ...prev, status: 'saving', message: 'Saving...' }))
    saveState(state)
  }, [state, saveState])

  const retrySave = useCallback(() => {
    setAutosaveStatus((prev) => ({ ...prev, status: 'saving', message: 'Retrying...' }))
    saveState(state)
  }, [state, saveState])

  const getStatusIcon = () => {
    switch (autosaveStatus.status) {
      case 'saving':
        return <Save className="w-3.5 h-3.5 animate-pulse text-blue-500" />
      case 'saved':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  return {
    autosaveStatus,
    loadSavedState,
    clearSavedState,
    manualSave,
    retrySave,
    getStatusIcon
  }
}
