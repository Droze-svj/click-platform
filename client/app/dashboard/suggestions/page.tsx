'use client'

/**
 * /dashboard/suggestions — what to make next.
 *
 * EnhancedContentSuggestions reads four live endpoints nothing else consumes:
 * /api/suggestions/enhanced, /enhanced/gaps, /enhanced/trending and
 * /enhanced/viral-prediction. It was never imported.
 *
 * This route was already being linked to before it existed — SmartSuggestions
 * pointed here, which is how the broken link was found in the 2026-08 audit.
 *
 * Two OTHER suggestion components exist (SmartSuggestions over
 * /api/suggestions/daily, ContentSuggestions over /suggestions/{content-gaps,
 * daily-ideas,trending}). They are not mounted: three parallel suggestion
 * panels would compete for the same job, and this one covers the richest
 * endpoint family — it is the only one with viral prediction.
 */

import EnhancedContentSuggestions from '../../../components/EnhancedContentSuggestions'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { PageShell } from '../../../components/ui'

export default function SuggestionsPage() {
  return (
    <PageShell width="wide" flush>
      <ErrorBoundary>
        <EnhancedContentSuggestions />
      </ErrorBoundary>
    </PageShell>
  )
}
