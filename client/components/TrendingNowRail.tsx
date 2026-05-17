'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, Hash, Music, Loader2, RefreshCw } from 'lucide-react'

type Kind = 'sound' | 'hashtag' | 'topic'

interface TrendItem {
  kind: Kind
  label: string
  score?: number
  velocity?: number
  externalId?: string | null
}

interface TrendsResponse {
  success?: boolean
  data?: {
    platform: string
    region: string
    capturedAt: string | null
    items: TrendItem[]
    source: 'snapshot' | 'live'
  }
  // Some routes return the data shape directly.
  platform?: string
  items?: TrendItem[]
  capturedAt?: string | null
  source?: 'snapshot' | 'live'
}

const PLATFORMS = ['tiktok', 'instagram', 'youtube'] as const

function iconFor(kind: Kind) {
  if (kind === 'sound') return <Music size={12} />
  if (kind === 'hashtag') return <Hash size={12} />
  return <TrendingUp size={12} />
}

export interface TrendingNowRailProps {
  defaultPlatform?: typeof PLATFORMS[number]
  onPick?: (item: TrendItem) => void
  className?: string
}

export function TrendingNowRail({
  defaultPlatform = 'tiktok',
  onPick,
  className = '',
}: TrendingNowRailProps) {
  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>(defaultPlatform)
  const [items, setItems] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(false)
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  const [source, setSource] = useState<'snapshot' | 'live' | null>(null)

  const load = async (p: typeof PLATFORMS[number]) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trends/now?platform=${p}&limit=12`, {
        credentials: 'include',
      })
      const json: TrendsResponse = await res.json()
      const payload = json?.data ?? json
      setItems(payload?.items ?? [])
      setCapturedAt(payload?.capturedAt ?? null)
      setSource(payload?.source ?? null)
    } catch {
      setItems([])
      setSource(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(platform)
    // Auto-refresh every 5 minutes — the backend ingests every 15 so this is
    // mostly to catch new snapshots without forcing the user to refresh.
    const id = setInterval(() => load(platform), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [platform])

  return (
    <div
      className={`bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-surface-900 dark:text-white tracking-tight truncate">
              Trending now
            </h3>
            <p
              className="text-[10px] font-bold text-surface-500 uppercase tracking-wider truncate"
              title={capturedAt ? new Date(capturedAt).toLocaleString() : ''}
            >
              {source === 'snapshot' && capturedAt
                ? `Updated ${new Date(capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : source === 'live'
                ? 'Live'
                : 'Loading…'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(platform)}
          aria-label="Refresh trends"
          className="w-8 h-8 rounded-lg border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* Platform tabs */}
      <div className="inline-flex border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden mb-4">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
              platform === p
                ? 'bg-primary-600 text-white'
                : 'bg-transparent text-surface-500 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
        {items.length === 0 && !loading && (
          <div className="text-center py-10 text-xs text-surface-500">
            No trends yet. The ingest job runs every 15 minutes.
          </div>
        )}
        {items.map((it, idx) => (
          <button
            key={`${it.kind}-${it.label}-${idx}`}
            type="button"
            onClick={() => onPick?.(it)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left group"
          >
            <span className="w-6 h-6 rounded-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-500 shrink-0">
              {iconFor(it.kind)}
            </span>
            <span className="flex-1 min-w-0 text-sm font-bold text-surface-900 dark:text-white truncate">
              {it.kind === 'hashtag' ? `#${it.label.replace(/^#/, '')}` : it.label}
            </span>
            {typeof it.velocity === 'number' && it.velocity > 0 && (
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                ↑ {it.velocity}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default TrendingNowRail
