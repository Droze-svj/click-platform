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
import { Compass, CheckCircle, Loader2, Calendar, Lightbulb, Sparkles, ArrowRight, ExternalLink } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

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

const STATUS_META: Record<Status, { label: string; icon: any; classes: string }> = {
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
    <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-6 lg:px-12 pt-12 max-w-[1400px] mx-auto space-y-12 font-inter bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--tint-fuchsia-bg)] border-2 border-[var(--tint-fuchsia-edge)] flex items-center justify-center">
            <Compass size={28} className="text-[var(--tint-fuchsia-fg)]" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--tint-fuchsia-fg)] italic">{t('roadmapPage.kicker')}</span>
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight leading-tight mt-1">
              {t('roadmapPage.title')}
            </h1>
            <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xl">
              {t('roadmapPage.subtitle')}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] text-xs font-bold uppercase tracking-widest transition-colors"
        >
          {t('roadmapPage.backToDashboard')} <ArrowRight size={14} />
        </Link>
      </header>

      {grouped.map(group => {
        if (group.items.length === 0) return null
        const meta = STATUS_META[group.status]
        const StatusIcon = meta.icon
        return (
          <section key={group.status}>
            <h2 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-[var(--text-dim)] italic mb-5">
              <span className={`px-3 py-1 rounded-full border text-[10px] flex items-center gap-2 ${meta.classes}`}>
                <StatusIcon size={12} className={group.status === 'in-progress' ? 'animate-spin' : ''} />
                {t(`roadmapPage.status_${group.status}`) || meta.label}
              </span>
              <span className="text-[var(--text-dim)]">· {group.items.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.items.map(item => (
                <article
                  key={item.id}
                  className="p-6 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-[var(--text-main)] leading-tight">{t(`roadmapPage.item_${item.id}_title`) || item.title}</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)] flex-shrink-0">
                      {t(`roadmapPage.category_${item.category}`) || CATEGORY_LABEL[item.category]}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-dim)] leading-relaxed">{t(`roadmapPage.item_${item.id}_description`) || item.description}</p>
                  {item.href && (
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 mt-4 text-[11px] font-bold text-[var(--tint-indigo-fg)] uppercase tracking-widest hover:text-[var(--text-main)] transition-colors"
                    >
                      {t('roadmapPage.open')} <ExternalLink size={11} />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        )
      })}

      <footer className="pt-8 border-t border-[var(--glass-border)]">
        <p className="text-xs text-[var(--text-dim)] flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--tint-indigo-fg)]" />
          {t('roadmapPage.feedbackPrompt')} <a href="mailto:hello@click.example" className="text-[var(--tint-indigo-fg)] hover:underline">hello@click.example</a>.
        </p>
      </footer>
    </div>
  )
}
