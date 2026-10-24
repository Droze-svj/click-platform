'use client'

import React, { useState } from 'react'
import {
  Wand2, Flame, Coffee, Cpu, Heart, Sparkles, Zap, Type, Palette,
  CheckCircle2, Lock, BookOpen,
  TrendingUp, Award, Target, Rocket, Mic, type LucideIcon,
} from 'lucide-react'
import { Panel, Button, Badge, SectionHeader, UpgradeModal } from '../../ui'
import { cn } from '../../../lib/utils'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTranslation } from '@/hooks/useTranslation'
import { resolveGrade } from '../../../lib/colorGrades'
import type { CaptionTextStyle } from '../../../types/editor'

// Premium packs require the canonical `style_packs` entitlement
// (server/config/entitlements.js — "Creativity style packs", minTier creator).
// Free users lack it; the gate blocks application and opens the UpgradeModal.
const PREMIUM_PACK_FEATURE = 'style_packs'

/**
 * A pack is exactly what the editor can apply in one tap: a colour grade (an id
 * from the shared colour-grade registry, so the preview matches the export) and
 * a caption style. Packs used to list music tracks, transitions, pacing and
 * overlays they never applied, and "Apply" waited 700ms then toasted success.
 */
export interface CreativePack {
  id: string
  name: string
  icon: LucideIcon
  gradient: string
  ringColor: string
  bestFor: string[]            // niches
  premium?: boolean
  look: {
    grade: string              // id in lib/colorGrades.ts
    captionStyle: CaptionTextStyle
  }
}

const PACKS: CreativePack[] = [
  { id: 'hype', name: 'Hype Pack', icon: Flame, gradient: 'from-rose-500 via-orange-500 to-amber-400', ringColor: 'ring-rose-500/30', bestFor: ['Fitness', 'Tech', 'Product launches', 'Lifestyle'], look: { grade: 'hyper-pop', captionStyle: 'karaoke' } },
  { id: 'cozy', name: 'Cozy Vibes', icon: Coffee, gradient: 'from-amber-300 via-orange-300 to-rose-300', ringColor: 'ring-amber-400/30', bestFor: ['Lifestyle', 'Food', 'Wellness', 'Beauty'], look: { grade: 'warm', captionStyle: 'serif' } },
  { id: 'tech', name: 'Tech Energy', icon: Cpu, gradient: 'from-cyan-400 via-blue-500 to-violet-600', ringColor: 'ring-cyan-400/30', bestFor: ['Tech', 'AI', 'Coding', 'Crypto'], look: { grade: 'cyberpunk', captionStyle: 'neon' } },
  { id: 'cinematic', name: 'Cinematic Story', icon: Sparkles, gradient: 'from-slate-400 via-indigo-500 to-violet-700', ringColor: 'ring-violet-500/30', bestFor: ['Storytelling', 'Personal Brand', 'Documentary', 'Travel'], premium: true, look: { grade: 'teal-orange', captionStyle: 'cinematic' } },
  { id: 'punchy-ads', name: 'Punchy Ads', icon: Target, gradient: 'from-emerald-500 via-teal-500 to-cyan-600', ringColor: 'ring-emerald-500/30', bestFor: ['Ads', 'Product', 'Coaching', 'SaaS'], premium: true, look: { grade: 'vivid', captionStyle: 'pop' } },
  { id: 'vlog', name: 'Vlog Daily', icon: Heart, gradient: 'from-pink-400 via-rose-400 to-orange-300', ringColor: 'ring-pink-400/30', bestFor: ['Vlog', 'Lifestyle', 'POV', 'Personal Brand'], look: { grade: 'kdrama-soft', captionStyle: 'minimal' } },
  { id: 'educational', name: 'Educational Hook', icon: BookOpen, gradient: 'from-blue-500 via-indigo-500 to-violet-600', ringColor: 'ring-blue-500/30', bestFor: ['Education', 'Finance', 'Tutorial', 'How-to'], look: { grade: 'natural', captionStyle: 'high-contrast' } },
  { id: 'motivation', name: 'Motivation', icon: Award, gradient: 'from-amber-400 via-orange-500 to-rose-500', ringColor: 'ring-amber-500/30', bestFor: ['Motivation', 'Sports', 'Mindset', 'Faith'], look: { grade: 'golden-hour', captionStyle: 'bold' } },
  { id: 'comedy', name: 'Comedy Cut', icon: Zap, gradient: 'from-fuchsia-500 via-purple-500 to-indigo-600', ringColor: 'ring-fuchsia-500/30', bestFor: ['Comedy', 'Reaction', 'Stitch', 'Skit'], look: { grade: 'vibrant', captionStyle: 'uppercase' } },
  { id: 'lifestyle-aesthetic', name: 'Aesthetic Mood', icon: Sparkles, gradient: 'from-violet-300 via-pink-300 to-rose-400', ringColor: 'ring-violet-300/30', bestFor: ['Aesthetic', 'Beauty', 'Travel', 'Mood'], look: { grade: 'dreamy-pastel', captionStyle: 'minimal' } },
  { id: 'finance', name: 'Money Moves', icon: TrendingUp, gradient: 'from-emerald-400 via-green-500 to-teal-600', ringColor: 'ring-emerald-400/30', bestFor: ['Finance', 'Trading', 'Crypto', 'Investing'], premium: true, look: { grade: 'cool', captionStyle: 'bold' } },
  { id: 'podcast-clip', name: 'Podcast Clip', icon: Mic, gradient: 'from-indigo-500 via-blue-500 to-cyan-500', ringColor: 'ring-indigo-500/30', bestFor: ['Podcast', 'Interview', 'Talk show', 'Solo VO'], look: { grade: 'natural', captionStyle: 'kinetic' } },
]

