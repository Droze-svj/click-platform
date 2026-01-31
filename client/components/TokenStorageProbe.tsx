'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __tokenStorageProbeInstalled?: boolean
  }
}

export default function TokenStorageProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__tokenStorageProbeInstalled) return
    window.__tokenStorageProbeInstalled = true

    const safeStack = () => {
      try {
        const s = String(new Error().stack || '')
        // avoid giant payloads
        return s.split('\n').slice(0, 8).join('\n')
      } catch {
        return ''
      }
    }

    // Batch debug logs to reduce spam
    let logQueue: Array<{ message: string; data: Record<string, any> }> = []
    let logTimeout: ReturnType<typeof setTimeout> | null = null
    
    const flushLogs = () => {
      if (logQueue.length === 0) return
      
      const logs = [...logQueue]
      logQueue = []
      logTimeout = null
      
          // Send batched logs with timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
          
          fetch('/api/debug/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              component: 'TokenStorageProbe',
              message: 'token_storage_batch',
              data: {
                logs,
                timestamp: Date.now(),
                count: logs.length
              }
            }),
            signal: controller.signal
          }).catch((err) => {
            // Only log errors in development to avoid console spam
            if (process.env.NODE_ENV === 'development') {
              // Don't log AbortError (timeout) as it's expected behavior
              if (err.name !== 'AbortError') {
                console.warn('TokenStorageProbe: Debug log send failed:', err.message || err)
              }
            }
          }).finally(() => {
            clearTimeout(timeoutId)
          })
    }
    
    const send = (message: string, data: Record<string, any>) => {
      try {
        // Only log in development to reduce console spam
        if (process.env.NODE_ENV === 'development') {
          console.log('TokenStorageProbe:', message, data)
        }
        
        // Add to queue
        logQueue.push({ message, data: { ...data, timestamp: Date.now() } })
        
        // Flush immediately for important messages, or batch for others
        if (message.includes('error') || message.includes('remove')) {
          // Flush immediately for errors and removals
          if (logTimeout) {
            clearTimeout(logTimeout)
            logTimeout = null
          }
          flushLogs()
        } else {
          // Batch other messages - flush after 2 seconds of inactivity
          if (logTimeout) {
            clearTimeout(logTimeout)
          }
          logTimeout = setTimeout(flushLogs, 2000)
        }
      } catch (err) {
        // Silently handle any errors in the send function itself
        if (process.env.NODE_ENV === 'development') {
          console.warn('TokenStorageProbe: Error in send function:', err)
        }
      }
    }

    const origGetItem = localStorage.getItem.bind(localStorage)
    const origSetItem = localStorage.setItem.bind(localStorage)
    const origRemoveItem = localStorage.removeItem.bind(localStorage)
    const origClear = localStorage.clear.bind(localStorage)

    localStorage.setItem = ((key: string, value: string) => {
      try {
        if (key === 'token') {
          // Only log if the value actually changed and it's a significant change
          const currentValue = origGetItem ? origGetItem(key) : null
          if (currentValue !== value) {
            // Throttle token logging - only log if it's been more than 1 second since last log
            const lastLogKey = '__tokenStorageProbe_lastLog'
            const lastLog = parseInt(origGetItem(lastLogKey) || '0', 10)
            const now = Date.now()
            
            // Only log if it's been more than 1 second, or if the token length changed significantly
            const lengthChanged = Math.abs((currentValue?.length || 0) - (value?.length || 0)) > 10
            if (now - lastLog > 1000 || lengthChanged) {
              send('token_storage_set', {
                key,
                valueLength: value?.length || 0,
                href: window.location.href,
                pathname: window.location.pathname,
                stack: safeStack(),
                timestamp: now
              })
              // Use original setItem to avoid infinite loop
              origSetItem(lastLogKey, String(now))
            }
          }
        }
        return origSetItem(key, value)
      } catch (err) {
        // If anything fails, still try to set the item using original function
        console.warn('TokenStorageProbe: Error in setItem override:', err)
        return origSetItem(key, value)
      }
    }) as any

    localStorage.removeItem = ((key: string) => {
      try {
        if (key === 'token') {
          send('token_storage_remove', {
            key,
            href: window.location.href,
            pathname: window.location.pathname,
            stack: safeStack(),
            timestamp: Date.now()
          })
        }
        return origRemoveItem(key)
      } catch (err) {
        // If anything fails, still try to remove the item using original function
        console.warn('TokenStorageProbe: Error in removeItem override:', err)
        return origRemoveItem(key)
      }
    }) as any

    localStorage.clear = (() => {
      return origClear()
    }) as any
    
    // Cleanup function to flush any pending logs on unmount
    return () => {
      if (logTimeout) {
        clearTimeout(logTimeout)
        logTimeout = null
      }
      // Flush any remaining logs
      if (logQueue.length > 0) {
        flushLogs()
      }
    }
  }, [])

  return null
}
