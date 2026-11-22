import React from 'react'
import { cn } from '../../lib/utils'

export type AmbientCanvasVariant = 'app' | 'hero' | 'auth' | 'legal'

export interface ClickAmbientCanvasProps {
  /**
   * Controls atmospheric density and framing:
   * - `app`: subtle, studio-calibrated depth behind the dashboard workspace
   * - `hero`: expressive directional aperture beams for the marketing landing page
   * - `auth`: centered aperture spotlight framing sign-in / onboarding vessels
   * - `legal`: quiet editorial wash optimized for long-form reading
   */
  variant?: AmbientCanvasVariant
  /** Position strategy. Defaults to `fixed` so the atmosphere persists across scroll. */
  positioning?: 'fixed' | 'absolute'
  className?: string
}

/**
 * ClickAmbientCanvas — Click's software-wide atmospheric background ("Kinetic Aperture").
 *
 * Pure CSS + inline geometry (no `'use client'`, zero JS runtime cost), safe for
 * both Server Components (e.g. `AuthShell`, `LegalPage`) and Client layouts
 * (`dashboard/layout.tsx`, landing `app/page.tsx`).
 *
 * Visual grammar inspired by directional energy storytelling:
 *  1. Deep optical base (obsidian-indigo dark / porcelain-alabaster light)
 *  2. Directional aperture beams — sharp luminous leading edges diffusing softly at the tail
 *  3. Signature open-aperture hairline arc echoing Click's brand mark
 *  4. Whisper-subtle studio viewfinder micro-dot reticle masked radially at the perimeter
 *
 * Automatically adapts to:
 *  - light & dark themes (`.dark` / `:root`)
 *  - active Click Swarm mood (`html[data-swarm="viral|trust|coach|authority"]`)
 *  - `prefers-reduced-motion`, `data-reduced-motion="true"`, and Focus Mode (`data-focus-mode="true"`)
 *  - Windows Forced Colors Mode (`@media (forced-colors: active)`)
 */
export default function ClickAmbientCanvas({
  variant = 'app',
  positioning = 'fixed',
  className,
}: ClickAmbientCanvasProps) {
  const gradId = `click-arc-grad-${React.useId().replace(/:/g, '')}`
  return (
    <div
      aria-hidden="true"
      data-click-atmosphere={variant}
      className={cn(
        'click-atmosphere pointer-events-none select-none overflow-hidden',
        positioning === 'fixed' ? 'fixed inset-0' : 'absolute inset-0',
        className
      )}
    >
      {/* Layer 1: Primary directional energy ribbon (sharp leading edge → diffused tail) */}
      <div className="click-atmosphere-beam click-atmosphere-beam-primary" />

      {/* Layer 2: Counter-balancing harmonic bloom */}
      <div className="click-atmosphere-beam click-atmosphere-beam-secondary" />

      {/* Layer 3: Warm spatial horizon glow */}
      <div className="click-atmosphere-beam click-atmosphere-beam-tertiary" />

      {/* Layer 4: Signature open-aperture hairline ring echoing Click's "C" arc */}
      <svg
        className="click-atmosphere-aperture-svg"
        viewBox="0 0 1200 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--click-energy-lead)" stopOpacity="0.45" />
            <stop offset="52%" stopColor="var(--click-energy-mid)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--click-energy-tail)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Open aperture arc — concentrates energy at the leading curve, dissolves at the tail */}
        <path
          d="M 885 110 A 440 440 0 1 0 920 745"
          stroke={`url(#${gradId})`}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M 760 220 A 295 295 0 1 0 790 655"
          stroke={`url(#${gradId})`}
          strokeWidth="0.9"
          strokeDasharray="3 9"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>

      {/* Layer 5: Studio viewfinder micro-dot reticle, radially masked toward the edges */}
      <div className="click-atmosphere-reticle" />

      {/* Layer 6: Soft radial vignette to anchor typography & elevation */}
      <div className="click-atmosphere-vignette" />
    </div>
  )
}
