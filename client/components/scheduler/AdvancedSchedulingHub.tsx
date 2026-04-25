'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  Target, 
  Zap, 
  TrendingUp,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowRight,
  Sparkle,
  Copy,
  Link as LinkIcon,
  Globe,
  Archive,
  BarChart2
} from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

interface ScheduledPost {
  _id: string;
  platform: string;
  scheduledTime: string;
  content: {
    text: string;
    mediaUrl?: string;
  };
  status: string;
  conflictResolved?: boolean;
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

export default function AdvancedSchedulingHub() {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'timeline' | 'templates' | 'recursion' | 'sync'>('timeline')
  const [analytics, setAnalytics] = useState<any>(null)
  const { user } = useAuth()

  const loadData = async () => {
    setLoading(true)
    try {
      const [postsRes, analyticsRes, templatesRes] = await Promise.all([
        apiGet<any>('/scheduler'),
        apiGet<any>('/scheduler/analytics'),
        apiGet<any>('/scheduler/templates')
      ])
      setPosts(postsRes.data || [])
      setAnalytics(analyticsRes)
      setTemplates(templatesRes || [])
      
      // Auto-detect conflicts for current posts
      if (postsRes.data?.length > 1) {
        // We could call a bulk conflict detector or do local logic
        // For now, let's assume the backend already flagged them or we fetch them
      }
    } catch (err) {
      console.error('Failed to load scheduling data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedPosts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleBulkReschedule = async (timeShiftMs: number) => {
    try {
      await apiPost('/scheduler/bulk-reschedule', {
        postIds: selectedPosts,
        timeShiftMs
      })
      setSelectedPosts([])
      setShowBulkModal(false)
      loadData()
    } catch (err) {
      console.error('Bulk reschedule failed', err)
    }
  }

  return (
    <div className="space-y-12 font-inter text-white">
      {/* HUD Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { label: 'Total Trajectories', val: posts.length, icon: Layers, color: 'text-white' },
          { label: 'Optimal Alignment', val: analytics?.optimalTimeUsage ? `${Math.round(analytics.optimalTimeUsage)}%` : '---', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Signal Conflicts', val: analytics?.conflictRate ? Math.round(analytics.conflictRate) : 0, icon: AlertTriangle, color: 'text-rose-400' },
          { label: 'Active Recursions', val: analytics?.byStatus?.active || 0, icon: RefreshCw, color: 'text-indigo-400' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${glassStyle} p-6 rounded-[2.5rem] flex items-center gap-6 group hover:bg-white/[0.05]`}
          >
            <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1 italic">{stat.label}</p>
              <p className={`text-3xl font-black italic tracking-tighter ${stat.color}`}>{stat.val}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Main Timeline Column */}
        <div className="xl:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <Calendar className="text-indigo-500" size={32} /> Temporal Timeline
            </h2>
            <div className="flex items-center gap-4">
              {selectedPosts.length > 0 && (
                <motion.button 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setShowBulkModal(true)}
                  className="px-8 py-3 bg-indigo-500 text-white rounded-full text-[12px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                >
                  Bulk Ops ({selectedPosts.length})
                </motion.button>
              )}
              <button 
                title="Settings"
                className="p-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/10 transition-all font-black uppercase text-[10px]"
              >
                <Settings size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-3xl border border-white/10">
            {['timeline', 'templates', 'recursion', 'sync'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {activeTab === 'timeline' && posts.map((post, i) => (
                <motion.div
                  key={post._id}
                  layout
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className={`${glassStyle} p-6 rounded-[3rem] group relative overflow-hidden flex items-center gap-8 ${selectedPosts.includes(post._id) ? 'border-indigo-500/50 bg-indigo-500/[0.02]' : ''}`}
                >
                  {/* Conflict Glow Effect */}
                  {post.status === 'failed' && <div className="absolute inset-0 bg-rose-500/5 pointer-events-none animate-pulse" />}
                  
                  <button 
                    onClick={() => toggleSelect(post._id)}
                    title={selectedPosts.includes(post._id) ? "Deselect post" : "Select post"}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedPosts.includes(post._id) ? 'bg-indigo-500 border-indigo-500' : 'border-white/10 bg-white/5'}`}
                  >
                    {selectedPosts.includes(post._id) && <CheckCircle size={14} aria-hidden="true" />}
                  </button>

                  <div className="w-20 font-black text-slate-500 italic tabular-nums text-right">
                    {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>

                  <div className="w-1 bg-white/10 h-12 rounded-full hidden md:block" />

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-black uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full border border-white/10 text-indigo-400 italic">
                        {post.platform.toUpperCase()}
                      </span>
                      {post.status === 'failed' && (
                        <span className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase italic">
                          <AlertTriangle size={12} /> Signal Conflict
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold truncate pr-10 italic tracking-tight">{post.content.text || 'Payload Artifact'}</h3>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black uppercase text-slate-600 italic tracking-widest">Trajectory Date</p>
                      <p className="text-[13px] font-black uppercase italic">{new Date(post.scheduledTime).toLocaleDateString()}</p>
                    </div>
                    <button 
                      title="View Details"
                      className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center hover:bg-indigo-500/20 transition-all text-slate-500 hover:text-white"
                    >
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {templates.length === 0 ? (
                    <div className="col-span-full py-20 text-center opacity-30 italic uppercase tracking-[0.5em] text-[12px] font-black">No active templates found</div>
                  ) : (
                    templates.map((tpl, i) => (
                      <motion.div
                        key={tpl._id}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className={`${glassStyle} p-8 rounded-[4rem] group hover:bg-white/[0.05] relative overflow-hidden`}
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.05]"><Archive size={80}/></div>
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2">{tpl.name}</h4>
                        <p className="text-slate-500 text-[12px] uppercase font-bold tracking-widest mb-6">{tpl.platforms?.join(' + ')}</p>
                        <div className="flex items-center justify-between mt-8">
                           <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">{tpl.usageCount} Deployments</span>
                           <button className="px-6 py-2 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all">Apply Pattern</button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

                  {activeTab === 'recursion' && (
                    <div className="space-y-8">
                       <div className={`${glassStyle} p-12 rounded-[5rem] bg-indigo-500/5 border-indigo-500/20`}>
                          <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-6">Active Recursion Assigns</h3>
                          <div className="space-y-4">
                             {analytics?.byStatus?.active > 0 ? (
                               <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
                                  <div className="flex items-center gap-6">
                                     <RefreshCw className="text-indigo-400 animate-spin-slow" size={24} />
                                     <div>
                                        <p className="font-bold italic uppercase tracking-tight">Daily Diffusion Pattern</p>
                                        <p className="text-[10px] text-slate-500 font-black uppercase">Next Execution: T-Minus 4h</p>
                                     </div>
                                  </div>
                                  <button className="px-6 py-2 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all">Suspend</button>
                               </div>
                             ) : (
                               <div className="py-12 text-center opacity-30 italic uppercase tracking-[0.5em] text-[12px] font-black">No active recursions</div>
                             )}
                          </div>
                       </div>
                       
                       <button className="w-full py-8 rounded-[3rem] border-2 border-dashed border-white/10 text-slate-500 hover:border-indigo-500 hover:text-white transition-all flex flex-col items-center gap-4 group">
                          <Plus size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                          <span className="text-[11px] font-black uppercase tracking-[0.4em]">Initialize New Recursion Loop</span>
                       </button>
                    </div>
                  )}

                  {activeTab === 'sync' && (
                <div className="space-y-12">
                   <div className={`${glassStyle} p-12 rounded-[5rem] bg-gradient-to-br from-indigo-500/10 to-transparent`}>
                      <div className="flex items-center gap-8 mb-12">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-white/[0.05] border border-white/10 flex items-center justify-center">
                          <LinkIcon size={32} className="text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-3xl font-black italic uppercase tracking-tighter">Private iCal Feed</h3>
                          <p className="text-slate-400 text-[13px] font-medium italic">Subscribe from Google Calendar, Outlook, or Apple Calendar.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-black/40 p-6 rounded-[2.5rem] border border-white/5">
                        <code className="flex-1 text-[11px] text-indigo-300 truncate font-mono bg-transparent outline-none border-none">
                          {user?.calendarSecret ? `https://api.click.app/scheduler/calendar/feed/${user.calendarSecret}.ics` : 'Synchronizing credentials...'}
                        </code>
                        <button 
                          onClick={() => {
                            if (user?.calendarSecret) {
                              navigator.clipboard.writeText(`https://api.click.app/scheduler/calendar/feed/${user.calendarSecret}.ics`);
                              alert('FEED_URL_COPIED');
                            }
                          }}
                          title="Copy Feed URL"
                          className="p-4 bg-white/[0.05] hover:bg-indigo-500 rounded-2xl transition-all"
                        >
                          <Copy size={18} aria-hidden="true" />
                        </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button className={`${glassStyle} p-10 rounded-[4rem] flex flex-col items-center text-center gap-6 hover:bg-white/[0.05]`}>
                         <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
                            <Globe size={24} className="text-emerald-400" />
                         </div>
                         <div>
                            <p className="text-[14px] font-black italic uppercase mb-1">Google Direct Sync</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">OAuth 2.0 Integration</p>
                         </div>
                      </button>
                      <button className={`${glassStyle} p-10 rounded-[4rem] flex flex-col items-center text-center gap-6 hover:bg-white/[0.05]`}>
                         <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
                            <Archive size={24} className="text-indigo-400" />
                         </div>
                         <div>
                            <p className="text-[14px] font-black italic uppercase mb-1">Export Static Snapshot</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">JSON / CSV Archive</p>
                         </div>
                      </button>
                   </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-12">
          {/* Recursion Engine */}
          <div className={`${glassStyle} p-8 rounded-[4rem] relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.03] to-transparent`}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><RefreshCw size={150} /></div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-4">
              <Sparkle className="text-indigo-400" size={24} /> Recursion Engine
            </h3>
            <p className="text-slate-400 text-[13px] italic mb-8 leading-relaxed font-medium">Automate content diffusion patterns across high-impact temporal windows.</p>
            <button className="w-full py-4 bg-white text-black rounded-[2rem] text-[13px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-indigo-500 hover:text-white transition-all duration-700 italic group">
              <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Sync Recursion
            </button>
          </div>

          {/* AI Optimization Card */}
          <div className={`${glassStyle} p-8 rounded-[4rem] relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.03] to-transparent`}>
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] -rotate-12"><Zap size={150} /></div>
             <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-4">
              <Target className="text-emerald-400" size={24} /> Optimization
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Signal Overlap Detection', status: 'ACTIVE', color: 'text-emerald-400' },
                { label: 'Peak Variance Modeling', status: 'OPTIMIZING', color: 'text-indigo-400' },
                { label: 'Audience Stratum Sync', status: 'STANDBY', color: 'text-slate-500' }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-3xl">
                  <span className="text-[11px] font-black text-slate-400 uppercase italic">{item.label}</span>
                  <span className={`text-[10px] font-black uppercase italic ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Ops Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className={`${glassStyle} w-full max-w-xl p-12 rounded-[5rem] bg-black/90 relative`}
             >
                <button onClick={() => setShowBulkModal(false)} className="absolute top-10 right-10 p-4 hover:bg-white/10 rounded-full transition-all text-slate-500 hover:text-white"><XCircle size={32}/></button>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4">Bulk Ops</h2>
                <p className="text-[14px] font-black text-slate-500 uppercase tracking-widest italic mb-12">Shifting {selectedPosts.length} selected trajectories in temporal space.</p>
                
                <div className="grid grid-cols-2 gap-6 mb-12">
                   {[
                     { label: '+1 Hour', ms: 3600000 },
                     { label: '+6 Hours', ms: 21600000 },
                     { label: '+1 Day', ms: 86400000 },
                     { label: '+1 Week', ms: 604800000 },
                   ].map(opt => (
                     <button 
                       key={opt.label}
                       onClick={() => handleBulkReschedule(opt.ms)}
                       className="py-6 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/5 text-[15px] font-black uppercase italic tracking-widest hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all group flex items-center justify-center gap-4"
                     >
                        {opt.label} <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                     </button>
                   ))}
                </div>

                <div className="p-8 bg-rose-500/5 border border-rose-500/20 rounded-3xl flex items-start gap-6">
                  <AlertTriangle className="text-rose-400 mt-1" size={24} />
                  <p className="text-[12px] font-black text-slate-400 uppercase italic leading-relaxed">WARNING: Bulk temporal shifts may introduce new signal conflicts. AI auto-resolution will attempt to mitigate during sync.</p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
