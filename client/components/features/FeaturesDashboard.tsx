'use client'

import type { ReactNode } from 'react'
import StreakWidget from './StreakWidget'
import DigestWidget from './DigestWidget'
import HeatmapWidget from './HeatmapWidget'
import CalendarAutofillPanel from './CalendarAutofillPanel'
import CommentTriageInbox from './CommentTriageInbox'
import ResponderInbox from './ResponderInbox'
import ResponderStats from './ResponderStats'
import ResponderHistory from './ResponderHistory'
import RepurposeStudioPanel from './RepurposeStudioPanel'
import FirstCommentPanel from './FirstCommentPanel'
import HookGeneratorPanel from './HookGeneratorPanel'
import HashtagStrategistPanel from './HashtagStrategistPanel'
import CaptionAnglesPanel from './CaptionAnglesPanel'
import SeriesPlannerPanel from './SeriesPlannerPanel'

/** A labeled group of feature panels. */
function Group({ id, title, subtitle, children }: {
  id: string; title: string; subtitle: string; children: ReactNode
}) {
  return (
    <section aria-label={title} data-testid={`group-${id}`} className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        <p className="text-xs text-zinc-600">{subtitle}</p>
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
  return (
    <div data-testid="features-dashboard" className="space-y-8">
      <Group id="overview" title="Overview" subtitle="How your posting is trending">
        <div><StreakWidget /></div>
        <div><DigestWidget /></div>
        <div className="md:col-span-2"><HeatmapWidget /></div>
      </Group>

      <Group id="plan" title="Plan" subtitle="Fill and structure your calendar">
        <div className="md:col-span-2"><CalendarAutofillPanel /></div>
        <div className="md:col-span-2"><SeriesPlannerPanel /></div>
      </Group>

      <Group id="create" title="Create" subtitle="Draft on-brand content fast">
        <div><HookGeneratorPanel /></div>
        <div><CaptionAnglesPanel /></div>
        <div><HashtagStrategistPanel /></div>
        <div><FirstCommentPanel /></div>
        <div><RepurposeStudioPanel /></div>
      </Group>

      <Group id="engage" title="Engage" subtitle="Triage comments and manage replies">
        <div><CommentTriageInbox /></div>
        <div className="md:col-span-2"><ResponderStats /></div>
        <div><ResponderInbox /></div>
        <div><ResponderHistory /></div>
      </Group>
    </div>
  )
}
