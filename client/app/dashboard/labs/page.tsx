'use client'

/**
 * /dashboard/labs — Agency Early-Access "Labs".
 *
 * A real in-app surface that lists the canonical catalog's earlyAccess-flagged
 * features (GET /api/plans → server/config/entitlements.js). NOTHING here is
 * fabricated: every card is a REAL feature flagged `earlyAccess: true`.
 *
 * Gating by tier (useEntitlements):
 *   - agency users  → features are "available to you / early access" (unlocked)
 *   - everyone else → "Agency-exclusive — upgrade for early access" + UpgradeModal
 *
 * Built on the 2026 design system (ui primitives + ds- utilities). Reduced-
 * motion safe (animation via ds/tailwind motion-safe utilities).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  FlaskConical, Crown, Lock, Sparkles, ArrowRight, CheckCircle2,
  Mic, Volume2, Activity, Cpu, ScanLine, Palette, Plug, Boxes,
  type LucideIcon,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTranslation } from '../../../hooks/useTranslation'
import {
  fetchPublicCatalog,
  earlyAccessFeatures,
  type CatalogFeature,
} from '../../../lib/plans'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  Badge,
  SectionHeader,
  EmptyState,
  UpgradeModal,
} from '../../../components/ui'

// Per-feature icon map (real catalog feature ids → lucide icon). Unknown ids
// fall back to Sparkles. All icons verified present in lucide-react 0.294.0.
const FEATURE_ICON: Record<string, LucideIcon> = {
  generative_dubbing: Mic,
  ai_foley: Volume2,
  retention_heatmap: Activity,
  priority_gpu: Cpu,
  webgpu_rendering: ScanLine,
  white_label: Palette,
  client_portal: Boxes,
  api_access: Plug,
  spatial_editing: ScanLine,
}

export default function LabsPage() {
  const { tier, isEarlyAccess, loading: entLoading } = useEntitlements()
  const { t } = useTranslation()
  const [features, setFeatures] = useState<CatalogFeature[] | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState<string | undefined>(undefined)

  useEffect(() => {
    let alive = true
    fetchPublicCatalog().then((cat) => {
      if (alive) setFeatures(cat ? earlyAccessFeatures(cat) : [])
    })
    return () => { alive = false }
  }, [])

  const isAgency = tier === 'agency'

  const openUpgrade = (featureId?: string) => {
    setUpgradeFeature(featureId)
    setUpgradeOpen(true)
  }

  const loading = features === null

  const sorted = useMemo(() => {
    if (!features) return []
    // Group by category so related early-access bets sit together.
    return [...features].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label))
  }, [features])

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto text-theme-primary">
        <SectionHeader
          as="h1"
          title={t('labsPage.title')}
          description={t('labsPage.subtitle')}
          className="mb-6"
          actions={
            <Badge
              variant="outline"
              className={cn('gap-1.5', isAgency
                ? 'border-emerald-500/30 text-emerald-500'
                : 'border-amber-500/30 text-amber-500')}
            >
              {isAgency ? <Crown className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
              {isAgency ? t('labsPage.agencyAccess') : t('labsPage.agencyExclusive')}
            </Badge>
          }
        />

        {/* Intro / state banner */}
        <Panel
          variant="bento"
          className={cn('mb-6 border-amber-500/20 bg-gradient-to-br',
            isAgency ? 'from-emerald-500/[0.05] to-fuchsia-600/[0.04]' : 'from-amber-500/[0.06] to-fuchsia-600/[0.04]')}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 text-white shadow-lg">
                <FlaskConical size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="ds-text-h3 text-theme-primary">
                  {isAgency ? t('labsPage.bannerAgencyTitle') : t('labsPage.bannerLockedTitle')}
                </h2>
                <p className="ds-text-caption max-w-2xl">
                  {isAgency ? t('labsPage.bannerAgencyBody') : t('labsPage.bannerLockedBody')}
                </p>
              </div>
            </div>
            {!isAgency && !entLoading && (
              <Button
                variant="gradient"
                size="lg"
                className="flex-shrink-0"
                onClick={() => openUpgrade(undefined)}
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
              >
                {t('labsPage.upgradeCta')}
              </Button>
            )}
          </div>
        </Panel>

        {/* Feature grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ds-surface-subtle p-6 h-44 animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t('labsPage.emptyTitle')}
            description={t('labsPage.emptyBody')}
            className="py-20"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((f) => {
              const FIcon = FEATURE_ICON[f.id] || Sparkles
              const unlocked = isAgency && isEarlyAccess(f.id)
              return (
                <div
                  key={f.id}
                  className={cn('ds-surface-subtle p-6 flex flex-col gap-4 relative overflow-hidden',
                    unlocked ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-amber-500/15')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                      unlocked ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                      <FIcon size={20} aria-hidden />
                    </span>
                    {unlocked ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> {t('labsPage.statusAvailable')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-500">
                        <Lock className="h-3 w-3" aria-hidden /> {t('labsPage.statusEarlyAccess')}
                      </Badge>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="ds-text-h3 text-theme-primary leading-tight">{f.label}</h3>
                    <p className="ds-text-caption mt-1 capitalize">{f.category}</p>
                  </div>

                  {unlocked ? (
                    <p className="ds-text-caption text-emerald-600 dark:text-emerald-400">
                      {t('labsPage.cardAvailable')}
                    </p>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-auto self-start"
                      onClick={() => openUpgrade(f.id)}
                      rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
                    >
                      {t('labsPage.unlockCta')}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeFeature}
        requiredTier="agency"
        currentTier={tier}
        reason="feature"
      />
    </ErrorBoundary>
  )
}
