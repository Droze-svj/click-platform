'use client'

/**
 * /dashboard/strategist — Marketing Intelligence surface.
 *
 * Mounts the AI Marketing Strategist chat + the Niche Strategy panel
 * side-by-side. Both consume the niche/platform from WorkflowContext so
 * the conversation stays scoped to the creator's current focus.
 *
 * The components were previously orphaned in the codebase — they existed
 * but no route rendered them. The /api/intelligence/strategist/* and
 * /api/intelligence/niche/* endpoints they depend on were 404ing until
 * commit 7f4c7a4b mounted them.
 */

import { Sparkles, Compass } from 'lucide-react'
import MarketingStrategistChat from '../../../components/MarketingStrategistChat'
import NicheStrategyPanel from '../../../components/NicheStrategyPanel'
import { useWorkflow } from '../../../contexts/WorkflowContext'

export default function StrategistPage() {
  const { state, setNiche } = useWorkflow()
  const niche = state.niche || 'general'
  const platform = state.platform || 'tiktok'

  return (
    <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-6 lg:px-12 pt-12 max-w-[1900px] mx-auto space-y-10 overflow-x-hidden font-inter bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-500">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--tint-fuchsia-bg)] border-2 border-[var(--tint-fuchsia-edge)] flex items-center justify-center">
            <Compass size={28} className="text-[var(--tint-fuchsia-fg)]" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--tint-fuchsia-fg)] italic">Click Strategist</span>
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight leading-tight mt-1">
              Marketing Intelligence
            </h1>
            <p className="text-sm text-[var(--text-dim)] mt-1 max-w-2xl">
              Niche-aware playbooks, hook libraries, and a strategist that knows what's working in your category.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-xs">
          <Sparkles size={14} className="text-[var(--tint-indigo-fg)]" />
          <span className="text-[var(--text-dim)] font-medium">Niche:</span>
          <span className="text-[var(--text-main)] font-bold capitalize">{niche}</span>
          <span className="w-px h-4 bg-[var(--glass-border)]" />
          <span className="text-[var(--text-dim)] font-medium">Platform:</span>
          <span className="text-[var(--text-main)] font-bold capitalize">{platform}</span>
        </div>
      </header>

      {/* Two-column layout: niche playbook left, chat right.
          Stacks vertically below lg so phones get a usable single column. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <NicheStrategyPanel
            currentNiche={niche}
            currentPlatform={platform}
            onNicheChange={setNiche}
          />
        </div>
        <div className="lg:col-span-7 min-h-[600px]">
          <MarketingStrategistChat
            niche={niche}
            platforms={[platform]}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
