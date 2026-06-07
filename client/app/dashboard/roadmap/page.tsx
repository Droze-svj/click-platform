'use client'

/**
 * /dashboard/roadmap — public-facing product roadmap.
 *
 * Single source of truth for "what's shipping" so we can replace ambiguous
 * "Coming Soon" copy elsewhere with a Link href="/dashboard/roadmap" and
 * keep one canonical place to update status. The list is authored statically
 * here; treat the file as a roadmap document, not a feature.
 *
 * Status taxonomy:
 *   shipped     — live in production today
 *   in-progress — being built right now
 *   next-up     — committed, scheduled, work hasn't started
 *   exploring   — researching; no commitment
 */

import Link from 'next/link'
import { CheckCircle, Loader2, Calendar, Lightbulb, Sparkles, ExternalLink, type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { Panel, SectionHeader, Badge } from '../../../components/ui'
import { cn } from '../../../lib/utils'

type Status = 'shipped' | 'in-progress' | 'next-up' | 'exploring'

interface RoadmapItem {
  id: string
  title: string
  description: string
  status: Status
  category: 'editor' | 'intelligence' | 'workflow' | 'platform' | 'design'
  href?: string
}

// Authored list — keep it tight and honest. Update when status changes.
const ROADMAP: RoadmapItem[] = [
  // ── Shipped ───────────────────────────────────────────────────────────────
  { id: 'tintTokens', title: 'WCAG-AA tinted token system', description: 'Every accent color now has light/dark-tested foreground/background/edge tokens so badges read cleanly in both modes.', status: 'shipped', category: 'design' },
  { id: 'focusMode', title: 'Global Focus Mode toggle', description: 'One sidebar button calms ambient animations and collapses secondary panels across the entire app.', status: 'shipped', category: 'design' },
  { id: 'strategist', title: 'Marketing Strategist with niche playbooks', description: 'Niche-aware Gemini chat backed by 8 playbook libraries, with anti-repetition guarding the suggestion stream.', status: 'shipped', category: 'intelligence', href: '/dashboard/strategist' },
  { id: 'styleDna', title: 'Style DNA bias-blending', description: 'The editor now derives your taste from your persisted picks, not just the current edit.', status: 'shipped', category: 'editor' },
  { id: 'workflowAutoAdvance', title: 'Workflow auto-advance', description: 'Stages mark themselves complete as you naturally move forward through Forge → Script → Edit → Schedule → Analyze.', status: 'shipped', category: 'workflow' },
  { id: 'learningLoop', title: 'Continuous learning loop on publish', description: 'Every analytics sync now folds retention deltas back into your weighted style profile.', status: 'shipped', category: 'intelligence' },
  { id: 'nicheCapture', title: 'Niche capture in onboarding', description: 'Picking your category once cascades through every AI surface — strategist, editor, scheduler.', status: 'shipped', category: 'workflow', href: '/dashboard/onboarding' },

  // ── In progress ───────────────────────────────────────────────────────────
  { id: 'tintSweep', title: 'Tint-token sweep across all pages', description: 'A bulk pull request migrating the remaining 200+ pages to the new token system. Awaits CI green and merge.', status: 'in-progress', category: 'design' },
  { id: 'abVariants', title: 'A/B variant generator on hooks', description: 'Show 3 hook variants per AI suggestion, with the variant you pick feeding back into your weightedHooks profile.', status: 'in-progress', category: 'intelligence' },

  // ── Next up ───────────────────────────────────────────────────────────────
  { id: 'benchmarks', title: 'Cross-creator anonymized benchmarks', description: 'Aggregate insights surfaced in the strategist: "creators in your niche posting at 7am LATAM saw 23% higher 7-day retention."', status: 'next-up', category: 'intelligence' },
  { id: 'brandConsolidation', title: 'Brand consolidation', description: 'Pick one top-level brand surface ("Click") and rename ~80% of "Neural"/"Sovereign" labels to action descriptors. Reduces cognitive load for new users.', status: 'next-up', category: 'design' },
  { id: 'fineTuning', title: 'Per-creator model fine-tuning', description: 'Once your weightedPerformance profile reaches enough samples, an offline pipeline tunes a personal LoRA so every Gemini call is biased to your voice.', status: 'next-up', category: 'intelligence' },

  // ── Exploring ─────────────────────────────────────────────────────────────
  { id: 'teamWorkspaces', title: 'Multi-creator team workspaces', description: 'Shared brand kit, shared style profile, role-based publishing. Foundation exists; UI work pending.', status: 'exploring', category: 'platform' },
  { id: 'mobileCapture', title: 'Native mobile capture app', description: 'Record + auto-cut + queue from phone, sync to the desktop editor. Unlocks "1-tap publish from where you film."', status: 'exploring', category: 'platform' },
]

const STATUS_META: Record<Status, { label: string; icon: LucideIcon; classes: string }> = {
  'shipped':      { label: 'Shipped',      icon: CheckCircle, classes: 'bg-[var(--tint-emerald-bg)] text-[var(--tint-emerald-fg)] border-[var(--tint-emerald-edge)]' },
  'in-progress':  { label: 'In progress',  icon: Loader2,     classes: 'bg-[var(--tint-amber-bg)] text-[var(--tint-amber-fg)] border-[var(--tint-amber-edge)]' },
  'next-up':      { label: 'Next up',      icon: Calendar,    classes: 'bg-[var(--tint-indigo-bg)] text-[var(--tint-indigo-fg)] border-[var(--tint-indigo-edge)]' },
  'exploring':    { label: 'Exploring',    icon: Lightbulb,   classes: 'bg-[var(--tint-fuchsia-bg)] text-[var(--tint-fuchsia-fg)] border-[var(--tint-fuchsia-edge)]' },
}

const CATEGORY_LABEL: Record<RoadmapItem['category'], string> = {
  editor: 'Editor',
  intelligence: 'Marketing AI',
  workflow: 'Workflow',
  platform: 'Platform',
  design: 'Design system',
}

export default function RoadmapPage() {
  const { t } = useTranslation()
  const sections: Status[] = ['shipped', 'in-progress', 'next-up', 'exploring']
  const grouped = sections.map(s => ({ status: s, items: ROADMAP.filter(r => r.status === s) }))

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1400px] mx-auto overflow-x-hidden text-theme-primary">
      <SectionHeader
        as="h1"
        title={t('roadmapPage.title')}
        description={t('roadmapPage.subtitle')}
        className="mb-10"
      />

      <div className="space-y-12">
        {grouped.map(group => {
          if (group.items.length === 0) return null
          const meta = STATUS_META[group.status]
          const StatusIcon = meta.icon
          return (
            <section key={group.status}>
              <div className="flex items-center gap-3 mb-5">
                <span className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold', meta.classes)}>
                  <StatusIcon size={12} className={group.status === 'in-progress' ? 'animate-spin' : ''} aria-hidden />
                  {t(`roadmapPage.status_${group.status}`) || meta.label}
                </span>
                <span className="ds-text-caption text-theme-muted tabular-nums">{group.items.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map(item => (
                  <Panel key={item.id} variant="bento" className="flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="ds-text-h3 text-theme-primary leading-tight">{t(`roadmapPage.item_${item.id}_title`) || item.title}</h3>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {t(`roadmapPage.category_${item.category}`) || CATEGORY_LABEL[item.category]}
                      </Badge>
                    </div>
                    <p className="text-sm text-theme-muted leading-relaxed">{t(`roadmapPage.item_${item.id}_description`) || item.description}</p>
                    {item.href && (
                      <Link
                        href={item.href}
                        className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary hover:underline"
                      >
                        {t('roadmapPage.open')} <ExternalLink size={14} aria-hidden />
                      </Link>
                    )}
                  </Panel>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="mt-12 pt-8 border-t border-[var(--border-subtle)]">
        <p className="text-sm text-theme-muted flex items-center gap-2">
          <Sparkles size={14} className="text-primary" aria-hidden />
          {t('roadmapPage.feedbackPrompt')} <a href="mailto:hello@click.example" className="text-primary hover:underline">hello@click.example</a>.
        </p>
      </footer>
    </div>
  )
}
