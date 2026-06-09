'use client'

import { Sparkles, X } from 'lucide-react'
import { useLandingTheme } from './LandingThemeContext'
import { NICHE_OPTIONS, LANDING_NICHES, nicheLabel } from '../../lib/nicheCatalog'
import { glass } from './_styles'

/**
 * Compact niche selector that re-tints the whole landing page to the visitor's
 * world. Honest framing — it only changes accent colors and seeds the demo /
 * plan-builder starting niche; it makes no performance claims.
 */
export default function NichePicker() {
  const { niche, setNiche, accent } = useLandingTheme()

  const niches = LANDING_NICHES
    .map((v) => NICHE_OPTIONS.find((n) => n.value === v))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))

  return (
    <div className="w-full flex justify-center px-4 -mt-2 mb-2">
      <div
        role="group"
        aria-label="Tune the page to your niche"
        className={`${glass} flex items-center gap-2 rounded-full px-3 py-2 overflow-x-auto max-w-full`}
        style={{ scrollbarWidth: 'none' }}
      >
        <span className="hidden sm:inline-flex items-center gap-1.5 pl-1 pr-1 text-[11px] font-bold uppercase tracking-wider text-white/50 shrink-0">
          <Sparkles size={12} className="text-white/40" aria-hidden />
          See Click in your colors
        </span>

        {niches.map((n) => {
          const Icon = n.icon
          const active = niche === n.value
          return (
            <button
              key={n.value}
              type="button"
              onClick={() => setNiche(active ? null : n.value)}
              aria-pressed={active ? 'true' : 'false'}
              title={n.label}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 shrink-0 ${
                active
                  ? `${accent.solidBg} text-white ${accent.ring}`
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={13} aria-hidden />
              {n.label.split(' ')[0]}
            </button>
          )
        })}

        {niche && (
          <button
            type="button"
            onClick={() => setNiche(null)}
            aria-label={`Clear niche (${nicheLabel(niche)})`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
