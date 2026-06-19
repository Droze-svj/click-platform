'use client'

import React, { useState } from 'react'
import { useAIHealth } from '@/hooks/useAIHealth'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * App-wide indicator that warns when the AI providers are unconfigured, so the
 * user is never shown canned, rule-based output mistaken for real AI. Driven by
 * the `/api/health/ai` probe via `useAIHealth` (config-only, no paid call).
 *
 * Renders nothing in the normal "live AI" case — only appears when the probe
 * definitively reports fallback mode. Dismissible for the session (the dashboard
 * layout persists across route changes, so a dismissal sticks while navigating).
 */
export default function AIHealthBanner() {
  const { t } = useTranslation()
  const { degraded } = useAIHealth()
  const [dismissed, setDismissed] = useState(false)

  if (!degraded || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ai-health-banner"
      className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-0.5">⚠</span>
        <span>
          <span className="font-semibold">{t('aiHealthBanner.title')}</span>{' '}
          {t('aiHealthBanner.message')}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('aiHealthBanner.dismiss')}
        className="shrink-0 leading-none text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
      >
        ✕
      </button>
    </div>
  )
}
