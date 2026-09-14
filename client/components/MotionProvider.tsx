'use client'

import { LazyMotion, domMax } from 'framer-motion'

/**
 * Ships framer-motion's feature bundle once, instead of every route importing
 * the full library.
 *
 * Measured for framer-motion 12.29 from the package's own size bundles (gzip):
 *
 *   motion (full)      36.6 kB
 *   m + domMax         29.5 kB   ← what we ship
 *   m + domAnimation   17.1 kB   ← not usable app-wide, see below
 *
 * `domMax`, not `domAnimation`, because ClickDynamicIsland uses `drag` and
 * `useDragControls` and is rendered unconditionally by the dashboard layout,
 * and 34 other components use `layout`/`layoutId`. domAnimation carries none of
 * that, and a missing feature fails silently — the animation simply doesn't run.
 *
 * One provider at the ROOT rather than domAnimation here and domMax nested in
 * the dashboard: LazyMotion features are additive, so nesting would load
 * 14.1 + 26.5 = 40.6 kB, worse than the full library it replaced.
 *
 * Every `motion.*` in the app is now `m.*`; `m` renders nothing without a
 * LazyMotion ancestor, so this must stay mounted at the root.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>
}
