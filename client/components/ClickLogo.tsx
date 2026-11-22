'use client'

import React from 'react'
import { useTranslation } from '@/hooks/useTranslation'

interface ClickLogoProps {
  size?: number
  showWordmark?: boolean
  /** Add a subtle luminous aperture aura behind the brand mark (great for hero/auth). */
  aura?: boolean
  className?: string
  wordmarkClassName?: string
}

/**
 * Click brand mark: stylized open Aperture "C" pierced by a directional cursor prism.
 * Single source of truth for the logo — update this file to update the brand.
 *
 * Palette (Kinetic Aperture spectrum):
 *   indigo-deep:  #4338ca
 *   violet:       #7c3aed
 *   cyan-bright:  #38bdf8
 */
export default function ClickLogo({
  size = 32,
  showWordmark = false,
  aura = false,
  className = '',
  wordmarkClassName = '',
}: ClickLogoProps) {
  const { t } = useTranslation()
  const id = React.useId()
  return (
    <span className={`inline-flex items-center gap-2.5 text-[var(--text-main)] ${className}`}>
      <span className="relative inline-flex items-center justify-center shrink-0">
        {aura && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2 rounded-full opacity-70 blur-md"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--click-energy-lead) 45%, transparent) 0%, color-mix(in oklab, var(--click-energy-tail) 18%, transparent) 55%, transparent 75%)',
            }}
          />
        )}
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label={t('clickLogo.logoAriaLabel')}
          role="img"
          className="relative z-10"
        >
          <defs>
            <linearGradient id={`click-c-${id}`} x1="8" y1="56" x2="54" y2="10" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#4338ca" />
              <stop offset="52%"  stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id={`click-arrow-${id}`} x1="36" y1="40" x2="58" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#7c3aed" />
              <stop offset="65%"  stopColor="#6366f1" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Curled Aperture "C" — concentrates energy at its sharp leading tip */}
          <path
            d="M48 12c-7-4-16-3-22 2C18 21 14 31 18 41c4 9 14 14 23 12 4-1 7-3 10-6"
            stroke={`url(#click-c-${id})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Directional Cursor Prism piercing the aperture opening */}
          <path
            d="M38 30 L57 30 L48 39 L52 49 L46 51 L42 41 L33 47 Z"
            fill={`url(#click-arrow-${id})`}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            opacity="0.92"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={`leading-none text-[var(--text-main)] ${
          /text-(xs|sm|base|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/.test(wordmarkClassName) ? '' : 'text-lg'
        } ${
          /font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/.test(wordmarkClassName) ? '' : 'font-black'
        } ${
          /tracking-(tighter|tight|normal|wide|wider|widest)/.test(wordmarkClassName) ? '' : 'tracking-tight'
        } ${wordmarkClassName}`}>
          {t('clickLogo.wordmark')}
        </span>
      )}
    </span>
  )
}