/** "high-contrast" → "High contrast" */
const humaniseStyle = (id: string) => {
  const s = id.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface CreativePacksViewProps {
  /**
   * Applies the pack's colour grade + caption style to the editor. Returns
   * false when nothing could be applied (the editor reports why).
   */
  onApplyPack?: (pack: CreativePack) => boolean
}

const CreativePacksView: React.FC<CreativePacksViewProps> = ({ onApplyPack }) => {
  const { t } = useTranslation()
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { hasFeature, tier } = useEntitlements()

  const canUsePremium = hasFeature(PREMIUM_PACK_FEATURE)

  const handleApply = (pack: CreativePack) => {
    if (pack.premium && !canUsePremium) {
      // REAL gate: do NOT apply — open the paywall instead.
      setUpgradeOpen(true)
      return
    }
    if (!onApplyPack) return
    setPreviewId(null)
    // The editor applies synchronously and shows the result toast itself.
    if (onApplyPack(pack)) setAppliedId(pack.id)
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto p-6 ds-anim-rise">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2 border-amber-500/30 text-amber-500">
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            {t('creativePacksView.badge')}
          </Badge>
          <SectionHeader
            as="h1"
            title={t('creativePacksView.title')}
            description={t('creativePacksView.description', { count: PACKS.length })}
          />
        </div>
        {appliedId && (
          <Panel variant="subtle" className="flex items-center gap-2 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            <span className="ds-text-label text-emerald-500">{t('creativePacksView.appliedBanner', { name: PACKS.find(p => p.id === appliedId)?.name || '' })}</span>
          </Panel>
        )}
      </div>

      {/* Pack grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PACKS.map(pack => {
          const Icon = pack.icon
          const isApplied = appliedId === pack.id
          const isPreviewing = previewId === pack.id
          const isLocked = !!pack.premium && !canUsePremium
          const gradeLabel = resolveGrade(pack.look.grade)?.label || pack.look.grade

          return (
            <Panel
              key={pack.id}
              variant="glass"
              className={cn('flex flex-col overflow-hidden p-0', isApplied && `ring-2 ${pack.ringColor}`)}
            >
              {/* Cover */}
              <div className={cn('relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br', pack.gradient)}>
                <Icon className="h-14 w-14 text-white drop-shadow" aria-hidden />
                {pack.premium && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-amber-300/30 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                    <Lock className="h-3 w-3" aria-hidden /> Pro
                  </span>
                )}
                {isApplied && (
                  <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> {t('creativePacksView.applied')}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="ds-text-h3 text-theme-primary">{pack.name}</h3>
                <p className="mb-4 mt-1 text-sm leading-relaxed text-theme-secondary">{t(`creativePacksView.packs.${pack.id}`)}</p>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {pack.bestFor.slice(0, 4).map(n => (
                    <Badge key={n} variant="outline">{n}</Badge>
                  ))}
                </div>

                {/* What the pack sets — exactly what Apply changes */}
                {isPreviewing && (
                  <div className="mb-4 space-y-2.5 rounded-xl border border-subtle ds-surface-subtle p-4 ds-anim-fade-in">
                    <SampleRow icon={Palette} label={t('creativePacksView.colorGrade')} value={gradeLabel} />
                    <SampleRow icon={Type} label={t('creativePacksView.captionStyle')} value={humaniseStyle(pack.look.captionStyle)} />
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewId(isPreviewing ? null : pack.id)}
                  >
                    {isPreviewing ? t('creativePacksView.hideDetails') : t('creativePacksView.viewDetails')}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={isLocked ? 'secondary' : 'primary'}
                    onClick={() => handleApply(pack)}
                    disabled={!isLocked && !onApplyPack}
                    leftIcon={isLocked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : isApplied ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Rocket className="h-3.5 w-3.5" aria-hidden />}
                  >
                    {isLocked ? t('creativePacksView.unlock') : isApplied ? t('creativePacksView.applied') : t('creativePacksView.apply')}
                  </Button>
                </div>
              </div>
            </Panel>
          )
        })}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={PREMIUM_PACK_FEATURE}
        requiredTier="creator"
        currentTier={tier}
        reason="feature"
        context={t('creativePacksView.upgradeContext')}
      />
    </div>
  )
}

const SampleRow: React.FC<{ icon: LucideIcon; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
      <Icon className="h-3.5 w-3.5 text-theme-secondary" aria-hidden />
    </div>
    <div className="min-w-0 flex-1">
      <p className="ds-text-caption text-theme-muted">{label}</p>
      <p className="text-sm font-medium leading-tight text-theme-primary">{value}</p>
    </div>
  </div>
)

export default CreativePacksView
