'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Minimal, GDPR/ePrivacy-aware cookie consent banner.
 *
 * Design choices:
 * - We only show the banner ONCE per browser. The user's choice goes into
 *   localStorage under a versioned key so we can re-prompt if our policy
 *   materially changes.
 * - "Accept all" enables analytics. "Reject" leaves strictly-necessary
 *   only. Both choices satisfy informed consent — we do NOT pre-tick.
 * - There's no "cookie wall": rejecting doesn't lock you out of the
 *   product, which is the requirement under GDPR + ePrivacy.
 * - The banner is dismissible without choosing, which counts as
 *   "no consent" → strictly-necessary cookies only, never analytics.
 */
const STORAGE_KEY = 'click.cookieConsent.v1'

type Choice = 'accepted' | 'rejected' | null

export function CookieConsent() {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<Choice>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Choice
      if (stored === 'accepted' || stored === 'rejected') {
        setChoice(stored)
      }
    } catch {
      // Storage blocked (private mode, etc.) — banner re-shows next load,
      // which is fine. We never persist consent we couldn't read back.
    }
  }, [])

  const persist = (value: 'accepted' | 'rejected') => {
    setChoice(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Best-effort — see comment above.
    }
    // Notify any listener (analytics loader, e.g.) that consent changed.
    try {
      window.dispatchEvent(new CustomEvent('click:cookie-consent', { detail: value }))
    } catch {
      /* ignore */
    }
  }

  // SSR: render nothing on the server so the banner doesn't flash for users
  // who've already chosen.
  if (!mounted || choice !== null) return null

  return (
    <div
      role="dialog"
      aria-label={t('cookieConsent.dialogLabel')}
      aria-describedby="cookie-consent-body"
      className="fixed inset-x-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[100] bg-surface-card border-2 border-surface-100 dark:border-white/10 rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl p-6 sm:p-7"
    >
      <h2 className="text-sm font-bold text-surface-900 dark:text-white mb-2">{t('cookieConsent.heading')}</h2>
      <p id="cookie-consent-body" className="text-xs text-surface-500 dark:text-slate-400 leading-relaxed mb-5">
        {t('cookieConsent.bodyIntro')}{' '}
        <Link href="/dashboard/settings" className="text-primary-500 hover:underline">{t('cookieConsent.settingsLink')}</Link>.
        {' '}{t('cookieConsent.bodySeeOur')}{' '}
        <Link href="/cookies" className="text-primary-500 hover:underline">{t('cookieConsent.cookiePolicyLink')}</Link>.
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => persist('rejected')}
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-surface-100 dark:border-white/10 bg-surface-page dark:bg-black/30 text-xs font-bold text-surface-700 dark:text-slate-300 hover:border-surface-200 dark:hover:border-white/20 transition-colors"
        >
          {t('cookieConsent.rejectButton')}
        </button>
        <button
          type="button"
          onClick={() => persist('accepted')}
          className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-xs font-bold hover:bg-primary-600 transition-colors shadow-lg"
        >
          {t('cookieConsent.acceptButton')}
        </button>
      </div>
    </div>
  )
}
