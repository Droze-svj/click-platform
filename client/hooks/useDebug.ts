'use client'
/**
 * useDebug — composable hook for any component to push structured
 * errors/warnings/info into the global ClickDebugPanel log store.
 * Import this instead of console.error everywhere in the app.
 */

import { useCallback, useMemo } from 'react'
import { debugLog, debugFix } from '../components/ClickDebugPanel'

type Level = 'error' | 'warn' | 'info' | 'success'

interface UseDebugReturn {
  /** Log an error */
  error: (msg: string, detail?: string) => void
  /** Log a warning */
  warn: (msg: string, detail?: string) => void
  /** Log informational message */
  info: (msg: string, detail?: string) => void
  /** Log a successful outcome */
  success: (msg: string, detail?: string) => void
  /** Mark a log entry as resolved */
  fix: (id: string) => void
  /** Wrap an async function — catches and logs errors automatically */
  tryCatch: <T>(fn: () => Promise<T>, label: string) => Promise<T | null>
}

export function useDebug(source?: string): UseDebugReturn {
  const log = useCallback((level: Level, msg: string, detail?: string) => {
    debugLog(level, msg, detail, source)
  }, [source])

  const tryCatch = useCallback(async <T>(fn: () => Promise<T>, label: string): Promise<T | null> => {
    try {
      const result = await fn()
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      debugLog('error', `${label}: ${msg}`, err instanceof Error ? err.stack?.slice(0, 200) : undefined, source)
      return null
    }
  }, [source])

  return useMemo(() => ({
    error:    (msg: string, detail?: string) => log('error', msg, detail),
    warn:     (msg: string, detail?: string) => log('warn', msg, detail),
    info:     (msg: string, detail?: string) => log('info', msg, detail),
    success:  (msg: string, detail?: string) => log('success', msg, detail),
    fix:      debugFix,
    tryCatch,
  }), [log, tryCatch])
}

/**
 * withDebug HOC — wraps a server action / API call with automatic
 * error logging and optional fallback value.
 */
export async function withDebug<T>(
  fn: () => Promise<T>,
  label: string,
  fallback?: T,
  source?: string
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    debugLog('error', `${label}: ${msg}`, undefined, source ?? 'withDebug')
    if (fallback !== undefined) return fallback
    throw err
  }
}
