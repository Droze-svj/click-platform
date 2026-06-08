'use client'

/**
 * FeatureGate + LockedBadge — the client-side affordance for gated features.
 *
 * FeatureGate reads useEntitlements and, when the user lacks `feature`, renders
 * a locked affordance instead of / over the children and opens the shared
 * UpgradeModal on click. It NEVER fabricates access — entitlements come from
 * the server (/api/me/entitlements).
 *
 * Modes:
 *   - 'block'   (default): replace children with a locked panel + CTA.
 *   - 'overlay': render children dimmed under a lock overlay (click → modal).
 *   - 'hide'    : render nothing (or `fallback`) when locked.
 *
 * LockedBadge is a small reusable lock chip showing the required tier — usable
 * standalone (e.g. on a card corner) for lighter-weight gating.
 */

import * as React from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import { UpgradeModal } from './UpgradeModal'
import { useEntitlements } from '../../hooks/useEntitlements'

export interface LockedBadgeProps {
  /** Tier required to unlock — shown in the chip (e.g. "Pro"). */
  requiredTier?: string
  className?: string
  label?: string
}

export const LockedBadge: React.FC<LockedBadgeProps> = ({
  requiredTier = 'Pro',
  className,
  label,
}) => (
  <Badge
    variant="outline"
    className={cn(
      'gap-1 border-amber-500/30 bg-black/30 text-amber-400',
      className
    )}
  >
    <Lock className="h-3 w-3" aria-hidden />
    {label || cap(requiredTier)}
  </Badge>
)

export type FeatureGateMode = 'block' | 'overlay' | 'hide'

export interface FeatureGateProps {
  /** Canonical feature id from server/config/entitlements.js (e.g. 'b_roll_ai'). */
  feature: string
  children: React.ReactNode
  mode?: FeatureGateMode
  /** Rendered instead of the lock affordance when mode === 'hide'. */
  fallback?: React.ReactNode
  /** Override the inferred required tier (defaults: from useEntitlements / 'Pro'). */
  requiredTier?: string
  /** Human label for the locked thing, used in the block-mode copy. */
  title?: string
  className?: string
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  mode = 'block',
  fallback,
  requiredTier,
  title,
  className,
}) => {
  const { hasFeature, tier, loading } = useEntitlements()
  const [modalOpen, setModalOpen] = React.useState(false)

  // While entitlements load we optimistically render children to avoid a
  // flash of a locked state for users who DO have access. If they don't, the
  // gate snaps in once loaded.
  if (loading || hasFeature(feature)) {
    return <>{children}</>
  }

  const reqTier = requiredTier || 'Pro'

  const openModal = () => setModalOpen(true)

  const modal = (
    <UpgradeModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      feature={feature}
      requiredTier={(requiredTier || '').toLowerCase() || undefined}
      currentTier={tier}
      reason="feature"
    />
  )

  if (mode === 'hide') {
    return (
      <>
        {fallback ?? null}
        {modal}
      </>
    )
  }

  if (mode === 'overlay') {
    return (
      <div className={cn('relative', className)}>
        <div className="pointer-events-none select-none opacity-40 blur-[1px]">
          {children}
        </div>
        <button
          type="button"
          onClick={openModal}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label={`Upgrade to ${reqTier} to unlock`}
        >
          <LockedBadge requiredTier={reqTier} />
          <span className="text-xs font-medium text-white/90">
            Upgrade to unlock
          </span>
        </button>
        {modal}
      </div>
    )
  }

  // mode === 'block'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-subtle ds-surface-subtle p-8 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="ds-text-label text-theme-primary">
          {title || 'This is a premium feature'}
        </p>
        <p className="text-sm text-theme-muted">
          Unlock it with {cap(reqTier)}.
        </p>
      </div>
      <Button
        variant="gradient"
        size="sm"
        onClick={openModal}
        rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
      >
        Upgrade to unlock
      </Button>
      {modal}
    </div>
  )
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default FeatureGate
