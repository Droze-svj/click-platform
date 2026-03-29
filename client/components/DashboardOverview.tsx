'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../lib/api'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'
import {
  Plus,
  ArrowUpRight,
  Settings,
  Bell,
  Zap,
  TrendingUp,
  Users,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  MoreHorizontal,
  Activity,
  Calendar,
  Layers,
  Search,
  MousePointer2
} from 'lucide-react'

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
  }
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [statsResponse, overviewResponse] = await Promise.all([
        apiGet('/dashboard/stats'),
        apiGet('/dashboard/overview')
      ])

      setStats(statsResponse.stats)
      setOverview(overviewResponse.overview)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
      setError(err.message || 'Failed to sync with Click Cloud')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
          <div className="w-16 h-16 rounded-3xl border-2 border-indigo-500/30 border-t-indigo-500 animate-spin flex items-center justify-center">
            <Zap className="w-6 h-6 text-indigo-400" />
          </div>
        </div>
        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synchronizing Intelligence</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-white">Connection Interrupted</h3>
        <p className="text-rose-200/60 text-sm max-w-sm mx-auto">{error}</p>
        <button onClick={loadDashboardData} className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm">Retry Sync</button>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10"
    >
      {/* Welcome Hero Area */}
      {overview?.user && (
        <motion.div variants={itemVariants} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-blue-600/20 to-purple-600/20 blur-3xl group-hover:opacity-100 transition-opacity opacity-50" />
          <div className={`relative ${glassStyle} p-10 md:p-12 rounded-[3.5rem] overflow-hidden`}>
            {/* Animated Pattern */}
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Layers className="w-64 h-64 rotate-12" />
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="space-y-6 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" />
                  Elite Access Active
                </div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                  Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{overview.user.name.split(' ')[0]}</span>.
                </h1>
                <p className="text-slate-400 text-lg md:text-xl font-medium max-w-xl">
                  Your autonomous ecosystem is performing perfectly. Engagement is <span className="text-emerald-400 font-bold">up 14.2%</span> since your last visit.
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <span className="px-5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Domain
                  </span>
                  <span className="px-5 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    Enterprise Safe
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <button className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <Plus className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">New Content</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <Calendar className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Scheduler</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modern Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Intelligence Core', value: stats.postsCount, sub: 'Optimized Posts', icon: <FileText className="text-indigo-400" />, color: 'indigo' },
            { label: 'Brand Reach', value: stats.followersCount.toLocaleString(), sub: 'Global Audience', icon: <Users className="text-blue-400" />, color: 'blue' },
            { label: 'Engagement Velocity', value: `${stats.engagementRate}%`, sub: 'Above Benchmark', icon: <TrendingUp className="text-emerald-400" />, color: 'emerald' },
            { label: 'Retention Health', value: stats.trialDaysLeft, sub: 'Days Remaining', icon: <Clock className="text-amber-400" />, color: 'amber' }
          ].map((s, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -6 }}
              className={`relative ${glassStyle} p-8 rounded-[2.5rem] overflow-hidden group`}
            >
              <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${s.color}-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-2xl bg-${s.color}-500/10 flex items-center justify-center`}>
                  {s.icon}
                </div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  {s.label}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-black text-white tracking-tighter">
                  {s.value}
                </div>
                <div className="text-sm font-medium text-slate-500">
                  {s.sub}
                </div>
              </div>
              <ArrowUpRight className="absolute bottom-8 right-8 w-4 h-4 text-slate-700 group-hover:text-white transition-colors" />
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Quick Actions Panel */}
        <motion.div variants={itemVariants} className="lg:col-span-12">
          {overview?.quickActions && (
            <div className={`relative ${glassStyle} p-10 rounded-[3rem] overflow-hidden`}>
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-2xl font-black text-white tracking-tight">Direct Operations</h2>
                </div>
                <button className="p-3 rounded-2xl bg-white/5 text-slate-500">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {overview.quickActions.map((action: any) => (
                  <button
                    key={action.id}
                    className="p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all text-left group"
                  >
                    <div className="text-4xl mb-6 group-hover:scale-110 transition-transform origin-left">{action.icon}</div>
                    <h3 className="text-lg font-black text-white mb-2">{action.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{action.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Intelligence Feed / Notifications */}
        <motion.div variants={itemVariants} className="lg:col-span-12">
          {overview?.notifications && (
            <div className={`relative ${glassStyle} p-10 rounded-[3rem] overflow-hidden`}>
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-2xl font-black text-white tracking-tight">Intelligence Log</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050505] bg-slate-800" />)}
                  </div>
                  <span className="text-xs font-bold text-slate-500 text-xs">8 Online</span>
                </div>
              </div>

              <div className="space-y-4">
                {overview.notifications.map((notif: any) => (
                  <motion.div
                    key={notif.id}
                    whileHover={{ x: 6 }}
                    className="p-6 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${notif.type === 'info' ? 'bg-indigo-500/10 text-indigo-400' :
                          notif.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-amber-500/10 text-amber-400'
                        }`}>
                        {notif.type === 'info' ? <Zap className="w-5 h-5" /> :
                          notif.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                            <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">{notif.title}</h4>
                        <p className="text-sm text-slate-500 font-medium">{notif.message}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {new Date(notif.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full ml-auto mt-2 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

const CheckCircle2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
const AlertCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>

