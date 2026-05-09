'use client'

import React from 'react'

type Props = {
  attributed?: boolean
  provider?: string
  className?: string
  message?: string
}

export default function AIServiceBanner({ attributed, provider, className, message }: Props) {
  if (attributed === undefined) return null
  if (attributed) return null

  const text =
    message ||
    (provider === 'none'
      ? 'AI temporarily offline — showing rule-based fallback results. Refresh later for full AI insights.'
      : 'AI not configured — showing rule-based fallback results.')

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        className ||
        'mt-2 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
      }
    >
      <span aria-hidden="true">⚠ </span>
      {text}
    </div>
  )
}

export function isAIDegraded(payload: any): boolean {
  if (!payload) return false
  if (payload.aiAttributed === false) return true
  if (payload.provider === 'none') return true
  if (payload.error === 'all-providers-failed') return true
  return false
}
