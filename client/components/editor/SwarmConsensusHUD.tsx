'use client'

import React, { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface SwarmConsensusHUDProps {
  isVisible: boolean
  onComplete: () => void
  taskName: string
}

/**
 * Small, honest busy indicator. It used to be a full-screen "agent debate"
 * overlay with invented agents, log lines and an integrity percentage that ran
 * on its own 3.6s timer regardless of any real work. Now it only says that
 * something is in progress and names the task the caller passed in.
 *
 * Callers own their real loading state (spinners on their buttons, result
 * toasts). They only ever hide this indicator via `onComplete`, and some defer
 * their real action until it fires — so it hands control back quickly instead
 * of holding the user up with a staged animation.
 */
const HAND_BACK_MS = 600

export const SwarmConsensusHUD: React.FC<SwarmConsensusHUDProps> = ({ isVisible, onComplete, taskName }) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isVisible) return
    const timer = setTimeout(onComplete, HAND_BACK_MS)
    return () => clearTimeout(timer)
  }, [isVisible, onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-x-0 bottom-6 z-[200] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="flex max-w-md items-center gap-3 rounded-full border border-border ds-surface-elevated px-4 py-2.5 shadow-lg"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
        <span className="ds-text-body truncate text-theme-primary">
          {taskName ? `${taskName} — ${t('swarmConsensusHUD.working')}` : t('swarmConsensusHUD.working')}
        </span>
      </div>
    </div>
  )
}
