'use client'

/**
 * UpgradeGateListener — the single, app-wide mount point for the UpgradeModal.
 *
 * The api.ts response interceptor dispatches a `click-upgrade-required` window
 * event whenever a gated route returns feature_gated / limit_reached (403) or
 * an AI-budget ceiling (402). This component listens once (mounted in the
 * dashboard layout) and renders the modal with the server-provided payload, so
 * ANY gated API call anywhere in the app triggers a consistent paywall — no
 * per-caller wiring required.
 */

import * as React from 'react'
import {
  UPGRADE_REQUIRED_EVENT,
  type UpgradeRequiredDetail,
} from '../lib/api'
import { UpgradeModal } from './ui/UpgradeModal'
import { useEntitlements } from '../hooks/useEntitlements'

const UpgradeGateListener: React.FC = () => {
  const [detail, setDetail] = React.useState<UpgradeRequiredDetail | null>(null)
  const { refresh } = useEntitlements()

  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<UpgradeRequiredDetail>
      if (ce?.detail) setDetail(ce.detail)
    }
    window.addEventListener(UPGRADE_REQUIRED_EVENT, handler as EventListener)
    return () =>
      window.removeEventListener(
        UPGRADE_REQUIRED_EVENT,
        handler as EventListener
      )
  }, [])

  const handleClose = React.useCallback(() => {
    setDetail(null)
    // Entitlements may have just changed server-side (e.g. mid-session upgrade);
    // refresh so a re-attempt reflects reality. Cheap (cached) when unchanged.
    refresh().catch(() => {})
  }, [refresh])

  if (!detail) return null

  return (
    <UpgradeModal
      open
      onClose={handleClose}
      reason={detail.reason}
      feature={detail.feature}
      requiredTier={detail.requiredTier}
      currentTier={detail.currentTier}
      limit={detail.limit}
      used={detail.used}
      context={detail.message}
    />
  )
}

export default UpgradeGateListener
