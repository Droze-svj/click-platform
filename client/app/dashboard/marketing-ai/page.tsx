'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Brain, RefreshCw, Sparkles, Zap, Globe, Target,
  ChevronRight, ArrowRight, Clock, AlertTriangle, CheckCircle2,
  BarChart3, Lightbulb, Flame, Activity, Star, Shield, Layers,
  MessageCircle, Heart, BookOpen, Compass, Rocket, Users
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

const glass = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/5 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-700'
const premiumCard = 'backdrop-blur-2xl bg-black/60 border-2 border-white/5 rounded-[3rem] shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] hover:border-indigo-500/20 transition-all duration-500'

type Panel = 'trends' | 'retention' | 'creativity' | 'engagement' | 'optimizer'

export default function MarketingOraclePage() {
  const { user } = useAuth()
  const [activePanel, setActivePanel] = useState<Panel>('trends')
  const [niche, setNiche] = useState('general')
  const [platform, setPlatform] = useState('instagram')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [data, setData] = useState<Record<string, any>>({})
  const [error, setError] = useState<Record<string, string>>({})

  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    // API_BASE already includes the `/api` prefix (NEXT_PUBLIC_API_URL=/api).
    // Earlier this concatenated `${API_BASE}/api/marketing-intelligence` and
    // produced `/api/api/marketing-intelligence/...` — a 404 every time.
    const res = await fetch(`${API_BASE}/marketing-intelligence${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }, [token])

  const load = useCallback(async (key: string, endpoint: string, options?: RequestInit) => {
    setLoading((l) => ({ ...l, [key]: true }))
    setError((e) => ({ ...e, [key]: '' }))
    try {
      const result = await apiFetch(endpoint, options)
      setData((d) => ({ ...d, [key]: result.data }))
    } catch (err: any) {
      setError((e) => ({ ...e, [key]: err.message || 'Failed to load' }))
    } finally {
      setLoading((l) => ({ ...l, [key]: false }))
    }
  }, [apiFetch])

  // Load dashboard overview on mount
  useEffect(() => {
    load('dashboard', `/dashboard?niche=${niche}&platform=${platform}`)
  }, [niche, platform, load])

  const syncSignals = async () => {
    setSyncing(true)
    try {
      const res = await apiFetch('/sync-signals', { method: 'POST' })
      if (res.success) {
        setSyncStatus(res.data)
        // Refresh dashboard data after sync
        load('dashboard', `/dashboard?niche=${niche}&platform=${platform}`)
      }
    } catch (err) {
      console.error('Sync failed', err)
    } finally {
      setTimeout(() => setSyncing(false), 2000)
    }
  }

  const panels: { id: Panel; label: string; icon: any; color: string; bg: string }[] = [
    { id: 'trends',     label: 'Global Trend Radar',   icon: Globe,       color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'retention',  label: 'Retention Engine',      icon: RefreshCw,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'creativity', label: 'Creativity Pulse',      icon: Sparkles,    color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    { id: 'engagement', label: 'Engagement Lab',        icon: MessageCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { id: 'optimizer',  label: 'Pre-Publish Analyzer',  icon: Target,      color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  ]

  return (
    <div className="min-h-screen bg-[#020205] text-white pb-40 px-8 pt-12 max-w-[1700px] mx-auto space-y-16">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; background: #020205; }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .shimmer { animation: shimmer 2s infinite linear; }
      `}</style>

      {/* ── Header ── */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard" className="flex items-center gap-3 text-slate-600 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors">
              <ChevronRight size={14} className="rotate-180" /> Back to Command
            </Link>
            <Link
              href="/dashboard/forge"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20 hover:border-fuchsia-500/50 transition-all text-[10px] font-black uppercase tracking-[0.18em]"
            >
              <Sparkles size={11} /> Apply in editor →
            </Link>
          </div>
          <div className="flex items-center gap-6 mb-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_80px_rgba(99,102,241,0.5)]">
              <Brain size={36} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.8em] text-indigo-400 mb-1">Marketing Oracle · 2026</p>
              <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">AI Marketing Expert</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm font-bold uppercase tracking-widest max-w-xl">
            Self-learning global intelligence · Real-time trend radar · Retention automation · Creativity & engagement engine
          </p>
        </div>

        {/* Controls & Sync */}
        <div className="flex flex-col xl:flex-row gap-8 items-center lg:items-end w-full lg:w-auto">
          <div className={`${glass} rounded-[3rem] p-8 flex flex-col sm:flex-row gap-6 min-w-[340px] border-indigo-500/10`}>
            <div className="space-y-3 flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.8em] text-slate-700 italic">Target_Niche</label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. fitness, finance..."
                className="w-full bg-black/60 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-900 font-black italic focus:outline-none focus:border-indigo-500/40 uppercase transition-all"
              />
            </div>
            <div className="space-y-3 flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.8em] text-slate-700 italic">Active_Matrix</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                title="Select platform"
                aria-label="Select platform"
                className="w-full bg-black/60 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm text-white font-black italic focus:outline-none focus:border-indigo-500/40 uppercase transition-all"
              >
                {['instagram','tiktok','linkedin','twitter','youtube','facebook'].map((p) => (
                  <option key={p} value={p} className="bg-black">{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={syncSignals}
            disabled={syncing}
            className={`group relative flex items-center gap-6 px-12 py-8 rounded-[3rem] font-black uppercase tracking-[0.4em] italic text-sm transition-all duration-300 overflow-hidden ${
              syncing 
              ? 'bg-indigo-600/30 text-indigo-300 cursor-wait' 
              : 'bg-white text-black hover:bg-slate-100 shadow-[0_40px_100px_rgba(255,255,255,0.2)]'
            }`}
          >
            <div className={`absolute inset-0 bg-indigo-600/20 translate-x-[-100%] ${syncing ? 'animate-shimmer' : 'group-hover:translate-x-[100%] transition-transform duration-500'}`} />
            {syncing ? (
              <>
                <RefreshCw size={24} className="animate-spin" />
                SYNK_FLUX_IN_PROGRESS...
              </>
            ) : (
              <>
                <Activity size={24} className="group-hover:animate-pulse" />
                Trigger SYNK_FLUX
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Operational Indicators ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { label: 'Neural_Fidelity', value: '99.9%', sub: 'ACTIVE_LINK', color: 'text-indigo-400' },
          { label: 'Signal_Sync', value: syncStatus ? 'CALIBRATED' : 'STABLE', sub: syncStatus ? syncStatus.timestamp.split('T')[1].slice(0,5) : 'CORE_ONLY', color: 'text-emerald-400' },
          { label: 'Matrix_Drift', value: '0.002', sub: 'MILLIRADIANS', color: 'text-amber-400' },
          { label: 'Quantum_Load', value: 'MINIMAL', sub: '42.1_PFLOPS', color: 'text-rose-400' },
        ].map((stat, i) => (
          <div key={i} className={`${glass} p-8 rounded-[2.5rem] border-white/5 space-y-3 group hover:border-white/20 transition-all`}>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] italic group-hover:text-white transition-colors">{stat.label}</p>
             <div className="flex items-end justify-between">
                <span className={`text-4xl font-black italic tracking-tighter ${stat.color}`}>{stat.value}</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.sub}</span>
             </div>
          </div>
        ))}
      </div>

      {/* ── Panel Navigation ── */}
      <nav className="flex flex-wrap gap-4">
        {panels.map((p) => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-500 border-2 ${
              activePanel === p.id
                ? 'bg-white text-black border-white shadow-[0_20px_60px_rgba(255,255,255,0.15)] scale-105'
                : `${glass} border-white/5 text-slate-500 hover:text-white hover:border-white/20`
            }`}
          >
            <p.icon size={18} />
            {p.label}
          </button>
        ))}
      </nav>

      {/* ── Panel Content ── */}
      <AnimatePresence mode="wait">
        {activePanel === 'trends' && (
          <motion.div key="trends" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <TrendsPanel niche={niche} load={load} data={data} loading={loading} error={error} />
          </motion.div>
        )}
        {activePanel === 'retention' && (
          <motion.div key="retention" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <RetentionPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
          </motion.div>
        )}
        {activePanel === 'creativity' && (
          <motion.div key="creativity" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <CreativityPanel niche={niche} topic={topic} setTopic={setTopic} load={load} data={data} loading={loading} error={error} />
          </motion.div>
        )}
        {activePanel === 'engagement' && (
          <motion.div key="engagement" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <EngagementPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
          </motion.div>
        )}
        {activePanel === 'optimizer' && (
          <motion.div key="optimizer" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
            <OptimizerPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
}

function ErrorBlock({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold">
      <AlertTriangle size={16} /> {msg}
    </div>
  )
}

function ActionButton({ label, icon: Icon, onClick, loading: isLoading, color = 'bg-white text-black' }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick} disabled={isLoading}
      className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${color} disabled:opacity-50 relative overflow-hidden`}
    >
      {isLoading ? <Spinner /> : <Icon size={16} />}
      {label}
    </motion.button>
  )
}

// ── Trends Panel ──────────────────────────────────────────────────────────────
function TrendsPanel({ niche, load, data, loading, error }: any) {
  const report = data.trendReport || data.dashboard?.trendReport
  const knowledge = data.knowledge || data.dashboard?.knowledgeInsights

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Trend Report */}
      <div className={`xl:col-span-2 ${glass} rounded-[2.5rem] p-10 space-y-8`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Globe size={20} className="text-indigo-400" />
              </div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Global Trend Radar</h2>
            </div>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Live 2026 intelligence for your niche</p>
          </div>
          <ActionButton label="Scan Now" icon={RefreshCw} loading={loading.trendReport}
            onClick={() => load('trendReport', `/trend-report?niche=${niche}`)} />
        </div>

        {error.trendReport && <ErrorBlock msg={error.trendReport} />}

        {report && (
          <div className="space-y-6">
            {/* Confidence score */}
            <div className="flex items-center gap-6">
              <div className="flex-1 h-3 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${report.confidenceScore || 80}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full"
                />
              </div>
              <span className="text-2xl font-black text-indigo-400 tabular-nums">{report.confidenceScore || 80}%</span>
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">Confidence</span>
            </div>

            {/* Niche opportunities */}
            {report.niching?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Niche Opportunities</p>
                {report.niching.slice(0, 4).map((opp: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-white text-sm mb-1">{opp.title || opp}</p>
                        {opp.description && <p className="text-slate-500 text-xs leading-relaxed">{opp.description}</p>}
                      </div>
                      {opp.urgency && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 ${
                          opp.urgency === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          opp.urgency === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>{opp.urgency}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Actionable insights */}
            {report.actionableInsights?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Actionable Insights</p>
                {report.actionableInsights.slice(0, 3).map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                    <Zap size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300 font-bold">{insight}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 2026 Macro Trends */}
            {report.globalTrends2026 && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">2026 Global Macro Trends</p>
                <div className="flex flex-wrap gap-2">
                  {report.globalTrends2026.slice(0, 6).map((t: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-black/60 border border-white/5 text-xs font-bold text-slate-400">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!report && !loading.trendReport && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Globe size={48} className="text-indigo-400/30" />
            <p className="text-slate-600 font-bold">Set your niche and click Scan Now to see live global trends</p>
          </div>
        )}
      </div>

      {/* Knowledge Base */}
      <div className={`${glass} rounded-[2.5rem] p-8 space-y-6`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <BookOpen size={20} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-black italic uppercase tracking-tighter">Knowledge Base</h3>
        </div>
        <ActionButton label="Get Insights" icon={Lightbulb} loading={loading.knowledge} color="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
          onClick={() => load('knowledge', `/knowledge-insights?niche=${niche}&format=video`)} />

        {knowledge && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600 mb-3">Recommended Frameworks</p>
              {knowledge.recommendedFrameworks?.map((f: any, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-black/40 border border-white/5 mb-3 space-y-1">
                  <p className="font-black text-amber-400 text-sm">{f.name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {f.bestFor?.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400 font-bold">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600 mb-3">Quick Wins</p>
              {knowledge.quickWins?.map((win: string, i: number) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-400 font-bold">{win}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Retention Panel ───────────────────────────────────────────────────────────
function RetentionPanel({ niche, platform, load, data, loading, error }: any) {
  const score = data.retentionScore
  const sequence = data.retentionSequence
  const campaign = data.retentionCampaign

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Score Card */}
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-8`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Activity size={20} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Retention Health</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Audience loyalty score</p>
          </div>
        </div>

        <ActionButton label="Calculate Score" icon={Target} loading={loading.retentionScore}
          color="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          onClick={() => load('retentionScore', '/retention-score')} />

        {error.retentionScore && <ErrorBlock msg={error.retentionScore} />}

        {score && (
          <div className="space-y-6">
            {/* Big score display */}
            <div className="relative flex items-center justify-center py-8">
              <div className="w-40 h-40 rounded-full border-8 border-white/5 flex items-center justify-center relative shadow-[0_0_80px_rgba(16,185,129,0.2)]">
                <motion.div 
                  className="absolute inset-0 rounded-full border-8 border-emerald-500/40" 
                  initial={false}
                  animate={{ clipPath: `inset(${100 - score.score}% 0 0 0)` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <div className="text-center">
                  <p className="text-5xl font-black text-emerald-400 tabular-nums leading-none">{score.score}</p>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600 mt-1">/100</p>
                </div>
              </div>
            </div>
            <p className="text-center text-sm font-black text-white">{score.verdict}</p>

            {/* Risk badge */}
            <div className={`px-5 py-3 rounded-2xl text-center text-sm font-black uppercase tracking-widest border ${
              score.riskLevel === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              score.riskLevel === 'high'     ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              score.riskLevel === 'medium'   ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              Risk Level: {score.riskLevel?.toUpperCase()}
            </div>

            {/* Improvements */}
            {score.improvements?.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Improvement Steps</p>
                {score.improvements.map((imp: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                    <ArrowRight size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-300 font-bold">{imp}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Re-engagement Sequence */}
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-6`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <RefreshCw size={20} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Re-engagement Sequence</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">5-post AI drip campaign</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <ActionButton label="Generate Sequence" icon={Rocket} loading={loading.retentionSequence}
            color="bg-violet-500/20 text-violet-400 border border-violet-500/30"
            onClick={() => load('retentionSequence', `/retention-sequence?niche=${niche}&platform=${platform}`)} />
          <ActionButton label="Build Campaign" icon={Star} loading={loading.retentionCampaign}
            color="bg-white text-black"
            onClick={() => load('retentionCampaign', '/retention-campaign', { method: 'POST', body: JSON.stringify({ niche, platform }) })} />
        </div>

        {(error.retentionSequence || error.retentionCampaign) && <ErrorBlock msg={error.retentionSequence || error.retentionCampaign} />}

        {sequence && (
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">
              {sequence.sequenceName} · {sequence.estimatedReachRate}
            </p>
            {sequence.posts?.slice(0, 5).map((post: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="p-4 rounded-2xl bg-black/60 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-violet-400 uppercase tracking-widest">Post {post.postNumber} · Day {post.dayOffset}</span>
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase">{post.psychTrigger}</span>
                </div>
                <p className="text-sm text-white font-bold leading-relaxed">{post.hook}</p>
                <p className="text-xs text-slate-500">{post.cta}</p>
              </motion.div>
            ))}
          </div>
        )}

        {campaign && (
          <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.6em] text-emerald-400">Campaign Plan Generated</p>
            <p className="text-sm font-black text-white">{campaign.campaignName}</p>
            <p className="text-xs text-slate-500">{campaign.totalPosts} posts scheduled · {campaign.campaignDurationDays} days</p>
            <p className="text-xs text-emerald-400 font-bold">{campaign.expectedOutcome}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Creativity Panel ──────────────────────────────────────────────────────────
function CreativityPanel({ niche, topic, setTopic, load, data, loading, error }: any) {
  const freshAngles = data.freshAngles
  const inspiration = data.inspiration || data.dashboard?.inspirationDrop

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-8`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Sparkles size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Fresh Angles Generator</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">10 non-obvious content angles</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-600">Topic or Idea</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`e.g. morning routines, mindset, money...`}
            className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 font-bold focus:outline-none focus:border-amber-500/50"
          />
          <ActionButton label="Generate 10 Fresh Angles" icon={Lightbulb} loading={loading.freshAngles}
            color="bg-amber-500 text-black hover:bg-amber-400"
            onClick={() => load('freshAngles', `/fresh-angles?topic=${encodeURIComponent(topic || 'content creation')}&niche=${niche}`)} />
        </div>

        {error.freshAngles && <ErrorBlock msg={error.freshAngles} />}

        {freshAngles?.angles?.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Your 10 Novel Angles</p>
            {freshAngles.angles.map((angle: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="p-5 rounded-2xl bg-black/60 border border-amber-500/10 hover:border-amber-500/30 transition-all group">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Angle {i + 1} · {angle.format}</span>
                  {angle.originalityScore && (
                    <span className="text-xs font-black text-slate-500">{angle.originalityScore}/100 originality</span>
                  )}
                </div>
                <p className="text-sm text-white font-bold leading-relaxed mb-2">{angle.angle}</p>
                <p className="text-xs text-amber-300/70 italic">🎣 {angle.hook}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Inspiration Drop */}
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-6`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Flame size={20} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Inspiration Drop</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Proven marketing framework · Applied to your niche</p>
          </div>
        </div>

        <ActionButton label="Get New Drop" icon={Compass} loading={loading.inspiration}
          color="bg-rose-500/20 text-rose-400 border border-rose-500/30"
          onClick={() => load('inspiration', `/inspiration-drop?niche=${niche}&format=video`)} />

        {(inspiration || data.dashboard?.inspirationDrop) && (() => {
          const drop = inspiration || data.dashboard?.inspirationDrop
          return (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 to-violet-500/10 border border-white/10 space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-rose-400">Framework</p>
                <p className="text-xl font-black text-white">{drop.framework}</p>
                <p className="text-sm text-slate-400 italic leading-relaxed">&ldquo;{drop.principle}&rdquo;</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">How to Execute</p>
                <p className="text-sm text-slate-300 leading-relaxed font-bold">{drop.adaptedExecution || drop.execution}</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/60 border border-white/5 space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Example</p>
                <p className="text-sm text-slate-400 leading-relaxed">{drop.example}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-amber-400 mb-2">Your Challenge Today</p>
                <p className="text-sm text-white font-bold">{drop.challengeForToday}</p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Engagement Panel ──────────────────────────────────────────────────────────
function EngagementPanel({ niche, platform, load, data, loading, error }: any) {
  const prompts = data.engagementPrompts
  const benchmarks = data.benchmarks || data.dashboard?.engagementBenchmarks

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-8`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <MessageCircle size={20} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Engagement Prompts</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">AI-written CTAs, polls & hooks</p>
          </div>
        </div>

        <ActionButton label="Generate Prompts" icon={Zap} loading={loading.engagementPrompts}
          color="bg-rose-500 text-white hover:bg-rose-400"
          onClick={() => load('engagementPrompts', `/engagement-prompts?platform=${platform}&niche=${niche}`)} />

        {error.engagementPrompts && <ErrorBlock msg={error.engagementPrompts} />}

        {prompts?.prompts?.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Ready-to-Use Prompts</p>
            {prompts.prompts.map((p: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="p-5 rounded-2xl bg-black/60 border border-rose-500/10 hover:border-rose-500/30 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    p.type === 'question' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    p.type === 'poll' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    p.type === 'challenge' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>{p.type || 'cta'}</span>
                  {(p.estimatedLift || p.estimated_engagement_lift) && (
                    <span className="text-xs font-black text-emerald-400">↑ {p.estimatedLift || p.estimated_engagement_lift}</span>
                  )}
                </div>
                <p className="text-sm text-white font-bold leading-relaxed">{p.text || p.prompt}</p>
                {p.psychTrigger && <p className="text-xs text-slate-600 mt-2">Trigger: {p.psychTrigger}</p>}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks */}
      <div className={`${glass} rounded-[2.5rem] p-10 space-y-6`}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <BarChart3 size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">2026 Benchmarks</h2>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">{platform} engagement standards</p>
          </div>
        </div>

        <ActionButton label="Load Benchmarks" icon={Target} loading={loading.benchmarks}
          color="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
          onClick={() => load('benchmarks', `/benchmarks?platform=${platform}`)} />

        {(benchmarks) && (() => {
          const b = benchmarks.benchmarks || (benchmarks.data?.benchmarks)
          if (!b) return null
          const tiers = [
            { label: 'Excellent', value: b.excellent, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Good', value: b.good, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
            { label: 'Average', value: b.average, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Poor', value: b.poor, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
          ]
          return (
            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">{platform.charAt(0).toUpperCase() + platform.slice(1)} Engagement Rate Benchmarks</p>
              {tiers.map((tier) => (
                <div key={tier.label} className={`flex items-center justify-between p-4 rounded-2xl border ${tier.bg}`}>
                  <span className="text-sm font-black text-white uppercase tracking-widest">{tier.label}</span>
                  <span className={`text-2xl font-black tabular-nums ${tier.color}`}>{tier.value}%+</span>
                </div>
              ))}
              <p className="text-xs text-slate-600 font-bold">Source: {benchmarks.note || '2026 industry standards'}</p>
            </div>
          )
        })()}

        {/* Quick engagement tips */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-600">Activate Your Audience</p>
          {[
            { icon: Heart, text: 'Add specific questions to every post — not "what do you think?" but "which of these two strategies matches your experience?"', color: 'text-rose-400' },
            { icon: Users, text: 'Reply to every comment in the first 60 minutes — algorithms reward early engagement velocity', color: 'text-indigo-400' },
            { icon: Shield, text: 'Pin your best comment to model the ideal response you want more of', color: 'text-emerald-400' },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <tip.icon size={14} className={`${tip.color} mt-0.5 shrink-0`} />
              <p className="text-xs text-slate-400 font-bold leading-relaxed">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 5. OPTIMIZER PANEL ──
function OptimizerPanel({ niche, platform, load, data, loading, error }: any) {
  const ld = loading['optimizer']
  const err = error['optimizer']
  const report = data['optimizer']
  const [content, setContent] = useState('')

  return (
    <div className="space-y-6">
      <div className={`${glass} rounded-3xl p-8`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
            <Target className="text-fuchsia-400" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-wide">Pre-Publish Content Analyzer</h2>
            <p className="text-slate-400 font-medium">Evaluate hook strength, predict engagement, and check algorithm fit before you post.</p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your drafted caption, tweet, or script here..."
            className="w-full bg-black/60 border border-white/10 rounded-2xl p-6 text-white min-h-[160px] font-medium leading-relaxed focus:outline-none focus:border-fuchsia-500/50"
          />
          
          <button
            onClick={() => load('optimizer', '/pre-publish-report', { method: 'POST', body: JSON.stringify({ contentText: content, platform, niche, format: 'post' }) })}
            disabled={ld || !content.trim()}
            className="w-full relative overflow-hidden group bg-white text-black font-black uppercase tracking-widest py-4 px-8 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {ld ? (
              <span className="flex items-center justify-center gap-3">
                <RefreshCw className="animate-spin" size={18} /> Analyzing Content DNA...
              </span>
            ) : "Analyze Content"}
          </button>
          {err && <p className="text-red-400 text-sm font-bold bg-red-500/10 p-4 rounded-xl">{err}</p>}
        </div>

        {report && (
          <div className="mt-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Verdict Header */}
            <div className={`p-6 rounded-2xl border ${report.overallScore >= 75 ? 'bg-emerald-500/10 border-emerald-500/30' : report.overallScore >= 55 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/30'} flex items-center justify-between`}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pre-Flight Verdict</p>
                <h3 className="text-2xl font-black mt-1">{report.verdict}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Score</p>
                <div className={`text-4xl font-black ${report.overallScore >= 75 ? 'text-emerald-400' : report.overallScore >= 55 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {report.overallScore}/100
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Hook Strength */}
              <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-black uppercase tracking-wide flex items-center gap-2"><Flame size={18} className="text-orange-400"/> Hook Analysis</h4>
                  <span className="text-orange-400 font-bold">{report.hookAnalysis.score}/100</span>
                </div>
                <div className="space-y-2">
                  {report.hookAnalysis.signals.map((s: any, i: number) => (
                    <div key={i} className="flex gap-2 text-sm text-emerald-400 bg-emerald-500/5 p-2 rounded-lg">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> <span>{s.signal}</span>
                    </div>
                  ))}
                  {report.hookAnalysis.weaknesses.map((w: string, i: number) => (
                    <div key={i} className="flex gap-2 text-sm text-rose-400 bg-rose-500/5 p-2 rounded-lg">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{w}</span>
                    </div>
                  ))}
                </div>
                {report.hookAnalysis.rewrites?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-3">AI Rewrites to test</p>
                    <div className="space-y-3">
                      {report.hookAnalysis.rewrites.map((r: any, i: number) => (
                        <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <p className="text-xs text-orange-400 font-bold mb-1">{r.label}</p>
                          <p className="text-sm">&quot;{r.text}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Platform Fit & Emotion */}
              <div className="space-y-6">
                <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-4">
                  <h4 className="font-black uppercase tracking-wide flex items-center gap-2"><Activity size={18} className="text-blue-400"/> {platform} Algorithm Fit</h4>
                  <div className="space-y-2">
                    {report.platformFit.risksDetected.length > 0 ? (
                      report.platformFit.risksDetected.map((r: any, i: number) => (
                        <div key={i} className="text-sm bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl">
                          <strong>Risk:</strong> {r.issue} <br/>
                          <span className="text-white">Fix: {r.fix}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={16} /> Content is cleanly aligned with top signals
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-4">
                  <h4 className="font-black uppercase tracking-wide flex items-center gap-2"><Heart size={18} className="text-pink-400"/> Emotional Resonance</h4>
                  <div className="flex gap-2 mb-3">
                    <span className="px-3 py-1 bg-pink-500/20 text-pink-300 text-xs font-bold rounded-full uppercase tracking-wider">
                      Dominant: {report.emotionalResonance.dominantEmotion}
                    </span>
                  </div>
                  {report.emotionalResonance.missingHighImpactTriggers?.[0] && (
                    <div className="text-sm bg-white/5 p-3 rounded-xl">
                      <p className="text-slate-400 mb-1">Missing high-impact trigger: <strong>{report.emotionalResonance.missingHighImpactTriggers[0].trigger}</strong></p>
                      <p className="text-white italic">&quot;{report.emotionalResonance.missingHighImpactTriggers[0].suggestion}&quot;</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Timings */}
            <div className="bg-black/40 border border-white/5 p-6 rounded-2xl">
              <h4 className="font-black uppercase tracking-wide mb-4 flex items-center gap-2"><Clock size={18} className="text-indigo-400"/> Optimal Posting Windows</h4>
              <div className="flex flex-wrap gap-3">
                {report.optimalPostingTimes.optimalWindows.map((tw: any, i: number) => (
                  <div key={i} className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm">
                    <strong className="text-indigo-300">{tw.day}</strong> <span className="text-slate-400">@ {tw.time}</span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  )
}

