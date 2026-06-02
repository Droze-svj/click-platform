'use client'

import React from 'react'

interface ClickLogoProps {
  size?: number
  showWordmark?: boolean
  className?: string
  wordmarkClassName?: string
}

/**
 * Click brand mark: stylized "C" with cursor arrow.
 * Single source of truth for the logo — update this file to update the brand.
 *
 * Palette (matches the uploaded brand asset):
 *   indigo-deep:  #3b3192
 *   violet:       #7c3aed
 *   cyan-bright:  #4f8df7
 *   navy:         #1e293b (wordmark)
 */
export default function ClickLogo({
  size = 32,
  showWordmark = false,
  className = '',
  wordmarkClassName = '',
}: ClickLogoProps) {
  const id = React.useId()
  return (
    <span className={`inline-flex items-center gap-2.5 text-[var(--text-main)] ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Click logo"
        role="img"
      >
        <defs>
          <linearGradient id={`click-c-${id}`} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#3b3192" />
            <stop offset="55%"  stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4f8df7" />
          </linearGradient>
          <linearGradient id={`click-arrow-${id}`} x1="38" y1="38" x2="56" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4f8df7" />
          </linearGradient>
        </defs>

        {/* Curled "C" — opens to the right with a soft tail at top */}
        <path
          d="M48 12c-7-4-16-3-22 2C18 21 14 31 18 41c4 9 14 14 23 12 4-1 7-3 10-6"
          stroke={`url(#click-c-${id})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Cursor arrow piercing the C opening — stroke uses currentColor
            so it stays legible in both light and dark themes (parent sets
            color via text-[var(--text-main)] on the wrapping span). */}
        <path
          d="M38 30 L57 30 L48 39 L52 49 L46 51 L42 41 L33 47 Z"
          fill={`url(#click-arrow-${id})`}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
      {showWordmark && (
        <span className={`leading-none text-[var(--text-main)] ${
          /text-(xs|sm|base|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/.test(wordmarkClassName) ? '' : 'text-lg'
        } ${
          /font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/.test(wordmarkClassName) ? '' : 'font-black'
        } ${
          /tracking-(tighter|tight|normal|wide|wider|widest)/.test(wordmarkClassName) ? '' : 'tracking-tight'
        } ${wordmarkClassName}`}>
          Click
        </span>
      )}
    </span>
  )
}
