import React from 'react'
import { cn } from '../../lib/utils'

export type ClickSignalState = 'idle' | 'thinking' | 'synthesizing' | 'complete'
export type ClickSignalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ClickSignalProps {
  /**
   * Living visual state representing Click's intelligence:
   * - `idle`: serene breathing aperture
   * - `thinking`: concentrated directional gradient arc orbiting the aperture
   * - `synthesizing`: rippling radial waves radiating from the focal prism
   * - `complete`: crisp harmonic lock-in
   */
  state?: ClickSignalState
  size?: ClickSignalSize
  /** Accessible label when used standalone; omit when accompanied by visible text. */
  label?: string
  className?: string
}

const SIZE_PX: Record<ClickSignalSize, number> = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
  xl: 64,
}

/**
 * ClickSignal — Click's signature AI presence & active-thinking motif.
 *
 * Built from Click's foundational geometric DNA: an open rounded Aperture Arc
 * cradling a directional Focus Cursor Prism. Instead of opaque generic spinners,
 * ClickSignal visualizes active synthesis with a sharp luminous leading edge
 * that diffuses organically at its tail — adapting automatically to light/dark
 * themes, active Swarm mood (`data-swarm`), reduced-motion, and Focus Mode.
 */
export default function ClickSignal({
  state = 'idle',
  size = 'md',
  label,
  className,
}: ClickSignalProps) {
  const id = React.useId().replace(/:/g, '')
  const px = SIZE_PX[size]
  const decorative = !label

  return (
    <span
      data-click-signal={state}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative ? 'true' : undefined}
      style={{ width: px, height: px }}
      className={cn(
        'click-signal relative inline-flex shrink-0 items-center justify-center align-middle',
        className
      )}
    >
      {/* Ethereal halo — concentrates energy around the aperture during active states */}
      <span className="click-signal-halo" aria-hidden="true" />

      {/* Rippling radial wave — visible during synthesizing */}
      {state === 'synthesizing' && (
        <>
          <span className="click-signal-ripple click-signal-ripple-1" aria-hidden="true" />
          <span className="click-signal-ripple click-signal-ripple-2" aria-hidden="true" />
        </>
      )}

      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 overflow-visible"
        focusable="false"
      >
        <defs>
          {/* Directional spectrum: crisp luminous leading edge → diffused tail */}
          <linearGradient id={`cs-arc-${id}`} x1="40" y1="8" x2="8" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--click-energy-lead)" stopOpacity="1" />
            <stop offset="50%" stopColor="var(--click-energy-mid)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--click-energy-tail)" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={`cs-prism-${id}`} x1="22" y1="20" x2="40" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--click-energy-lead)" />
            <stop offset="100%" stopColor="var(--click-energy-mid)" />
          </linearGradient>
        </defs>

        {/* Subtle resting track */}
        <circle
          cx="24"
          cy="24"
          r="17"
          stroke="var(--click-energy-mid)"
          strokeOpacity="0.16"
          strokeWidth="2.5"
        />

        {/* Dynamic Aperture Arc — orbits during thinking, breathes during idle */}
        <g className="click-signal-orbit">
          <path
            d="M 36.2 12.2 A 17 17 0 1 0 37.8 33.8"
            stroke={`url(#cs-arc-${id})`}
            strokeWidth="4.2"
            strokeLinecap="round"
            className="click-signal-arc"
          />
          {/* Sharp opaque leading point of energy */}
          <circle
            cx="36.2"
            cy="12.2"
            r="2.4"
            fill="var(--click-energy-lead)"
            className="click-signal-spark"
          />
        </g>

        {/* Focal Cursor Prism — echoes ClickLogo's directional pointer */}
        <path
          d="M 24.5 21.5 L 38.5 24 L 31.8 29.2 L 33.5 36.5 L 28.6 37.4 L 26.8 30.2 L 21.2 34 Z"
          fill={`url(#cs-prism-${id})`}
          className="click-signal-prism"
        />
      </svg>
    </span>
  )
}
