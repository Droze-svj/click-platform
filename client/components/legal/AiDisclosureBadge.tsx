'use client';

import React from 'react';

export type AiDisclosureLevel = 'wholly' | 'substantially' | 'lightly';

const LABELS: Record<AiDisclosureLevel, string> = {
  wholly: 'AI-generated',
  substantially: 'AI-assisted',
  lightly: 'Lightly AI-edited',
};

const COPY: Record<AiDisclosureLevel, string> = {
  wholly:
    "This media was generated wholly or substantially by AI. Treat outputs critically; verify facts independently before publishing or relying on them.",
  substantially:
    'AI was used to substantially edit, restructure, or augment this media. A C2PA provenance manifest is embedded.',
  lightly:
    'AI tools were used to assist editing (e.g. captions, color, cuts). Underlying footage is captured by the creator.',
};

/**
 * Visible AI-disclosure badge for AI-generated outputs. Used both on-screen in
 * the editor preview and baked into exports via the Remotion composition.
 *
 * Standalone, no external state. Pure presentational so it can be rendered
 * server-side, in the browser preview, or inside a headless Chromium frame
 * during render.
 */
export interface AiDisclosureBadgeProps {
  level?: AiDisclosureLevel;
  variant?: 'pill' | 'caption' | 'corner';
  className?: string;
  /** Render in dark-on-light mode (default is light-on-dark for video overlay). */
  light?: boolean;
}

export function AiDisclosureBadge({
  level = 'substantially',
  variant = 'pill',
  className = '',
  light = false,
}: AiDisclosureBadgeProps) {
  const label = LABELS[level];
  const ariaLabel = COPY[level];

  if (variant === 'caption') {
    return (
      <span
        role="note"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide ${
          light ? 'text-slate-700' : 'text-white/90'
        } ${className}`}
      >
        <Glyph light={light} />
        {label}
      </span>
    );
  }

  if (variant === 'corner') {
    return (
      <div
        role="note"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md ${
          light
            ? 'bg-white/85 text-slate-800 border border-slate-300'
            : 'bg-black/60 text-white/95 border border-white/20'
        } ${className}`}
      >
        <Glyph light={light} />
        <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  return (
    <span
      role="note"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
        light
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          : 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30'
      } ${className}`}
    >
      <Glyph light={light} />
      <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
    </span>
  );
}

function Glyph({ light }: { light: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke={light ? '#4338ca' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12l2.5 2.5L15.5 9.5" />
    </svg>
  );
}

export default AiDisclosureBadge;
