'use client'

import { useState, useEffect, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  Zap, TrendingDown, AlertTriangle,
  CheckCircle2, Flame, MessageSquare, Eye, Heart,
  ArrowUpRight, Brain,
  RefreshCw, Share2, ActivitySquare, X
} from 'lucide-react'
import { apiGet } from '../lib/api'
import ToastContainer from '../components/ToastContainer'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialogBehavior } from './ui/modal'

const glass = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

// ── Types ──────────────────────────────────────────────────────────────────────
// Shape the UI renders. Built from GET /api/analytics/engagement/command-center,
// which returns { posts: [...], peakVelocityPost } — every figure below is
// derived from those real post rows; nothing is invented when data is missing.
interface PostHealth {
  postId: string
  platform: string
  title?: string
  views: number
  likes: number
  comments: number
  shares: number
  healthScore: number | null // 0-100, null when the server has no score
  anomalyType: string
  anomalyAdvice: { action: string; reasoning: string; urgency: string } | null
}

interface CommandCenterData {
  totalViews: number
  avgEngagementRate: number | null
  avgScore: number | null
  topPost: PostHealth | null
  posts: PostHealth[]
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)

function normalisePost(raw: any): PostHealth {
  const score = raw?.healthScore ?? raw?.potencyScore
  const advice = raw?.anomalyAdvice ?? raw?.advice ?? null
  return {
    postId: String(raw?.postId ?? raw?.id ?? ''),
    platform: String(raw?.platform || 'other'),
    title: raw?.title || undefined,
    views: num(raw?.views),
    likes: num(raw?.likes),
    comments: num(raw?.comments),
    shares: num(raw?.shares),
    healthScore: score === null || score === undefined || !Number.isFinite(Number(score)) ? null : Math.round(Number(score)),
    anomalyType: String(raw?.anomalyType ?? raw?.anomaly?.type ?? 'none'),
    anomalyAdvice: advice && typeof advice.action === 'string' ? advice : null,
  }
}

