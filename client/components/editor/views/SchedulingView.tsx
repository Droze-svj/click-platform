'use client'

import React, { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Globe,
  Target,
  Radio,
  BarChart3,
  MessageSquare,
  Layers,
  Activity,
  ArrowUpRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiGet } from '../../../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

interface SchedulingViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const SchedulingView: React.FC<SchedulingViewProps> = ({ showToast }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const fetchScheduledPosts = async () => {
    try {
      setIsLoading(true)
      await apiGet('/oauth/accounts')

      // Clinical Mock Data for the V3 Elite Pro Scheduling
      setScheduledPosts([
        { id: '1', date: new Date(), platform: 'tiktok', title: 'AI Automation Hook', status: 'ready', time: '18:00' },
        { id: '2', date: new Date(), platform: 'youtube', title: 'V3 Platform Deepdive', status: 'draft', time: '19:30' },
        { id: '3', date: new Date(Date.now() + 86400000), platform: 'instagram', title: 'Neon Text Reveal', status: 'ready', time: '12:00' }
      ])
    } catch (error) {
      console.error('Failed to fetch schedule', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchScheduledPosts()
  }, [currentMonth])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const PLATFORM_COLORS: any = {
    tiktok: 'bg-pink-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    youtube: 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]',
    instagram: 'bg-gradient-to-tr from-purple-500 to-orange-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    twitter: 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="space-y-10 h-full flex flex-col pb-10 max-w-[1600px] mx-auto">
      {/* Elite Header Control Cluster */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.4em] italic text-indigo-400 shadow-xl">
            <BarChart3 className="w-4 h-4 animate-pulse" />
            Chrono Management
          </div>
          <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
            NEURAL<br />MATRIX
          </h1>
          <p className="text-slate-500 text-xl font-medium tracking-tight italic">
            Clinical distribution trajectory and strategic <span className="text-white font-black">mission calendar</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className={`${glassStyle} rounded-[40px] p-2 flex items-center shadow-3xl`}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              title="Previous Month"
              className="p-4 hover:bg-white/5 rounded-[2rem] transition-all text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
            <div className="px-8 py-4 text-xs font-black uppercase text-white tracking-[0.4em] min-w-[200px] text-center italic">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              title="Next Month"
              className="p-4 hover:bg-white/5 rounded-[2rem] transition-all text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setSwarmHUDTask('Initialize New Neural Mission')
              setShowSwarmHUD(true)
            }}
            title="Create New Blast"
            className="flex items-center gap-4 px-10 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.4em] italic shadow-3xl shadow-indigo-600/40 border border-white/20"
          >
            <Plus className="w-5 h-5 shadow-inner" />
            New Blast
          </motion.button>
        </div>
      </div>

      {/* Matrix Grid (Elite) */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`flex-1 ${glassStyle} rounded-[4rem] p-12 overflow-hidden flex flex-col shadow-3xl relative`}
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <CalendarIcon className="w-64 h-64 text-slate-500" />
        </div>

        <div className="grid grid-cols-7 gap-6 mb-8 relative z-10">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-black uppercase text-slate-600 tracking-[0.5em] italic">{d}</div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 gap-4 custom-scrollbar overflow-y-auto pr-4 relative z-10">
          {days.map((day, i) => {
            const dayPosts = scheduledPosts.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            const isTodayActive = isToday(day)

            return (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                className={`min-h-[160px] p-6 rounded-[2.5rem] border transition-all duration-500 relative group ${isTodayActive ? 'bg-white/10 border-indigo-500/40 shadow-3xl shadow-indigo-500/10' : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <span className={`text-xl font-black italic ${isTodayActive ? 'text-indigo-400' : 'text-slate-700 group-hover:text-slate-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,1)]" />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {dayPosts.map(post => (
                    <motion.div
                      key={post.id}
                      whileHover={{ x: 4 }}
                      className="p-3 bg-black/40 border border-white/5 rounded-[1.2rem] group/post cursor-pointer hover:border-indigo-500/30 transition-all shadow-xl"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <h4 className="text-xs font-black uppercase text-white tracking-widest italic">{post.title}</h4>
                          </div>
                          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                            <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-emerald-500" /> {post.platform}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-500" /> {post.time}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              setSwarmHUDTask(`Optimizing: ${post.title}`)
                              setShowSwarmHUD(true)
                            }}
                            title="Optimize Post" 
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                          >
                            Optimize
                          </button>
                          <button title="Share Post" className="p-3 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-xl transition-all"><Share2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {dayPosts.length === 0 && (
                    <div className="h-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-6 h-6 text-slate-800" />
                    </div>
                  )}
                </div>

                {isTodayActive && (
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">Current Cycle</span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Intelligence Grid (Elite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Neural Strategic Cluster */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className={`lg:col-span-5 ${glassStyle} rounded-[4rem] p-10 flex flex-col justify-between relative overflow-hidden group shadow-3xl`}
        >
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
            <Target className="w-40 h-40 text-indigo-500" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-6 mb-8">
              <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                <MessageSquare className="w-6 h-6 text-indigo-400" />
              </div>
              <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">STRATEGY<br />FORECAST</h4>
            </div>
            <p className="text-lg text-slate-400 font-medium leading-relaxed italic pr-10">
              Engagement telemetry suggests optimal window: <span className="text-white font-black italic underline decoration-indigo-500/30">18:00 — 20:00</span> for synchronized TikTok nodes.
            </p>
          </div>

          <div className="mt-12 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <Globe className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest italic">Global Synthesis</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic">Across 4 Identity Zones</p>
              </div>
            </div>
            <BarChart3 className="w-8 h-8 text-slate-800 group-hover:text-indigo-500 transition-colors" />
          </div>
        </motion.div>

        {/* Social Push Metadata Matrix */}
        <div className={`lg:col-span-7 ${glassStyle} rounded-[4rem] p-10 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe className="w-40 h-40 text-emerald-500" />
            </div>

            <div className="flex items-center gap-6 mb-12 relative z-10">
                <div className="p-4 rounded-[1.2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-xl">
                    <Target className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                   <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none uppercase">Social Push Matrix</h2>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block italic">Neural Metadata Injection</span>
                </div>
            </div>

            <div className="space-y-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Viral Title / Caption</label>
                            <input type="text" placeholder="The strategy that changed everything..." title="Viral Title" className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 transition-all placeholder-slate-800" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Description / First Comment</label>
                            <textarea rows={4} placeholder="Check the link in bio for more insight..." title="Description" className="w-full bg-black/40 border border-white/5 rounded-[2rem] px-6 py-4 text-xs font-medium text-slate-300 outline-none focus:border-emerald-500/50 transition-all placeholder-slate-800 resize-none" />
                        </div>
                    </div>
                    <div className="space-y-10">
                        <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Neural Tags (Platform optimized)</label>
                            <div className="flex flex-wrap gap-2">
                                {['#viral', '#growth', '#ai', '#creative', '#edit'].map(t => (
                                    <span key={t} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 italic">
                                        {t}
                                    </span>
                                ))}
                                <button title="Add New Tag" className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-slate-500 hover:text-white transition-all">+ Add Tag</button>
                            </div>
                        </div>

                        <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Forecasted Engagement</span>
                                <span className="text-xl font-black text-white italic tracking-tighter">84% Optimal</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 w-[84%] shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                            </div>
                            <p className="text-[10px] text-slate-600 font-medium italic">Peak posting window in 2 hours for current timezone clusters.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex justify-end">
                    <button 
                        onClick={() => {
                          setSwarmHUDTask('Neural Metadata Injection Launch')
                          setShowSwarmHUD(true)
                        }}
                        title="Commence Broadcast" 
                        className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                    >
                        <Radio className="w-5 h-5 animate-pulse" />
                        Commence Broadcast
                    </button>
                </div>
            </div>
        </div>

        {/* Tactical Production Pipeline */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className={`lg:col-span-7 ${glassStyle} rounded-[4rem] p-10 shadow-3xl relative overflow-hidden group`}
        >
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Layers className="w-48 h-48 text-indigo-500" />
          </div>

          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-[1.2rem] bg-orange-500/10 border border-orange-500/20">
                <Activity className="w-6 h-6 text-orange-400" />
              </div>
              <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">TACTICAL<br />PIPELINE</h4>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,1)]" />
              <span className="px-6 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic shadow-lg">3 Nodes Pending</span>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            {[
              { l: '4K Render: AI Workflow Alpha', p: 85, s: 'Active Rendering', icon: Radio },
              { l: 'Subtitles: Viral Quotes Synth', p: 40, s: 'Chrono Processing', icon: Activity }
            ].map((job, idx) => (
              <motion.div
                key={job.l}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="p-6 bg-black/40 border border-white/5 rounded-[2.5rem] flex items-center justify-between group/job hover:border-white/10 transition-all shadow-xl"
              >
                <div className="flex items-center gap-8 flex-1">
                  <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-700 uppercase italic shadow-inner group-hover:scale-110 transition-transform">
                    {idx === 0 ? <Radio className="w-6 h-6 text-indigo-500" /> : <Layers className="w-6 h-6 text-orange-400" />}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-black text-white italic uppercase tracking-tighter">{job.l}</p>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">{job.s}</p>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${job.p}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      />
                    </div>
                  </div>
                </div>
                <div className="ml-10 text-right space-y-1">
                  <p className="text-3xl font-black text-white italic tabular-nums leading-none">{job.p}<span className="text-sm not-italic opacity-40">%</span></p>
                  <div className="flex items-center justify-end gap-2 text-slate-700">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Live Uplink</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default SchedulingView
