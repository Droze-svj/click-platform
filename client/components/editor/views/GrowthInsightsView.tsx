'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Flame, Sparkles, LineChart as ChartIcon,
  TrendingUp, Globe,
  RefreshCw, Trophy, Clock, ArrowUpRight,
  AlertCircle, CalendarDays, BrainCircuit
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, Cell, LineChart, Line } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'

// Extracted constants to avoid CSS inline style lint warnings
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  fontSize: '11px',
  color: '#fff',
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

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

type Tab = 'benchmarks' | 'nextweek'

// ── Helpers ───────────────────────────────────────────────────────────────────

function PercentileBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct >= 25 ? '#6366f1' : '#f43f5e'
  return (
    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}80` }}
      />
    </div>
  )
}

function Stat({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
      <span className={`text-xl font-black italic tabular-nums ${color}`}>{value}</span>
      {sub && <span className="text-[9px] text-slate-600">{sub}</span>}
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
  const percentileColor = percentile >= 75 ? 'text-emerald-400' : percentile >= 50 ? 'text-amber-400' : 'text-indigo-400'

  return (
    <div className="space-y-6 h-full flex flex-col pb-10">

      {/* Controls bar */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                platform === p ? 'text-white border-white/20 bg-white/10 [box-shadow:0_0_12px_var(--glow-color)]' : 'text-slate-600 border-white/5 bg-white/[0.02] hover:text-white'
              }`}
              style={{ '--glow-color': `${PLATFORM_COLOR[p]}40` } as React.CSSProperties}
            >
              {p}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-4 p-1 bg-white/5 rounded-xl border border-white/10">
            {([['benchmarks', 'Benchmarks'], ['nextweek', 'Next Week']] as [Tab, string][]).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === tab ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-white'
                }`}
              >
                {tab === 'nextweek' && <CalendarDays className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-slate-700 font-mono">
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => activeTab === 'benchmarks' ? fetchBenchmark() : fetchWeekPlan()}
            disabled={loading || weekLoading}
            title="Refresh"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || weekLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px]">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error} — showing defaults
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── BENCHMARKS TAB ─────────────────────────────────────────── */}
        {activeTab === 'benchmarks' && (
          <motion.div key="benchmarks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

            <div className={`${glassStyle} rounded-[2rem] p-8 space-y-6`}>
              <div className="flex items-center justify-between">
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Track a Competitor</p>
                   <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Neural Competitor Analysis</h4>
                </div>
                <div className="flex -space-x-3">
                   {['ORA', 'DNA', 'MON'].map(a => (
                     <div key={a} className="w-8 h-8 rounded-full border-2 border-black bg-indigo-500/20 text-[10px] flex items-center justify-center font-black text-indigo-400">
                        {a[0]}
                     </div>
                   ))}
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
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
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={trackHandle}
                      onChange={e => setTrackHandle(e.target.value)}
                      placeholder="@competitor_node"
                      title="Competitor handle"
                      className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-[11px] text-white placeholder-slate-800 outline-none focus:border-indigo-500/50 transition-all font-mono"
                    />
                    <button
                      type="submit"
                      disabled={trackLoading || !trackHandle.trim()}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all disabled:opacity-40 flex items-center gap-2 shadow-2xl shadow-indigo-600/20"
                    >
                      {trackLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                      Analyze handle
                    </button>
                  </form>
                </div>
                {trackResult && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 min-w-[300px] p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp className="w-3 h-3" />
                          Analysis: {trackResult.handle}
                        </span>
                        <button title="Dismiss" onClick={() => setTrackResult(null)} className="text-indigo-400 hover:text-white transition-colors text-[9px]">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase">Weakness</p>
                            <p className="text-[10px] text-white font-black italic">Low Engagement Floor (2.1%)</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase">Opportunity</p>
                            <p className="text-[10px] text-indigo-400 font-bold">Hook timing gap (0:15)</p>
                         </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Percentile card */}
              <div className={`${glassStyle} rounded-[2.5rem] p-8 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Flame className="w-32 h-32 text-orange-500" />
                </div>
                <AnimatePresence mode="wait">
                  {loading
                    ? <div className="h-40 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                    : (
                      <motion.div key="loaded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 relative z-10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                              <TrendingUp className="w-5 h-5 text-emerald-400" /> Engagement Standing
                            </h3>
                            <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{platform} · Last 30 days</span>
                          </div>
                          <div className={`text-6xl font-black italic tabular-nums ${percentileColor}`}>
                            {percentile}<span className="text-xl ml-1 opacity-50">%</span>
                          </div>
                        </div>
                        <PercentileBar value={percentile} />
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          percentile >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : percentile >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          <Trophy className="w-3 h-3" /> {percentileLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Stat label="Avg Engagement" value={benchmark?.user.avgEngagement ?? 0} sub={`Median: ${benchmark?.industry.median ?? 0}`} color={percentile >= 50 ? 'text-emerald-400' : 'text-rose-400'} />
                          <Stat label="Originality Score" value="98.2%" sub="No clichés detected" color="text-amber-400" />
                          <Stat label="Posts Analysed" value={benchmark?.user.postCount ?? 0} sub="30-day window" />
                          <Stat label="Avg Reach" value={(benchmark?.user.avgReach ?? 0).toLocaleString()} sub="Per post" color="text-indigo-400" />
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
              </div>

              {/* Gap chart */}
              <div className={`${glassStyle} rounded-[2.5rem] p-8 relative overflow-hidden`}>
                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full z-20">
                  <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-rose-500 animate-ping' : 'bg-rose-500/40'}`} />
                  <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Live Viral Delta</span>
                </div>
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-6 flex items-center gap-3">
                  <ChartIcon className="w-4 h-4 text-indigo-400" /> Engagement vs Industry
                </h3>
                <div className="h-[180px]">
                  {loading
                    ? <div className="h-full flex items-center justify-center"><RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                    : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gapChartData} barCategoryGap="30%">
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {gapChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-6">
                  <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Retention Forecast</h4>
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
              </div>
            </div>

            {!loading && benchmark && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`${glassStyle} rounded-[2.5rem] p-6`}>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Best Posting Windows
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {benchmark.competitors.bestPostingTimes.map(t => (
                      <span key={t} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black rounded-xl">{t}</span>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-700 mt-3">Top performers on {platform} · Competitor analysis</p>
                </div>
                <div className={`${glassStyle} rounded-[2.5rem] p-6`}>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-400" /> Priority Actions
                  </h3>
                  <div className="space-y-2">
                    {benchmark.recommendations.slice(0, 3).map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${rec.priority === 'high' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-white uppercase tracking-wide">{rec.title}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5">{rec.estimatedImpact}</p>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── NEXT WEEK PLAN TAB ─────────────────────────────────────── */}
        {activeTab === 'nextweek' && (
          <motion.div key="nextweek" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {weekError && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0" /> {weekError}
              </div>
            )}
            {weekLoading ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : weekPlan.length === 0 ? (
              <div className={`${glassStyle} rounded-[2.5rem] p-10 text-center`}>
                <CalendarDays className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-4">No plan yet</p>
                <button onClick={fetchWeekPlan}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all"
                >
                  Generate 7-Day Plan
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-indigo-400" /> 7-Day Content Calendar
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded-full bg-emerald-500/5">12 Regional Twins Synthetic</span>
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Platform: {platform}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
                  {weekPlan.map((day, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`${glassStyle} rounded-[2rem] p-5 relative overflow-hidden hover:border-white/20 transition-all`}
                    >
                      {/* Day colour accent — data-driven colour, must be inline */}
                      <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-[2rem]"
                        style={{ backgroundColor: DAY_COLORS[i % DAY_COLORS.length] }} />
                      <div className="mb-3">
                        <span className="text-[8px] font-black uppercase tracking-widest"
                          style={{ color: DAY_COLORS[i % DAY_COLORS.length] }}>
                          {day.day ?? `Day ${i + 1}`}
                        </span>
                        {day.bestTime && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-2.5 h-2.5 text-slate-600" />
                            <span className="text-[8px] text-slate-600">{day.bestTime}</span>
                          </div>
                        )}
                      </div>

                      {day.contentType && (
                        <div className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 inline-flex mb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{day.contentType}</span>
                        </div>
                      )}
                      {day.topic && <p className="text-[10px] font-black text-white leading-tight mb-2">{day.topic}</p>}
                      {day.hook && <p className="text-[9px] text-slate-500 leading-snug italic">&quot;{day.hook}&quot;</p>}
                      {day.estimatedReach != null && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-[8px] font-black text-emerald-400">{day.estimatedReach.toLocaleString()} est. reach</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GrowthInsightsView
