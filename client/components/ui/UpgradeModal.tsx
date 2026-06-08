'use client'

/**
 * UpgradeModal — the reusable, motivating paywall for Click.
 *
 * It is honest by construction: every tier name, price and feature shown is
 * pulled from the live API (GET /api/plans, the server's canonical catalog) or
 * from lib/plans.ts for the checkout target. NOTHING is hard-coded or faked.
 *
 * Tone: motivating, not punitive. We frame the moment as "here's what you
 * unlock" rather than "you can't do this". reduced-motion safe (animation is
 * driven by the ds-anim-* utilities, which respect prefers-reduced-motion).
 */

import * as React from 'react'
import {
  Lock,
  Check,
  ArrowRight,
  Sparkles,
  Crown,
  Rocket,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'
import { Badge } from './badge'
import { cn } from '../../lib/utils'
import { apiGet } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import {
  buildCheckoutTarget,
  getPlan,
  type BillingPeriod,
  type PlanId,
} from '../../lib/plans'

// ── Catalog types (subset of the server publicCatalog() shape we consume) ────
interface CatalogFeature {
  id: string
  label: string
  category: string
  earlyAccess?: boolean
}
interface CatalogTier {
  id: string
  name: string
  order: number
  tagline: string
  price: { monthlyUsd: number | null; yearlyUsd: number | null }
  featured?: boolean
  flagship?: boolean
  features: CatalogFeature[]
  limits: Record<string, number | null>
}
interface Catalog {
  tiers: CatalogTier[]
  features: Array<CatalogFeature & { minTier: string }>
}

// Module cache so re-opening the modal doesn't refetch the public catalog.
let catalogCache: Catalog | null = null
let catalogInFlight: Promise<Catalog | null> | null = null

async function loadCatalog(): Promise<Catalog | null> {
  if (catalogCache) return catalogCache
  if (catalogInFlight) return catalogInFlight
  catalogInFlight = (async () => {
    try {
      const raw = await apiGet<any>('/plans')
      const body = raw?.tiers ? raw : raw?.data ?? raw
      if (body && Array.isArray(body.tiers)) {
        catalogCache = body as Catalog
        return catalogCache
      }
      return null
    } catch {
      return null
    } finally {
      catalogInFlight = null
    }
  })()
  return catalogInFlight
}

const TIER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Sparkles,
  creator: Zap,
  pro: Rocket,
  agency: Crown,
}

export interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Feature id that was locked (when reason === 'feature'). */
  feature?: string
  requiredTier?: string
  currentTier?: string
  reason?: 'feature' | 'limit'
  /** The cap that was hit (when reason === 'limit'). */
  limit?: number
  used?: number
  /** Optional extra context line (e.g. server message). */
  context?: string
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return `$${n}`
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onClose,
  feature,
  requiredTier,
  currentTier,
  reason = 'feature',
  limit,
  used,
  context,
}) => {
  const { user } = useAuth()
  const [catalog, setCatalog] = React.useState<Catalog | null>(catalogCache)
  const [period, setPeriod] = React.useState<BillingPeriod>('yearly')

  React.useEffect(() => {
    if (!open) return
    if (!catalog) loadCatalog().then((c) => c && setCatalog(c))
  }, [open, catalog])

  const targetTierId = (requiredTier || 'pro').toLowerCase()
  const targetTier = catalog?.tiers.find((t) => t.id === targetTierId) || null
  const currentTierObj =
    catalog?.tiers.find((t) => t.id === (currentTier || 'free').toLowerCase()) ||
    null

  // The feature being unlocked, resolved to its human label from the catalog.
  const featureMeta =
    feature && catalog
      ? catalog.features.find((f) => f.id === feature)
      : undefined

  // What the target tier adds over the current tier (honest delta), prioritised
  // so the locked feature appears first.
  const upgradeBenefits = React.useMemo<CatalogFeature[]>(() => {
    if (!targetTier) return []
    const currentIds = new Set(currentTierObj?.features.map((f) => f.id) || [])
    const delta = targetTier.features.filter((f) => !currentIds.has(f.id))
    if (feature) {
      const idx = delta.findIndex((f) => f.id === feature)
      if (idx > 0) {
        const [hit] = delta.splice(idx, 1)
        delta.unshift(hit)
      }
    }
    return delta.slice(0, 6)
  }, [targetTier, currentTierObj, feature])

  const TierIcon = TIER_ICON[targetTierId] || Crown

  const monthly = targetTier?.price.monthlyUsd ?? null
  const yearly = targetTier?.price.yearlyUsd ?? null
  // "2 months free" hook: yearly priced at ~10× monthly.
  const showAnnualHook =
    typeof monthly === 'number' &&
    monthly > 0 &&
    typeof yearly === 'number' &&
    yearly > 0 &&
    yearly < monthly * 12
  const annualMonths =
    showAnnualHook && monthly ? Math.round((monthly * 12 - (yearly as number)) / monthly) : 0

  const displayPrice = period === 'yearly' && yearly ? yearly : monthly
  const priceCadence = period === 'yearly' ? '/yr' : '/mo'

  const handleUpgrade = () => {
    // buildCheckoutTarget wants a local Plan object + user. Map the server tier
    // id (free/creator/pro/agency) → the local Plan; ids are aligned.
    const plan = getPlan(targetTierId as PlanId)
    if (!plan) {
      // No matching local plan (shouldn't happen for canonical tiers) — send to
      // the billing page as a safe fallback.
      window.location.href = '/dashboard/billing'
      return
    }
    const target = buildCheckoutTarget(plan, period, user as any)
    if (target.kind === 'noop') {
      onClose()
      return
    }
    window.location.href = target.href
  }

  // ── Headline copy: motivating, honest, scoped to the reason ──
  const tierName = targetTier?.name || (requiredTier ? cap(requiredTier) : 'Pro')
  const featureLabel =
    featureMeta?.label || (feature ? humanize(feature) : 'this feature')

  const eyebrow =
    reason === 'limit' ? 'You hit your plan limit' : `Unlock with ${tierName}`
  const heading =
    reason === 'limit'
      ? `Keep going with ${tierName}`
      : `Unlock ${featureLabel}`
  const subheading =
    reason === 'limit'
      ? typeof limit === 'number'
        ? `You've used ${used ?? limit} of your ${limit} on ${currentTierObj?.name || cap(currentTier || 'Free')}. ${tierName} raises the ceiling so you don't have to stop.`
        : `You've reached the ${currentTierObj?.name || cap(currentTier || 'Free')} ceiling. ${tierName} lifts it.`
      : `${featureLabel} is part of ${tierName}. Upgrade once and it's yours across every project.`

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl" hideClose={false}>
      <div className="space-y-6">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white',
              targetTierId === 'agency'
                ? 'from-amber-500 via-rose-500 to-fuchsia-600'
                : targetTierId === 'pro'
                  ? 'from-indigo-600 via-violet-600 to-fuchsia-600'
                  : 'from-indigo-600 to-blue-700'
            )}
          >
            <TierIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/30 text-amber-500"
              >
                <Lock className="h-3 w-3" aria-hidden />
                {eyebrow}
              </Badge>
            </div>
            <h2 className="ds-text-h2 mt-2 text-theme-primary">{heading}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">
              {subheading}
            </p>
            {context ? (
              <p className="mt-2 text-xs text-theme-muted">{context}</p>
            ) : null}
          </div>
        </div>

        {/* Current → Target comparison */}
        {targetTier ? (
          <div className="rounded-2xl border border-subtle ds-surface-subtle p-5">
            <div className="mb-4 flex items-center gap-3 text-sm">
              <span className="ds-text-label text-theme-muted">
                {currentTierObj?.name || cap(currentTier || 'Free')}
              </span>
              <ArrowRight className="h-4 w-4 text-theme-muted" aria-hidden />
              <span className="ds-text-label font-semibold text-theme-primary">
                {tierName}
              </span>
              {targetTier.featured ? (
                <Badge className="ml-auto gap-1 bg-violet-500/15 text-violet-400">
                  <TrendingUp className="h-3 w-3" aria-hidden /> Most popular
                </Badge>
              ) : null}
            </div>

            <ul className="space-y-2.5">
              {upgradeBenefits.length > 0 ? (
                upgradeBenefits.map((f) => (
                  <li key={f.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-tight',
                        f.id === feature
                          ? 'font-semibold text-theme-primary'
                          : 'text-theme-secondary'
                      )}
                    >
                      {f.label}
                      {f.earlyAccess ? (
                        <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                          Early access
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-theme-muted">
                  Everything in your current plan, plus higher limits.
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-subtle ds-surface-subtle p-5 text-sm text-theme-muted">
            Loading plan details…
          </div>
        )}

        {/* Billing period toggle + price */}
        {targetTier ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-xl border border-subtle p-1">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-theme-muted hover:text-theme-primary'
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriod('yearly')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-theme-muted hover:text-theme-primary'
                )}
              >
                Yearly
                {showAnnualHook ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      period === 'yearly'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-500/15 text-emerald-500'
                    )}
                  >
                    {annualMonths} mo free
                  </span>
                ) : null}
              </button>
            </div>

            <div className="text-right">
              {displayPrice !== null && displayPrice !== undefined ? (
                <p className="ds-text-h3 text-theme-primary">
                  {fmtUsd(displayPrice)}
                  <span className="ml-1 text-sm font-normal text-theme-muted">
                    {priceCadence}
                  </span>
                </p>
              ) : null}
              {period === 'yearly' && showAnnualHook ? (
                <p className="text-xs text-theme-muted">
                  vs {fmtUsd(monthly)}/mo billed monthly
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* CTA */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="gradient"
            size="lg"
            className="flex-1"
            onClick={handleUpgrade}
            rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
          >
            Upgrade to {tierName}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Maybe later
          </Button>
        </div>
        <p className="text-center text-[11px] text-theme-muted">
          Cancel anytime. Your current work and projects stay exactly as they are.
        </p>
      </div>
    </Modal>
  )
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function humanize(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default UpgradeModal
