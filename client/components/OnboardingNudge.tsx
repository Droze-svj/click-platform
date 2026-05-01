'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { usePathname } from 'next/navigation'

/**
 * OnboardingNudge — soft first-run banner.
 *
 * The dashboard onboarding tour at /dashboard/onboarding exists but is
 * optional: a fresh user can skip it and end up dropped in the dense
 * dashboard. This banner appears on the dashboard root for new users and
 * gently points them at the tour. Dismissable; never re-shows once
 * dismissed (writes a flag to localStorage).
 *
 * Renders nothing on /dashboard/onboarding itself or after the user has
 * either dismissed it or visited the onboarding page.
 */

const DISMISS_KEY = 'click-onboarding-nudge-dismissed'

export default function OnboardingNudge() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Only consider showing on the dashboard root.
    if (pathname !== '/dashboard') {
      setShow(false)
      return
    }
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY) === '1'
      const visitedOnboarding = localStorage.getItem('click-onboarding-complete') === '1'
      setShow(!dismissed && !visitedOnboarding)
    } catch {
      // localStorage unavailable — default to showing once per page load.
      setShow(true)
    }
  }, [pathname])

  if (!show) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* best-effort */ }
    setShow(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 sm:mx-6 lg:mx-12 mt-6 max-w-[1900px] xl:mx-auto rounded-2xl border border-[var(--tint-indigo-edge)] bg-[var(--tint-indigo-bg)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[var(--glass-surface)] border border-[var(--tint-indigo-edge)] flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-[var(--tint-indigo-fg)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-main)] leading-snug">
            New to Click? Take the 5-step tour to set up your style and connect a platform.
          </p>
          <p className="text-xs text-[var(--text-dim)] leading-snug mt-0.5">
            Two minutes, then the AI is calibrated for your niche.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--tint-indigo-fg)] text-[var(--page-bg)] text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
        >
          Start tour <ArrowRight size={12} />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss onboarding nudge"
          className="w-9 h-9 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--glass-surface-heavy)] transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
