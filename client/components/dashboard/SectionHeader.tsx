'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

/**
 * SectionHeader — single shared dashboard section header.
 *
 * Why a shared component: every dashboard sub-page used to roll its own
 * header markup, which produced (a) inconsistent styling between pages,
 * (b) jargon-vs-plain naming drift between the sidebar label and the
 * page heading, (c) different padding/icon sizes on each page.
 *
 * One component → one visual contract, one place to evolve naming.
 *
 * Naming rule: `title` should match the sidebar label (the user's mental
 * model of where they are). `kicker` is the niche-tuned flavor text that
 * floats above. `subtitle` is the one-line plain-language summary.
 */

export type SectionTone = 'studio' | 'publish' | 'grow' | 'manage' | 'neutral'

const TONE_STYLES: Record<SectionTone, { iconBg: string; iconBorder: string; iconColor: string; kickerColor: string }> = {
  studio:  { iconBg: 'bg-violet-500/10',  iconBorder: 'border-violet-500/30',  iconColor: 'text-violet-300',  kickerColor: 'text-violet-300/80' },
  publish: { iconBg: 'bg-amber-500/10',   iconBorder: 'border-amber-500/30',   iconColor: 'text-amber-300',   kickerColor: 'text-amber-300/80' },
  grow:    { iconBg: 'bg-emerald-500/10', iconBorder: 'border-emerald-500/30', iconColor: 'text-emerald-300', kickerColor: 'text-emerald-300/80' },
  manage:  { iconBg: 'bg-sky-500/10',     iconBorder: 'border-sky-500/30',     iconColor: 'text-sky-300',     kickerColor: 'text-sky-300/80' },
  neutral: { iconBg: 'bg-white/5',        iconBorder: 'border-white/10',       iconColor: 'text-slate-200',   kickerColor: 'text-slate-400' },
}

interface SectionHeaderProps {
  /** The plain-language title shown as <h1>. Should match the sidebar label. */
  title: string
  /** Optional all-caps flavor line above the title. Kept short. */
  kicker?: string
  /** One-line summary explaining what this page is for. */
  subtitle?: string
  /** Lucide icon shown in the colored tile. */
  icon?: LucideIcon
  /** Color tone — picks Studio / Publish / Grow / Manage palette. */
  tone?: SectionTone
  /** Optional back link rendered above the title (e.g. "Back to Analytics"). */
  back?: { href: string; label: string }
  /** Right-side actions (buttons, badges, segmented controls). */
  actions?: React.ReactNode
  /** Optional badges row beneath the subtitle (status pills). */
  badges?: React.ReactNode
}

export function SectionHeader({
  title,
  kicker,
  subtitle,
  icon: Icon,
  tone = 'neutral',
  back,
  actions,
  badges,
}: SectionHeaderProps) {
  const t = TONE_STYLES[tone]
  return (
    <header className="flex flex-col gap-6 mb-10">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-2 self-start text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="flex items-start gap-5 min-w-0">
          {Icon && (
            <div className={`shrink-0 w-16 h-16 rounded-2xl ${t.iconBg} border ${t.iconBorder} flex items-center justify-center shadow-lg`}>
              <Icon className={`w-7 h-7 ${t.iconColor}`} aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            {kicker && (
              <p className={`text-[10px] font-bold uppercase tracking-[0.32em] ${t.kickerColor} mb-2`}>
                {kicker}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.05]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-400 text-sm md:text-base font-medium mt-2 max-w-2xl">
                {subtitle}
              </p>
            )}
            {badges && <div className="flex flex-wrap items-center gap-2 mt-4">{badges}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </header>
  )
}

export default SectionHeader
