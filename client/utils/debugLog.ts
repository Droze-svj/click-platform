/**
 * Centralized debug log sender with visibility checks and batching
 * to avoid "Response body disturbed or locked" when the tab is hidden or requests are aborted.
 */

const FLUSH_MS = 2500
const MAX_QUEUE = 20
const SEND_TIMEOUT_MS = 2500

type Payload = {
  component: string
  message: string
  data: Record<string, unknown>
}

let queue: Payload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function isVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (queue.length === 0) return
  const toSend = queue.splice(0, MAX_QUEUE)
  queue = []

  if (!isVisible()) return

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  fetch('/api/debug/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      component: toSend[0]?.component ?? 'DebugLog',
      message: toSend.length === 1 ? toSend[0].message : 'batch',
      data: {
        logs: toSend,
        count: toSend.length,
        timestamp: Date.now(),
      },
    }),
    signal: controller.signal,
  }).catch(() => {}).finally(() => clearTimeout(timeoutId))
}

/**
 * Queue a debug log. Batched and sent when the tab is visible; skipped when hidden.
 */
export function sendDebugLog(component: string, message: string, data: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  queue.push({ component, message, data })
  if (queue.length >= MAX_QUEUE) {
    flush()
    return
  }
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_MS)
  }
}

/**
 * Flush any queued logs immediately (e.g. on visibility change to visible).
 */
export function flushDebugLogQueue(): void {
  if (queue.length > 0 && isVisible()) flush()
}

/**
 * Send a single log immediately without batching. Still skips when tab is hidden.
 * Use for critical errors only; prefer sendDebugLog for high-frequency logs.
 */
export function sendDebugLogNow(component: string, message: string, data: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  if (!isVisible()) return
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  fetch('/api/debug/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ component, message, data: { ...data, timestamp: Date.now() } }),
    signal: controller.signal,
  }).catch(() => {}).finally(() => clearTimeout(timeoutId))
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushDebugLogQueue()
  })
}
