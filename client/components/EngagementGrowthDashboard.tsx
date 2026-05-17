'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Users, Heart, Eye, ArrowUp, ArrowDown, Target, Zap, Activity, Boxes } from 'lucide-react'
import axios from 'axios'
import { motion } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
const glass = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

interface GrowthMetrics {
  engagement: { current: number; previous: number; change: number; trend: 'up' | 'down' }
  followers: { current: number; previous: number; change: number; trend: 'up' | 'down' }
  reach: { current: number; previous: number; change: number; trend: 'up' | 'down' }
  engagementRate: { current: number; previous: number; change: number; trend: 'up' | 'down' }
}

interface GrowthInsight {
  type: 'opportunity' | 'warning' | 'success'
  title: string
  description: string
  action?: string
  impact: 'high' | 'medium' | 'low'
}

export default function EngagementGrowthDashboard() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null)
  const [insights, setInsights] = useState<GrowthInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const loadGrowthData = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/analytics/growth?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setMetrics(response.data.data.metrics)
        setInsights(response.data.data.insights || [])
      }
    } catch (error: any) {
      console.error('Growth data error:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { loadGrowthData() }, [loadGrowthData])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercent = (num: number) => {
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-xl rounded-[4rem] border-2 border-white/5 p-12 shadow-2xl">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-white/5 rounded-[2rem] w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-white/5 rounded-[3rem]"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 text-white">
      {/* Period Selector */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
           <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter leading-none mb-3">
             Resonance Growth
           </h2>
           <p className="text-slate-400 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">Mapping engagement kinetic and node saturation across cycles.</p>
        </div>
        <div className="flex items-center p-2 rounded-[2.5rem] bg-black/40 border-2 border-white/5 shadow-inner">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPeriod(p)}
              title={`View ${p === '7d' ? '7' : p === '30d' ? '30' : '90'} Cycles`}
              aria-label={`View ${p === '7d' ? '7' : p === '30d' ? '30' : '90'} Cycles`}
              className={`px-8 py-3 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic transition-all duration-300 ${
                period === p
                  ? 'bg-white text-black shadow-2xl scale-105'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.toUpperCase()}_CYCLE
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          <MetricCard label="Resonance" value={formatNumber(metrics.engagement.current)} change={metrics.engagement.change} icon={Heart} color="text-indigo-400" />
          <MetricCard label="Node Density" value={formatNumber(metrics.followers.current)} change={metrics.followers.change} icon={Users} color="text-violet-400" />
          <MetricCard label="Saturation" value={formatNumber(metrics.reach.current)} change={metrics.reach.change} icon={Eye} color="text-emerald-400" />
          <MetricCard label="Kinetic Rate" value={`${metrics.engagementRate.current.toFixed(2)}%`} change={metrics.engagementRate.change} icon={Target} color="text-amber-400" />
        </div>
      )}

      {/* Growth Insights */}
      {insights.length > 0 && (
        <div className={`${glass} rounded-[5rem] p-12 relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]`}>
          <div className="absolute top-0 right-0 p-32 opacity-[0.015] pointer-events-none"><Boxes size={400} className="text-white" /></div>
          <div className="flex items-center gap-6 mb-12 relative z-10">
            <div className="p-5 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/20"><TrendingUp size={32} className="text-indigo-400" /></div>
            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
              Strategic Growth Heuristics
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {insights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-8 rounded-[3.5rem] border-2 flex flex-col justify-between min-h-[220px] transition-all duration-700 shadow-2xl ${
                  insight.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : insight.type === 'warning'
                    ? 'bg-rose-500/10 border-rose-500/20'
                    : 'bg-indigo-500/10 border-indigo-500/20'
                }`}
              >
                <div>
                   <div className="flex items-center justify-between mb-4">
                      <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                        {insight.title}
                      </h4>
                      <span className={`text-[9px] px-4 py-1.5 rounded-full font-black uppercase tracking-[0.3em] italic border ${
                        insight.impact === 'high'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : insight.impact === 'medium'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                      }`}>
                        {insight.impact}_PRIORITY
                      </span>
                   </div>
                   <p className="text-[14px] text-slate-400 italic leading-relaxed uppercase font-medium tracking-tight">
                     {insight.description}
                   </p>
                </div>
                {insight.action && (
                  <button className="mt-8 text-[12px] font-black text-white uppercase italic tracking-[0.4em] hover:text-indigo-400 transition-colors flex items-center gap-4 group">
                    EXECUTE_PROTOCOL <span className="group-hover:translate-x-2 transition-transform">→</span>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, change, icon: Icon, color }: { label: string; value: string; change: number; icon: any; color: string }) {
  const isPositive = change >= 0
  return (
    <motion.div whileHover={{ y: -10, backgroundColor: 'rgba(255,255,255,0.06)' }}
      className={`${glass} p-10 rounded-[4rem] flex flex-col items-center text-center group border-white/5 relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]`}
    >
       <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"><Activity size={120} className="text-white" /></div>
       <div className={`w-20 h-20 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-700`}>
          <Icon size={36} className={`${color} opacity-80`} />
       </div>
       <div className="text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-4 drop-shadow-2xl">{value}</div>
       <div className="text-[14px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none mb-6">{label}</div>
       <div className={`flex items-center gap-3 px-6 py-2 rounded-full border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} text-[10px] font-black uppercase tracking-widest italic`}>
          {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(change).toFixed(1)}%_DELTA
       </div>
    </motion.div>
  )
}
