'use client'

import StreakWidget from './StreakWidget'
import DigestWidget from './DigestWidget'
import CalendarAutofillPanel from './CalendarAutofillPanel'
import CommentTriageInbox from './CommentTriageInbox'
import ResponderInbox from './ResponderInbox'

/**
 * Composes the 2026 creator-feature surfaces into one dashboard: at-a-glance
 * widgets (streak, weekly digest) up top, then the interactive tools (calendar
 * autofill, comment triage, the reply-approval inbox).
 */
export default function FeaturesDashboard() {
  return (
    <div data-testid="features-dashboard" className="grid gap-4 md:grid-cols-2">
      <section aria-label="Posting streak"><StreakWidget /></section>
      <section aria-label="Weekly digest"><DigestWidget /></section>
      <section aria-label="Fill my calendar" className="md:col-span-2"><CalendarAutofillPanel /></section>
      <section aria-label="Comment triage"><CommentTriageInbox /></section>
      <section aria-label="Replies awaiting approval"><ResponderInbox /></section>
    </div>
  )
}
