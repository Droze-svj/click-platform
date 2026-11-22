'use client'

import { useEffect, useState } from 'react'
import { clickVoice, type ClickIntent } from '@/lib/clickVoice'
import ClickSignal, { type ClickSignalState } from './ClickSignal'

/**
 * ClickPresence — ambient indicator that signals what Click is doing in the
 * background using Click's living <ClickSignal /> motif inside a directional
 * beam pill. Makes Click's active intelligence transparent and approachable.
 */

type PresenceState = Extract<
  ClickIntent,
  'presence.idle' | 'presence.learning' | 'presence.drafting' | 'presence.rendering'
>

const AMBIENT_CYCLE: PresenceState[] = [
  'presence.idle',
  'presence.learning',
  'presence.drafting',
]

function mapPresenceToSignal(state: PresenceState): ClickSignalState {
  switch (state) {
    case 'presence.rendering':
      return 'synthesizing'
    case 'presence.learning':
    case 'presence.drafting':
      return 'thinking'
    default:
      return 'idle'
  }
}

interface ClickPresenceProps {
  /** Force a specific state. Omit for ambient cycling. */
  state?: PresenceState
  className?: string
}

export default function ClickPresence({ state, className = '' }: ClickPresenceProps) {
  const [ambientIdx, setAmbientIdx] = useState(0)

  useEffect(() => {
    if (state) return // externally controlled — skip the cycle
    const t = setInterval(() => {
      setAmbientIdx((i) => (i + 1) % AMBIENT_CYCLE.length)
    }, 6000)
    return () => clearInterval(t)
  }, [state])

  const active = state ?? AMBIENT_CYCLE[ambientIdx]
  const copy = clickVoice(active)
  const signalState = mapPresenceToSignal(active)

  return (
    <div
      className={`click-beam-pill px-3 py-1.5 ${className}`}
      title={copy}
      aria-live="polite"
    >
      <ClickSignal state={signalState} size="xs" />
      <span className="text-[11px] font-semibold tracking-wide text-theme-secondary">
        {copy}
      </span>
    </div>
  )
}
