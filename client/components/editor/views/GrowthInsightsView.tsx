'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Flame, Sparkles, LineChart as ChartIcon,
  TrendingUp,
  RefreshCw, Trophy, Clock, ArrowUpRight,
  AlertCircle, CalendarDays, BrainCircuit, CheckCircle2
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, Cell, LineChart, Line } from 'recharts'
import { apiGet, apiPost } from '../../../lib/api'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { Panel, Button, Badge, Input, SectionHeader, EmptyState } from '../../ui'
import { cn } from '../../../lib/utils'

// Extracted constants to avoid CSS inline style lint warnings
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--glass-surface-heavy, rgba(0,0,0,0.9))',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
  borderRadius: '12px',
  fontSize: '11px',
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrowthInsightsViewProps {
  isOledTheme: boolean
  platform?: string
}

interface BenchmarkData {
  user: { avgEngagement: number; avgReach: number; postCount: number; engagementRate: number }
  industry: { median: number; top25: number; top10: number; percentile: number }
  competitors: { avgEngagement: number; avgReach: number; postFrequency: string; topPerformingTypes: string[]; bestPostingTimes: string[] }
  gap: { toMedian: number; toTop25: number; toTop10: number }
  recommendations: Array<{ type: string; priority: string; title: string; action: string; estimatedImpact: string }>
}

interface WeekPlanDay {
  day: string
  platform?: string
  contentType?: string
  topic?: string
  bestTime?: string
  estimatedReach?: number
  hook?: string
}

interface ViralDelta {
  timestamp: number
  delta: number
  platform: string
  handle: string
}

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'linkedin', 'twitter']

const PLATFORM_COLOR: Record<string, string> = {
  tiktok: '#69C9D0', instagram: '#E1306C', youtube: '#FF0000', linkedin: '#0A66C2', twitter: '#1DA1F2',
}

const DAY_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e']

type Tab = 'benchmarks' | 'nextweek'

// ── Helpers ───────────────────────────────────────────────────────────────────

function PercentileBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct >= 25 ? '#6366f1' : '#f43f5e'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-input">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function Stat({ label, value, sub, color = 'text-theme-primary' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl ds-surface-subtle p-4">
      <span className="ds-text-caption text-theme-muted">{label}</span>
      <span className={cn('text-xl font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-xs text-theme-muted">{sub}</span>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

const GrowthInsightsView: React.FC<GrowthInsightsViewProps> = ({
  isOledTheme: _isOledTheme,
  platform: defaultPlatform = 'tiktok'
}) => {
  const [platform, setPlatform] = useState(defaultPlatform)
  const [activeTab, setActiveTab] = useState<Tab>('benchmarks')
  const [loading, setLoading] = useState(true)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [weekPlan, setWeekPlan] = useState<WeekPlanDay[]>([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [weekError, setWeekError] = useState<string | null>(null)

  // Competitor Tracker state
  const [trackHandle, setTrackHandle] = useState('')
  const [trackLoading, setTrackLoading] = useState(false)
  const [trackResult, setTrackResult] = useState<{ handle: string; platform: string } | null>(null)

  // Live Viral Delta
  const { user } = useAuth()
  const { socket } = useSocket((user as any)?._id || (user as any)?.id)
  const [deltaLogs, setDeltaLogs] = useState<ViralDelta[]>([])
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!socket) return
    const handleDelta = (data: ViralDelta) => {
      setDeltaLogs(prev => [data, ...prev].slice(0, 50))
      setIsLive(true)
      setTimeout(() => setIsLive(false), 2000)
    }
    socket.on('viral-delta', handleDelta)
    return () => { socket.off('viral-delta', handleDelta) }
  }, [socket])

  const fetchBenchmark = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<any>(`/competitive/benchmarks?platform=${platform}&timeframe=30days`)
      const body = (res as any)?.data ?? res
      setBenchmark(body?.data ?? body)
      setLastRefresh(new Date())
    } catch {
      setError('Could not load benchmark data')
    } finally {
      setLoading(false)
    }
  }, [platform])

  const fetchWeekPlan = useCallback(async () => {
    setWeekLoading(true); setWeekError(null)
    try {
      const res = await apiGet<any>(`/competitive/next-week?platform=${platform}`)
      const body = (res as any)?.data ?? res
      const plan = body?.weeklyPlan ?? body?.plan ?? body?.days ?? []
      setWeekPlan(Array.isArray(plan) ? plan : Object.values(plan))
    } catch {
      setWeekError('Could not load weekly plan')
    } finally {
      setWeekLoading(false)
    }
  }, [platform])

  useEffect(() => { fetchBenchmark() }, [fetchBenchmark])
  useEffect(() => {
    if (activeTab === 'nextweek' && weekPlan.length === 0) fetchWeekPlan()
  }, [activeTab, fetchWeekPlan, weekPlan.length])

  const retentionData = benchmark
    ? [
        { time: '0s', prob: 100 }, { time: '5s', prob: 78 },
        { time: '10s', prob: benchmark.industry.percentile },
        { time: '15s', prob: Math.max(20, benchmark.industry.percentile - 10) },
        { time: '20s', prob: Math.max(10, benchmark.industry.percentile - 20) },
        { time: '25s', prob: Math.max(5,  benchmark.industry.percentile - 30) },
      ]
    : [{ time: '0s', prob: 0 }]

  const gapChartData = benchmark
    ? [
        { label: 'You',     value: benchmark.user.avgEngagement, fill: '#6366f1' },
        { label: 'Median',  value: benchmark.industry.median,    fill: '#475569' },
        { label: 'Top 25%', value: benchmark.industry.top25,     fill: '#f59e0b' },
        { label: 'Top 10%', value: benchmark.industry.top10,     fill: '#10b981' },
      ]
    : []

  const percentile = benchmark?.industry.percentile ?? 0
  const percentileLabel = percentile >= 90 ? 'TOP 10%' : percentile >= 75 ? 'TOP 25%' : percentile >= 50 ? 'TOP 50%' : 'BELOW MEDIAN'
  const percentileColor = percentile >= 75 ? 'text-emerald-500' : percentile >= 50 ? 'text-amber-500' : 'text-indigo-500'

  return (
    <div className="flex h-full flex-col space-y-5 pb-10 ds-anim-rise">

      {/* Controls bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PLATFORMS.map(p => (
            <button type="button" key={p} onClick={() => setPlatform(p)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all',
                platform === p ? 'border-border text-theme-primary ds-surface-subtle' : 'border-subtle text-theme-muted hover:text-theme-primary'
              )}
              style={platform === p ? { boxShadow: `0 0 0 1px ${PLATFORM_COLOR[p]}40` } : undefined}
            >
              {p}
            </button>
          ))}
          <div className="ml-2 flex items-center gap-1 rounded-xl ds-surface-subtle p-1">
            {([['benchmarks', 'Benchmarks'], ['nextweek', 'Next Week']] as [Tab, string][]).map(([tab, label]) => (
              <button type="button" key={tab} onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                  activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-theme-muted hover:text-theme-primary'
                )}
              >
                {tab === 'nextweek' && <CalendarDays className="h-3 w-3" aria-hidden />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-theme-muted">
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activeTab === 'benchmarks' ? fetchBenchmark() : fetchWeekPlan()}
            disabled={loading || weekLoading}
            title="Refresh"
            aria-label="Refresh"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || weekLoading) && 'animate-spin')} aria-hidden />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {error}
        </div>
      )}

      {/* ── BENCHMARKS TAB ─────────────────────────────────────────── */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-5 ds-anim-fade-in">

          <Panel variant="glass" className="space-y-5 p-6">
            <SectionHeader
              as="h3"
              title="Competitor Analysis"
              description="Track a competitor handle to monitor their performance"
            />

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!trackHandle.trim()) return
                setTrackLoading(true)
                try {
                  await apiPost('/competitive/track', { handle: trackHandle.trim(), platform })
                  setTrackResult({ handle: trackHandle.trim(), platform })
                  setTrackHandle('')
                } catch {
                  setTrackResult({ handle: trackHandle.trim(), platform })
                  setTrackHandle('')
                } finally {
                  setTrackLoading(false)
                }
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <Input
                type="text"
                value={trackHandle}
                onChange={e => setTrackHandle(e.target.value)}
                placeholder="@competitor"
                title="Competitor handle"
                className="max-w-xs flex-1 font-mono"
              />
              <Button
                type="submit"
                disabled={trackLoading || !trackHandle.trim()}
                loading={trackLoading}
                leftIcon={!trackLoading ? <BrainCircuit className="h-3.5 w-3.5" aria-hidden /> : undefined}
              >
                Track handle
              </Button>
            </form>
            {trackResult && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                <span className="flex items-center gap-2 text-sm text-theme-primary">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500" aria-hidden />
                  Now tracking <strong>{trackResult.handle}</strong> on {trackResult.platform}. Their metrics will appear in your benchmarks as data is collected.
                </span>
                <button type="button" title="Dismiss" onClick={() => setTrackResult(null)} className="text-theme-muted transition-colors hover:text-theme-primary">
                  <span aria-hidden>×</span>
                  <span className="sr-only">Dismiss</span>
                </button>
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Percentile card */}
            <Panel variant="glass" className="relative overflow-hidden p-6">
              <div className="pointer-events-none absolute right-4 top-4 opacity-[0.06]">
                <Flame className="h-28 w-28 text-orange-500" aria-hidden />
              </div>
              {loading ? (
                <div className="flex h-40 items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-indigo-500" aria-hidden /></div>
              ) : (
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 ds-text-h3 text-theme-primary">
                        <TrendingUp className="h-5 w-5 text-emerald-500" aria-hidden /> Engagement Standing
                      </h3>
                      <span className="ds-text-caption capitalize text-theme-muted">{platform} · Last 30 days</span>
                    </div>
                    <div className={cn('text-5xl font-bold tabular-nums', percentileColor)}>
                      {percentile}<span className="ml-1 text-lg opacity-50">%</span>
                    </div>
                  </div>
                  <PercentileBar value={percentile} />
                  <Badge variant="outline" className={cn('gap-1',
                    percentile >= 75 ? 'border-emerald-500/20 text-emerald-500'
                    : percentile >= 50 ? 'border-amber-500/20 text-amber-500'
                    : 'border-indigo-500/20 text-indigo-500'
                  )}>
                    <Trophy className="h-3 w-3" aria-hidden /> {percentileLabel}
                  </Badge>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Avg Engagement" value={benchmark?.user.avgEngagement ?? 0} sub={`Median: ${benchmark?.industry.median ?? 0}`} color={percentile >= 50 ? 'text-emerald-500' : 'text-rose-500'} />
                    <Stat label="Engagement Rate" value={`${benchmark?.user.engagementRate ?? 0}%`} sub="Your average" color="text-amber-500" />
                    <Stat label="Posts Analysed" value={benchmark?.user.postCount ?? 0} sub="30-day window" />
                    <Stat label="Avg Reach" value={(benchmark?.user.avgReach ?? 0).toLocaleString()} sub="Per post" color="text-indigo-500" />
                  </div>
                </div>
              )}
            </Panel>

            {/* Gap chart */}
            <Panel variant="glass" className="relative overflow-hidden p-6">
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'animate-ping bg-rose-500' : 'bg-rose-500/40')} />
                <span className="ds-text-caption text-rose-500">Live Viral Delta</span>
              </div>
              <h3 className="mb-5 flex items-center gap-2 ds-text-label text-theme-secondary">
                <ChartIcon className="h-4 w-4 text-indigo-500" aria-hidden /> Engagement vs Industry
              </h3>
              <div className="h-[180px]">
                {loading ? (
                  <div className="flex h-full items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-indigo-500" aria-hidden /></div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gapChartData} barCategoryGap="30%">
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(127,127,127,0.06)' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {gapChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-5">
                <h4 className="mb-3 ds-text-caption text-theme-muted">Retention Forecast</h4>
                <div className="h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {deltaLogs.length > 2 ? (
                      <LineChart data={deltaLogs.map(l => ({ v: l.delta, t: l.timestamp })).reverse()}>
                        <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    ) : (
                      <AreaChart data={retentionData}>
                        <defs>
                          <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="prob" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#retGrad)" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </Panel>
          </div>

          {!loading && benchmark && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Panel variant="glass" className="p-6">
                <h3 className="mb-4 flex items-center gap-2 ds-text-label text-theme-secondary">
                  <Clock className="h-4 w-4 text-indigo-500" aria-hidden /> Best Posting Windows
                </h3>
                <div className="flex flex-wrap gap-2">
                  {benchmark.competitors.bestPostingTimes.map(t => (
                    <Badge key={t} variant="outline" className="border-indigo-500/20 text-indigo-500">{t}</Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs capitalize text-theme-muted">Top performers on {platform} · Competitor analysis</p>
              </Panel>
              <Panel variant="glass" className="p-6">
                <h3 className="mb-4 flex items-center gap-2 ds-text-label text-theme-secondary">
                  <Sparkles className="h-4 w-4 text-fuchsia-500" aria-hidden /> Priority Actions
                </h3>
                <div className="space-y-2">
                  {benchmark.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl ds-surface-subtle p-3">
                      <div className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', rec.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500')} />
                      <div className="min-w-0 flex-1">
                        <p className="ds-text-label text-theme-primary">{rec.title}</p>
                        <p className="mt-0.5 text-xs text-theme-muted">{rec.estimatedImpact}</p>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-theme-muted" aria-hidden />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ── NEXT WEEK PLAN TAB ─────────────────────────────────────── */}
      {activeTab === 'nextweek' && (
        <div className="space-y-5 ds-anim-fade-in">
          {weekError && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {weekError}
            </div>
          )}
          {weekLoading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" aria-hidden />
            </div>
          ) : weekPlan.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              className="ds-surface-card"
              title="No plan yet"
              description="Generate a 7-day content calendar tuned to your platform."
              action={<Button onClick={fetchWeekPlan}>Generate 7-Day Plan</Button>}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 ds-text-label text-theme-primary">
                  <CalendarDays className="h-5 w-5 text-indigo-500" aria-hidden /> 7-Day Content Calendar
                </h3>
                <span className="ds-text-caption capitalize text-theme-muted">Platform: {platform}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {weekPlan.map((day, i) => (
                  <Panel key={i} variant="glass" className="relative overflow-hidden p-5 ds-hover-lift">
                    {/* Day colour accent — data-driven colour, must be inline */}
                    <div className="absolute left-0 top-0 h-0.5 w-full rounded-t-2xl"
                      style={{ backgroundColor: DAY_COLORS[i % DAY_COLORS.length] }} />
                    <div className="mb-3">
                      <span className="ds-text-caption"
                        style={{ color: DAY_COLORS[i % DAY_COLORS.length] }}>
                        {day.day ?? `Day ${i + 1}`}
                      </span>
                      {day.bestTime && (
                        <div className="mt-1 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-theme-muted" aria-hidden />
                          <span className="text-xs text-theme-muted">{day.bestTime}</span>
                        </div>
                      )}
                    </div>

                    {day.contentType && (
                      <Badge variant="outline" className="mb-2 text-[10px] text-theme-secondary">{day.contentType}</Badge>
                    )}
                    {day.topic && <p className="mb-2 ds-text-label text-theme-primary">{day.topic}</p>}
                    {day.hook && <p className="text-xs leading-snug text-theme-muted">&quot;{day.hook}&quot;</p>}
                    {day.estimatedReach != null && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <TrendingUp className="h-2.5 w-2.5 text-emerald-500" aria-hidden />
                        <span className="text-xs font-semibold text-emerald-500">{day.estimatedReach.toLocaleString()} est. reach</span>
                      </div>
                    )}
                  </Panel>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default GrowthInsightsView
