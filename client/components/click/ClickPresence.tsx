'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { clickVoice, type ClickIntent } from '@/lib/clickVoice'

/**
 * ClickPresence — tiny ambient indicator in the dashboard header that
 * signals what Click is doing in the background. Concretely makes the
 * "Click grows with users" promise visible: idle → drafting → learning →
 * rendering, looped quietly.
 *
 * Drop into any persistent surface (e.g. <DashboardLayout> header).
 * State can be:
 *  - driven externally (pass `state` prop) when you know what Click is
 *    actively doing (e.g. during render, set 'rendering'),
 *  - or left ambient (no prop) — cycles through idle/learning/drafting
 *    every ~6s so the dashboard never feels frozen.
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
  const isActive = active !== 'presence.idle'

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] ${className}`}
      title={copy}
      aria-live="polite"
    >
      <Sparkles
        className={`w-3 h-3 ${isActive ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`}
        aria-hidden="true"
      />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
        {copy}
      </span>
    </div>
  )
}
