'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import StreakWidget from './StreakWidget'
import DigestWidget from './DigestWidget'
import HeatmapWidget from './HeatmapWidget'
import NextBestTile from './NextBestTile'
import MorningBriefPanel from './MorningBriefPanel'
import CalendarAutofillPanel from './CalendarAutofillPanel'
import IdeaGeneratorPanel from './IdeaGeneratorPanel'
import CommentTriageInbox from './CommentTriageInbox'
import ResponderInbox from './ResponderInbox'
import ResponderStats from './ResponderStats'
import ResponderHistory from './ResponderHistory'
import RepurposeStudioPanel from './RepurposeStudioPanel'
import FirstCommentPanel from './FirstCommentPanel'
import ComposerPanel from './ComposerPanel'
import HookGeneratorPanel from './HookGeneratorPanel'
import VoiceMemoScriptPanel from './VoiceMemoScriptPanel'
import HashtagStrategistPanel from './HashtagStrategistPanel'
import CaptionAnglesPanel from './CaptionAnglesPanel'
import CaptionCritiquePanel from './CaptionCritiquePanel'
import CarouselComposerPanel from './CarouselComposerPanel'
import SeriesPlannerPanel from './SeriesPlannerPanel'

/** A labeled group of feature panels. */
function Group({ id, title, subtitle, children }: {
  id: string; title: string; subtitle: string; children: ReactNode
}) {
  return (
    <section id={id} aria-label={title} data-testid={`group-${id}`} className="space-y-3 scroll-mt-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">{title}</h2>
        <p className="text-xs text-theme-muted">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

/**
 * Composes the 2026 creator-feature surfaces into one dashboard, grouped into
 * scannable sections: Overview (at-a-glance health), Plan (fill the calendar),
 * Create (draft on-brand content), and Engage (comments + the responder loop).
 */
export default function FeaturesDashboard() {
  const { t } = useTranslation()
  return (
    <div data-testid="features-dashboard" className="space-y-8">
      <Group id="overview" title={t('creatorTools.dashboard.overviewTitle')} subtitle={t('creatorTools.dashboard.overviewSubtitle')}>
        <div className="md:col-span-2"><MorningBriefPanel /></div>
        <div><StreakWidget /></div>
        <div><DigestWidget /></div>
        <div className="md:col-span-2"><NextBestTile /></div>
        <div className="md:col-span-2"><HeatmapWidget /></div>
      </Group>

      <Group id="plan" title={t('creatorTools.dashboard.planTitle')} subtitle={t('creatorTools.dashboard.planSubtitle')}>
        <div className="md:col-span-2"><IdeaGeneratorPanel /></div>
        <div className="md:col-span-2"><CalendarAutofillPanel /></div>
        <div className="md:col-span-2"><SeriesPlannerPanel /></div>
      </Group>

      <Group id="create" title={t('creatorTools.dashboard.createTitle')} subtitle={t('creatorTools.dashboard.createSubtitle')}>
        <div className="md:col-span-2"><VoiceMemoScriptPanel /></div>
        <div className="md:col-span-2"><ComposerPanel /></div>
        <div><HookGeneratorPanel /></div>
        <div><CaptionAnglesPanel /></div>
        <div><HashtagStrategistPanel /></div>
        <div><FirstCommentPanel /></div>
        <div><CaptionCritiquePanel /></div>
        <div><CarouselComposerPanel /></div>
        <div><RepurposeStudioPanel /></div>
      </Group>

      <Group id="engage" title={t('creatorTools.dashboard.engageTitle')} subtitle={t('creatorTools.dashboard.engageSubtitle')}>
        <div><CommentTriageInbox /></div>
        <div className="md:col-span-2"><ResponderStats /></div>
        <div><ResponderInbox /></div>
        <div><ResponderHistory /></div>
      </Group>
    </div>
  )
}
