'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Lightbulb, ThumbsUp, ThumbsDown, ArrowRight, Sparkles } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { cn } from '../lib/utils'
import { Panel, SectionHeader, Button } from './ui'

interface NextBestIdea {
  title: string
  hook: string
  platform: string
  why: string
  expectedLift: string | null
}

interface NextBestResponse {
  hasRealData: boolean
  reason?: string
  sampleSize?: number
  niche?: string
  ideas: NextBestIdea[]
}

type Vote = 'up' | 'down'

/**
 * "What to make next" — surfaces the grounded next-best engine (GET /me/next-best).
 * Each card carries the creator's proven hook/platform + WHY it's recommended, with
 * a 👍/👎 control that closes the learning loop via POST /ai/feedback (best-effort).
 * Honest empty state until Click has enough of the creator's own data.
 */
export default function WhatToMakeNext() {
  const [data, setData] = useState<NextBestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [votes, setVotes] = useState<Record<number, Vote>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<unknown>('/me/next-best?count=4')
      const payload = ((res as { data?: unknown })?.data ?? res) as NextBestResponse
      setData(
        payload && typeof payload === 'object' && Array.isArray(payload.ideas)
          ? payload
          : { hasRealData: false, ideas: [] },
      )
    } catch {
      setData({ hasRealData: false, ideas: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // A thumbs up/down nudges the creator's profile through the universal feedback
  // endpoint (positive → reinforce that hook, negative → de-rank it). Best-effort:
  // the visible vote stands even if the network call fails.
  const vote = useCallback(async (index: number, idea: NextBestIdea, v: Vote) => {
    setVotes((prev) => ({ ...prev, [index]: v }))
    try {
      await apiPost('/ai/feedback', {
        surface: 'next-best',
        itemType: 'hook',
        action: v === 'up' ? 'accept' : 'reject',
        value: idea.hook || undefined,
        reason: v === 'down' ? 'not for me' : undefined,
      })
    } catch {
      // best-effort telemetry — never block the user
    }
  }, [])

  const ideas = data?.ideas ?? []
  const hasData = !!data?.hasRealData && ideas.length > 0

  return (
    <Panel variant="bento" className="ds-bento-2x1 ds-anim-rise p-6">
      <SectionHeader
        as="h3"
        title="What to make next"
        actions={
          <button type="button" onClick={load} className="ds-text-label text-indigo-500 hover:underline">
            Refresh
          </button>
        }
        className="mb-4"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-theme-muted/10" />
          ))}
        </div>
      ) : !hasData ? (
        <div className="ds-surface-subtle flex flex-col items-start gap-3 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">Still learning your style</span>
          </div>
          <p className="ds-text-body text-sm text-theme-muted">
            Publish and rate a few more clips — once Click has enough of your own data it will
            recommend exactly what to make next, grounded in what already works for you.
          </p>
          <Link href="/dashboard/forge">
            <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={16} aria-hidden />}>
              Forge a clip
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea, index) => (
            <li key={index} className="ds-surface-subtle p-4">
              <div className="flex items-start gap-2">
                <Lightbulb size={18} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="ds-text-body font-semibold text-theme-primary">{idea.title}</p>
                  {idea.why && <p className="ds-text-body mt-1 text-xs text-theme-muted">{idea.why}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {idea.platform && (
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                        {idea.platform}
                      </span>
                    )}
                    {idea.hook && (
                      <span className="rounded-md bg-theme-muted/10 px-2 py-0.5 text-[10px] text-theme-muted">
                        {idea.hook}
                      </span>
                    )}
                    {idea.expectedLift && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                        {idea.expectedLift} potential
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Good suggestion"
                    onClick={() => vote(index, idea, 'up')}
                    className={cn(
                      'rounded-md p-1.5 transition-colors',
                      votes[index] === 'up'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'text-theme-muted hover:text-emerald-500',
                    )}
                  >
                    <ThumbsUp size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Not for me"
                    onClick={() => vote(index, idea, 'down')}
                    className={cn(
                      'rounded-md p-1.5 transition-colors',
                      votes[index] === 'down'
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'text-theme-muted hover:text-rose-500',
                    )}
                  >
                    <ThumbsDown size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
