'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Zap, Activity, ShieldCheck,
  BarChart3, Orbit, Cpu
} from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

const glassStyle = 'backdrop-blur-3xl bg-black/40 border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)]'

interface OracleInsight {
  type: string
  text: string
  score: number | null
  expectedImpact?: string
}

export default function RevenueOracle() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<OracleInsight[]>([])
  const [meta, setMeta] = useState<{ status?: string; niche?: string; analyzedVideos?: number }>({})

  useEffect(() => {
    let cancelled = false
    async function fetchInsights() {
      try {
        // Real, authenticated insights derived from the user's own published-post
        // performance (GET /api/sovereign/insights). No fabricated numbers.
        const res: any = await apiGet('/sovereign/insights')
        const payload = res?.data ?? res
        if (!cancelled) {
          setInsights(Array.isArray(payload?.insights) ? payload.insights : [])
          setMeta({ status: payload?.status, niche: payload?.niche, analyzedVideos: payload?.analyzedVideos })
        }
      } catch (err) {
        console.error('RevenueOracle: Failed to fetch insights', err)
        if (!cancelled) setInsights([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInsights()
    const interval = setInterval(fetchInsights, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (loading) {
    return (
      <div className={`w-full h-[600px] ${glassStyle} rounded-[4rem] flex flex-col items-center justify-center space-y-8 relative overflow-hidden`}>
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5" />
         <Orbit className="animate-spin text-indigo-500 opacity-20" size={120} />
         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] animate-pulse italic">{t('revenueOracle.synchronizing')}</p>
      </div>
    )
  }

  return (
    <div className={`w-full ${glassStyle} rounded-[4rem] p-12 relative overflow-hidden group`}>
      {/* Background Kinetic Layer */}
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
        <Cpu size={400} className="rotate-45" />
      </div>

      <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-[2.2rem] flex items-center justify-center shadow-2xl overflow-hidden relative">
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
               className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent"
             />
             <TrendingUp className="text-emerald-400 relative z-10" size={36} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none mb-2">{t('revenueOracle.title')}</h1>
            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.4em] italic leading-none border-l-2 border-emerald-500/20 pl-4 ml-1">{t('revenueOracle.subtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-1">{t('revenueOracle.postsAnalyzed')}</p>
              <p className="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">
                {typeof meta.analyzedVideos === 'number' ? meta.analyzedVideos : '—'}
              </p>
           </div>
           <div className="w-[1px] h-12 bg-white/10" />
           <div className="flex flex-col items-end">
              <span className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">
                 <ShieldCheck size={14} />
                 {t('revenueOracle.niche')}
              </span>
              <p className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest mt-1">
                {meta.niche || '—'}
              </p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        {/* Left Stats Console */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="p-8 rounded-[2.8rem] bg-white/[0.03] border border-white/10 group/stat hover:bg-emerald-500/5 transition-all duration-700">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <Zap className="text-amber-400" size={18} />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest italic">{t('revenueOracle.salesResonance')}</span>
                 </div>
                 <span className="text-2xl font-black text-slate-600 italic tabular-nums">—</span>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 relative" />
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-4 italic">{t('revenueOracle.awaitingResonance')}</p>
           </div>

           <div className="p-8 rounded-[2.8rem] bg-white/[0.03] border border-white/10 group/stat hover:bg-indigo-500/5 transition-all duration-700">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <BarChart3 className="text-indigo-400" size={18} />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest italic">{t('revenueOracle.neuralPacing')}</span>
                 </div>
                 <span className="text-2xl font-black text-slate-600 italic tabular-nums">—</span>
              </div>
               <div className="flex justify-center items-center h-12 px-2">
                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">{t('revenueOracle.noPacingTelemetry')}</p>
               </div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-4 italic">{t('revenueOracle.awaitingCutFrequency')}</p>
           </div>

           <div className="p-8 rounded-[2.8rem] bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-4 mb-4">
                 <ShieldCheck className="text-emerald-400" size={20} />
                 <h3 className="text-[12px] font-black text-emerald-400 uppercase tracking-widest leading-none italic">{t('revenueOracle.oracleInsights')}</h3>
              </div>
              <p className="text-[11px] font-black text-white leading-relaxed uppercase italic opacity-80">
                {insights[0]?.text || t('revenueOracle.emptyInsightsHint')}
              </p>
           </div>
        </div>

        {/* Center Trajectory Visualization */}
        <div className="col-span-12 lg:col-span-8 flex flex-col justify-end p-12 rounded-[3.5rem] bg-black/60 border border-white/5 relative group/viz overflow-hidden">
           <div className="absolute top-12 left-12 right-12 flex items-center gap-4">
              <Activity className="text-emerald-400 animate-pulse" size={20} />
              <div>
                 <h3 className="text-[12px] font-black text-[var(--text-main)] uppercase tracking-widest italic underline decoration-emerald-500/40 underline-offset-8">{t('revenueOracle.strategicInsightFeed')}</h3>
                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">{t('revenueOracle.feedSubtitle')}</p>
              </div>
           </div>

           <div className="w-full mt-28 relative z-10 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                   <Activity className="text-slate-700" size={40} />
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] italic text-center">
                     {meta.status === 'cold_start' || meta.status === 'manual'
                       ? t('revenueOracle.coldStartHint')
                       : t('revenueOracle.noInsightsYet')}
                   </p>
                </div>
              ) : (
                insights.map((insight, i) => (
                  <div key={i} className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-start gap-5">
                     <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest italic shrink-0 mt-0.5">
                       {insight.type}
                     </span>
                     <div className="flex-1 min-w-0">
                       <p className="text-[12px] font-bold text-white/90 leading-relaxed italic">{insight.text}</p>
                       {insight.expectedImpact && (
                         <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mt-2 italic">{t('revenueOracle.impact', { impact: insight.expectedImpact })}</p>
                       )}
                     </div>
                     {typeof insight.score === 'number' && (
                       <span className="text-[10px] font-black text-emerald-400 italic tabular-nums shrink-0 mt-0.5">{Math.round(insight.score * 100)}%</span>
                     )}
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  )
}