function buildData(payload: any): CommandCenterData {
  const posts: PostHealth[] = (Array.isArray(payload?.posts) ? payload.posts : []).map(normalisePost)
  const totalViews = posts.reduce((a, p) => a + p.views, 0)
  const totalEngagements = posts.reduce((a, p) => a + p.likes + p.comments + p.shares, 0)
  const scored = posts.filter((p) => p.healthScore !== null)
  const topPost = posts.length > 0 ? [...posts].sort((a, b) => b.views - a.views)[0] : null
  return {
    totalViews,
    avgEngagementRate: totalViews > 0 ? (totalEngagements / totalViews) * 100 : null,
    avgScore: scored.length > 0 ? Math.round(scored.reduce((a, p) => a + (p.healthScore as number), 0) / scored.length) : null,
    topPost: topPost && topPost.views > 0 ? topPost : null,
    posts,
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function getScoreColor(score: number | null) {
  if (score === null) return 'text-slate-400'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

function getScoreBg(score: number | null) {
  if (score === null) return 'bg-white/[0.02] border-white/10'
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-rose-500/10 border-rose-500/20'
}

function getAnomalyIcon(type: string) {
  switch (type) {
    case 'virality_spike': return <Flame className="w-5 h-5 text-orange-400" />
    case 'shadow_banned':  return <AlertTriangle className="w-5 h-5 text-rose-400" />
    case 'drop_off':       return <TrendingDown className="w-5 h-5 text-amber-400" />
    default:               return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
  }
}

const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

// ── Component ──────────────────────────────────────────────────────────────────
export default function ResonanceCommandMatrix() {
  const { t } = useTranslation()
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedPost, setSelectedPost] = useState<PostHealth | null>(null)
  const panelRef = useDialogBehavior(!!selectedPost, () => setSelectedPost(null))

  const fetchResonanceData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res: any = await apiGet('/analytics/engagement/command-center', undefined, false)
      setData(buildData(res?.data ?? res))
    } catch {
      // An honest error state — never substitute invented numbers.
      setData(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchResonanceData() }, [fetchResonanceData])

  const anomalyLabel = (type: string) => {
    switch (type) {
      case 'virality_spike': return t('engagementCommandCenter.anomalyViralitySpike')
      case 'shadow_banned': return t('engagementCommandCenter.anomalyLowReach')
      case 'drop_off': return t('engagementCommandCenter.anomalyDropOff')
      case 'low_comment_ratio': return t('engagementCommandCenter.anomalyLowComments')
      default: return type.replace(/_/g, ' ')
    }
  }

  if (loading) return (
     <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-48 min-h-screen text-white">
        <Brain size={64} className="text-indigo-500 animate-pulse mb-8" aria-hidden="true" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('engagementCommandCenter.decodingMatrix')}</span>
     </div>
  );

  if (error || !data) return (
    <div role="alert" className="flex flex-col items-center justify-center py-48 min-h-screen text-white gap-8 px-6 text-center">
      <AlertTriangle size={48} className="text-rose-400" aria-hidden="true" />
      <p className="text-xl font-bold max-w-md">{t('engagementCommandCenter.loadFailed')}</p>
      <button
        type="button"
        onClick={fetchResonanceData}
        className="px-10 py-4 bg-white text-black font-black uppercase text-[13px] tracking-widest rounded-[3rem] hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-4"
      >
        <RefreshCw size={18} aria-hidden="true" /> {t('engagementCommandCenter.retry')}
      </button>
    </div>
  )

  const kpis = [
    { label: t('engagementCommandCenter.kpiTotalViews'), value: formatK(data.totalViews), icon: Eye, color: 'text-white' },
    { label: t('engagementCommandCenter.kpiEngagementRate'), value: data.avgEngagementRate === null ? '—' : `${data.avgEngagementRate.toFixed(1)}%`, icon: Heart, color: 'text-rose-400' },
    { label: t('engagementCommandCenter.kpiResonanceIntegrity'), value: data.avgScore === null ? '—' : `${data.avgScore}%`, icon: Brain, color: getScoreColor(data.avgScore) },
    { label: t('engagementCommandCenter.kpiPostsTracked'), value: String(data.posts.length), icon: Zap, color: 'text-indigo-400' },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-6 md:px-10 pt-16 max-w-[1750px] mx-auto space-y-16">
        <ToastContainer />

        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-50">
           <div className="flex items-center gap-8">
              <div className="w-20 h-20 bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                <Brain size={40} className="text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                 <span className="text-[12px] font-black uppercase tracking-[0.3em] text-indigo-400 leading-none">{t('engagementCommandCenter.matrixVersion')}</span>
                 <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none my-2">{t('engagementCommandCenter.resonanceHub')}</h1>
                 <p className="text-slate-400 text-[14px] font-semibold leading-snug">{t('engagementCommandCenter.headerSubtitleReal')}</p>
              </div>
           </div>
           <button type="button" onClick={fetchResonanceData}
             className="px-10 py-5 bg-white text-black font-black uppercase text-[13px] tracking-[0.2em] rounded-[3rem] hover:bg-indigo-500 hover:text-white transition-all active:scale-95 flex items-center gap-4 group"
           >
              <RefreshCw size={22} className="group-hover:rotate-180 transition-transform duration-1000" aria-hidden="true" />
              {t('engagementCommandCenter.syncResonanceData')}
           </button>
        </header>

        {data.posts.length === 0 ? (
          <div className={`${glass} p-16 rounded-[4rem] text-center space-y-4`}>
            <ActivitySquare size={40} className="text-indigo-400 mx-auto" aria-hidden="true" />
            <h2 className="text-3xl font-black text-white tracking-tight">{t('engagementCommandCenter.emptyTitle')}</h2>
            <p className="text-slate-400 text-[14px] max-w-lg mx-auto">{t('engagementCommandCenter.emptyBody')}</p>
          </div>
        ) : (
        <>
        {/* KPI row — totals computed from the returned posts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 relative z-10">
          {kpis.map((kpi, i) => (
            <m.div key={kpi.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`${glass} p-8 md:p-12 rounded-[4rem] flex flex-col items-center text-center border-white/5`}
            >
               <div className="w-16 h-16 rounded-[2rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-6">
                  <kpi.icon size={30} className={`${kpi.color} opacity-80`} aria-hidden="true" />
               </div>
               <div className={`text-5xl md:text-6xl font-black tracking-tighter tabular-nums leading-none mb-4 ${kpi.color}`}>
                 {kpi.value}
               </div>
               <div className="text-[12px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none">{kpi.label}</div>
            </m.div>
          ))}
        </div>

        {/* Top post */}
        {data.topPost && (
          <m.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className={`${glass} p-10 md:p-16 rounded-[5rem] bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20 cursor-pointer group flex flex-col gap-8 relative z-10`}
            onClick={() => setSelectedPost(data.topPost)}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-[1.8rem] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center"><Flame size={28} className="text-orange-400" aria-hidden="true" /></div>
                   <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none">{t('engagementCommandCenter.topPostTitle')}</h3>
                </div>
                <ArrowUpRight size={36} className="text-orange-400 opacity-30 group-hover:opacity-100 transition-all" aria-hidden="true" />
             </div>
             <div className="flex flex-wrap items-center gap-6">
               <p className="text-2xl font-black text-white/60 uppercase tracking-widest">{t('engagementCommandCenter.phantomNode', { platform: data.topPost.platform.toUpperCase() })}</p>
               <div className="h-2 w-2 rounded-full bg-orange-500" />
               <p className="text-2xl font-black text-orange-400">{t('engagementCommandCenter.viewsCount', { count: data.topPost.views.toLocaleString() })}</p>
             </div>
             {data.topPost.title && <p className="text-lg text-slate-300 font-semibold truncate">{data.topPost.title}</p>}
             {data.topPost.anomalyAdvice && (
               <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/5">
                 <div className="text-[12px] font-black text-orange-400 uppercase tracking-widest mb-2">{t('engagementCommandCenter.advisoryProtocol')}</div>
                 <p className="text-[18px] font-bold text-white tracking-tight leading-snug">{data.topPost.anomalyAdvice.action}</p>
               </div>
             )}
          </m.div>
        )}

        {/* Post list */}
        <div className={`${glass} p-8 md:p-12 rounded-[5rem] space-y-10 border-white/5 relative overflow-hidden`}>
           <div className="flex items-center gap-6 relative z-10">
              <div className="p-5 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20"><ActivitySquare size={32} className="text-indigo-400" aria-hidden="true" /></div>
              <div>
                 <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">{t('engagementCommandCenter.nodeIntegrityLedger')}</h2>
                 <p className="text-[13px] text-slate-400 font-semibold leading-none">{t('engagementCommandCenter.ledgerSubtitleReal')}</p>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-6 relative z-10">
              {data.posts.map((post, i) => (
                <m.div key={post.postId || i} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`${glass} flex flex-col xl:flex-row items-center gap-8 p-8 rounded-[3rem] border cursor-pointer ${getScoreBg(post.healthScore)}`}
                  onClick={() => setSelectedPost(post)}
                >
                   <div className="w-16 h-16 rounded-[1.8rem] bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0">
                      {getAnomalyIcon(post.anomalyType)}
                   </div>

                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                         <span className="text-2xl font-black text-white uppercase tracking-tighter">{t('engagementCommandCenter.platformNode', { platform: post.platform })}</span>
                         {post.anomalyType !== 'none' && (
                           <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest border border-orange-500/30 px-4 py-1.5 rounded-full bg-orange-500/5">
                             {anomalyLabel(post.anomalyType)}
                           </span>
                         )}
                      </div>
                      {post.title && <p className="text-[14px] text-slate-300 truncate mb-3">{post.title}</p>}
                      <div className="flex flex-wrap items-center gap-6 text-[12px] text-slate-400 font-black uppercase tracking-widest">
                         <div className="flex items-center gap-2"><Eye size={16} aria-hidden="true" /> <span>{t('engagementCommandCenter.viewsCount', { count: post.views.toLocaleString() })}</span></div>
                         <div className="flex items-center gap-2"><Heart size={16} aria-hidden="true" /> <span>{t('engagementCommandCenter.likesCount', { count: post.likes.toLocaleString() })}</span></div>
                         <div className="flex items-center gap-2"><MessageSquare size={16} aria-hidden="true" /> <span>{t('engagementCommandCenter.commentsCount', { count: post.comments.toLocaleString() })}</span></div>
                         <div className="flex items-center gap-2"><Share2 size={16} aria-hidden="true" /> <span>{t('engagementCommandCenter.sharesCount', { count: post.shares.toLocaleString() })}</span></div>
                      </div>
                   </div>

                   <div className={`text-5xl font-black tracking-tighter tabular-nums leading-none ${getScoreColor(post.healthScore)}`}>
                      {post.healthScore === null ? '—' : `${post.healthScore}%`}
                   </div>
                </m.div>
              ))}
           </div>
        </div>
        </>
        )}

        {/* ── Post detail dialog ── */}
        <AnimatePresence>
          {selectedPost && (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-6"
              onClick={() => setSelectedPost(null)}
              role="dialog"
              aria-modal="true"
              aria-label={t('engagementCommandCenter.nodeDiagnostic', { platform: selectedPost.platform.toUpperCase() })}
            >
              <m.div ref={panelRef} initial={{ scale: 0.9, y: 100, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 100, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
                className={`${glass} w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[4rem] p-10 md:p-16 space-y-10 border-white/10 relative`}
                onClick={e => e.stopPropagation()}
              >
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] flex items-center justify-center">
                          {getAnomalyIcon(selectedPost.anomalyType)}
                       </div>
                       <h4 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                          {t('engagementCommandCenter.nodeDiagnostic', { platform: selectedPost.platform.toUpperCase() })}
                       </h4>
                    </div>
                    <button type="button" onClick={() => setSelectedPost(null)}
                        title={t('engagementCommandCenter.closeDetails')} aria-label={t('engagementCommandCenter.closeDetails')}
                        className="w-14 h-14 rounded-[1.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <X size={28} aria-hidden="true" />
                    </button>
                 </div>

                 {selectedPost.healthScore !== null && (
                   <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className={`text-8xl font-black tracking-tighter leading-none ${getScoreColor(selectedPost.healthScore)}`}>
                         {selectedPost.healthScore}<span className="text-3xl opacity-40 ml-2">%</span>
                      </div>
                      <div className="text-[13px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none">{t('engagementCommandCenter.nodeIntegrityIndex')}</div>
                   </div>
                 )}

                 {selectedPost.anomalyType !== 'none' && selectedPost.anomalyAdvice && (
                   <div className="p-10 rounded-[3rem] bg-indigo-600/10 border border-indigo-500/30 space-y-6">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                         <div className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('engagementCommandCenter.heuristicRecommendation')}</div>
                         <div className="flex items-center gap-2 text-orange-400 text-[12px] font-bold">
                            <AlertTriangle size={16} aria-hidden="true" /> {selectedPost.anomalyAdvice.urgency}
                         </div>
                      </div>
                      <p className="text-2xl font-black text-white tracking-tight leading-tight border-l-4 border-indigo-500/30 pl-6">
                        {selectedPost.anomalyAdvice.action}
                      </p>
                      <p className="text-[15px] text-slate-400 leading-relaxed pl-6">
                        {selectedPost.anomalyAdvice.reasoning}
                      </p>
                   </div>
                 )}

                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <DetailStat label={t('engagementCommandCenter.statViews')} value={selectedPost.views.toLocaleString()} icon={Eye} color="text-emerald-400" />
                    <DetailStat label={t('engagementCommandCenter.statLikes')} value={selectedPost.likes.toLocaleString()} icon={Heart} color="text-rose-400" />
                    <DetailStat label={t('engagementCommandCenter.statComments')} value={selectedPost.comments.toLocaleString()} icon={MessageSquare} color="text-indigo-400" />
                    <DetailStat label={t('engagementCommandCenter.statShares')} value={selectedPost.shares.toLocaleString()} icon={Share2} color="text-amber-400" />
                 </div>

                 <div className="pt-4 flex justify-center">
                    <button type="button" onClick={() => setSelectedPost(null)} className="px-14 py-5 bg-white text-black font-black uppercase text-[14px] tracking-[0.3em] rounded-[3rem] hover:bg-indigo-600 hover:text-white transition-all active:scale-95">{t('engagementCommandCenter.closeDiagnosticButton')}</button>
                 </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}

function DetailStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="p-8 rounded-[3rem] bg-black/60 border border-white/10 flex flex-col items-center text-center group hover:bg-white/[0.04] transition-all duration-700 shadow-inner">
      <Icon className={`w-8 h-8 ${color} mb-4 opacity-70 group-hover:scale-125 transition-all duration-700`} />
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{label}</div>
      <div className={`text-3xl font-black italic tracking-tighter tabular-nums ${color} leading-none group-hover:scale-110 transition-transform duration-700 drop-shadow-2xl`}>{value}</div>
    </div>
  )
}
