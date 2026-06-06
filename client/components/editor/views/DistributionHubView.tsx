'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Radio,
  Share2,
  Calendar,
  Zap,
  Target,
  BarChart3,
  CheckCircle2,
  Clock,
  Plus,
  Link2,
  AlertCircle,
  Loader2,
  Youtube,
  Instagram,
  Smartphone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiGet, apiPost } from '../../../lib/api'

interface DistributionHubViewProps {
  videoId: string
  videoUrl: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

// Platforms this hub can publish to. The `endpoint`/`buildPayload` fields mirror
// ExportView.handlePublish EXACTLY so behaviour stays consistent across views.
const PLATFORMS = [
  { id: 'tiktok', label: 'TIKTOK', icon: Smartphone, c: 'text-rose-500', bg: 'bg-rose-500/5', b: 'border-rose-500/20' },
  { id: 'instagram', label: 'INSTAGRAM', icon: Instagram, c: 'text-fuchsia-500', bg: 'bg-fuchsia-500/5', b: 'border-fuchsia-500/20' },
  { id: 'youtube', label: 'YOUTUBE', icon: Youtube, c: 'text-red-500', bg: 'bg-red-500/5', b: 'border-red-500/20' },
] as const

type PlatformId = typeof PLATFORMS[number]['id']

interface OptimalTime { start: number; end: number; label: string }

const DistributionHubView: React.FC<DistributionHubViewProps> = ({ videoId, videoUrl, showToast }) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'schedule' | 'platforms'>('matrix')
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  // Real connection state, keyed by platform id.
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  // Matrix metadata + target selection (publish only to selected & connected).
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([])

  // Real "optimal times" from /social/optimal-times (no fabrication).
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([])
  const [optimalTimezone, setOptimalTimezone] = useState<string>('UTC')

  // Schedule tab state.
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  // Only http(s) URLs are publishable (blob:/relative/empty are not reachable).
  const isPublishable = /^https?:\/\//i.test(videoUrl || '')

  const fetchConnectedAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true)
      const data = await apiGet<{ success?: boolean; accounts?: Record<string, any[]> }>('/oauth/accounts')
      const accts = data?.accounts || {}
      const map: Record<string, boolean> = {}
      for (const p of PLATFORMS) {
        map[p.id] = Array.isArray(accts[p.id]) && accts[p.id].length > 0
      }
      setConnected(map)
    } catch (error) {
      console.error('Failed to fetch connected accounts', error)
      setConnected({})
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  const fetchOptimalTimes = useCallback(async () => {
    // Use the first connected platform (fallback tiktok) as the basis for
    // the real optimal-times query. If it errors, we show nothing — never fake.
    try {
      const basis = PLATFORMS.find(p => connected[p.id])?.id || 'tiktok'
      const res = await apiGet<{ success?: boolean; data?: { optimalTimes?: OptimalTime[]; timezone?: string } }>(
        `/social/optimal-times?platform=${encodeURIComponent(basis)}`
      )
      const times = res?.data?.optimalTimes
      setOptimalTimes(Array.isArray(times) ? times : [])
      if (res?.data?.timezone) setOptimalTimezone(res.data.timezone)
    } catch (error) {
      console.error('Failed to fetch optimal times', error)
      setOptimalTimes([])
    }
  }, [connected])

  useEffect(() => {
    fetchConnectedAccounts()
  }, [fetchConnectedAccounts])

  // Refetch optimal times once we know which platforms are connected.
  useEffect(() => {
    if (!isLoadingAccounts) fetchOptimalTimes()
  }, [isLoadingAccounts, fetchOptimalTimes])

  const togglePlatform = (id: PlatformId) => {
    if (!connected[id]) return // can't target an unconnected platform
    setSelectedPlatforms(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]))
  }

  const connectedCount = PLATFORMS.filter(p => connected[p.id]).length

  const formatHour = (h: number) => {
    const hr = ((h % 24) + 24) % 24
    const period = hr < 12 ? 'AM' : 'PM'
    const display = hr % 12 === 0 ? 12 : hr % 12
    return `${display}${period}`
  }

  // ---- PUBLISH (matrix) — mirrors ExportView.handlePublish exactly ----
  const handleBroadcast = async () => {
    const targets = selectedPlatforms.filter(p => connected[p])
    if (targets.length === 0) {
      showToast('Select at least one connected platform', 'error')
      return
    }
    if (!isPublishable) {
      showToast(
        videoUrl
          ? 'Export URL is not publicly reachable yet — re-render with cloud storage enabled.'
          : 'Render the video first before broadcasting',
        'error'
      )
      return
    }

    setSwarmHUDTask('Commence Global Neural Broadcast')
    setShowSwarmHUD(true)
    setIsSyncing(true)

    try {
      showToast(`Broadcasting to ${targets.length} platform(s)...`, 'info')

      const results = await Promise.allSettled(
        targets.map(platform => {
          const payload: any = {}
          let endpoint = `/oauth/${platform}/upload`

          if (platform === 'youtube') {
            payload.videoFile = videoUrl
            payload.title = title || 'Rendered with Neural Master'
            payload.description = description || 'Published from Click Video Editor'
          } else if (platform === 'instagram') {
            endpoint = `/oauth/${platform}/post`
            payload.imageUrl = videoUrl
            payload.caption = title || 'Rendered with Neural Master'
          } else {
            payload.videoFile = videoUrl
            payload.caption = title || 'Rendered with Neural Master'
          }

          return apiPost(endpoint, payload)
        })
      )

      const failures = results.filter(r => r.status === 'rejected').length
      if (failures === 0) {
        showToast('Neural Broadcast Complete! Content live on selected platforms.', 'success')
        setSelectedPlatforms([])
      } else if (failures < targets.length) {
        showToast(`Broadcast partial: ${targets.length - failures}/${targets.length} platforms succeeded.`, 'info')
      } else {
        showToast('Broadcast failed. Check connection matrices.', 'error')
      }
    } catch (error) {
      console.error('Broadcasting failed', error)
      showToast('Broadcast partial failure. Check connection matrices.', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // ---- SCHEDULE — real POST /scheduler/schedule ----
  const handleSchedule = async () => {
    const targets = selectedPlatforms.filter(p => connected[p])
    if (targets.length === 0) {
      showToast('Select at least one connected platform on the PUSH_MATRIX tab', 'error')
      return
    }
    if (!scheduleTime) {
      showToast('Pick a date & time to schedule', 'error')
      return
    }
    const when = new Date(scheduleTime)
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      showToast('Choose a valid future date & time', 'error')
      return
    }
    if (!isPublishable && !title.trim() && !description.trim()) {
      showToast('Add a title/description or render a reachable video first', 'error')
      return
    }

    try {
      setIsScheduling(true)
      const results = await Promise.allSettled(
        targets.map(platform =>
          apiPost('/scheduler/schedule', {
            contentId: videoId || null,
            platform,
            scheduledTime: when.toISOString(),
            mediaUrl: isPublishable ? videoUrl : '',
            content: {
              text: description || title || 'Published from Click Video Editor',
            },
          })
        )
      )
      const failures = results.filter(r => r.status === 'rejected').length
      if (failures === 0) {
        showToast(`Scheduled to ${targets.length} platform(s) for ${when.toLocaleString()}`, 'success')
        setScheduleTime('')
      } else if (failures < targets.length) {
        showToast(`Scheduled ${targets.length - failures}/${targets.length} platforms.`, 'info')
      } else {
        showToast('Scheduling failed. Verify connected accounts.', 'error')
      }
    } catch (error) {
      console.error('Scheduling failed', error)
      showToast('Scheduling failed. Verify connected accounts.', 'error')
    } finally {
      setIsScheduling(false)
    }
  }

  return (
    <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-2 sm:p-0">
      {/* Elite Control Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
        <div className="space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/5 border-2 border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 italic shadow-inner">
                <Globe className="w-4 h-4 animate-pulse" />
                {isLoadingAccounts
                  ? 'SCANNING_TOPOLOGY…'
                  : `${connectedCount}/${PLATFORMS.length}_NODES_CONNECTED`}
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tight uppercase leading-none drop-shadow-2xl">
                DISTRIBUTION_<br className="hidden sm:block" />HUB
            </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3 p-2 bg-black/40 border-2 border-white/5 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
            {[
                { id: 'matrix', label: 'PUSH_MATRIX', icon: Target },
                { id: 'schedule', label: 'CHRONO_CORE', icon: Calendar },
                { id: 'platforms', label: 'NODE_CLUSTER', icon: Share2 }
            ].map(tab => (
                <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    title={tab.label}
                    className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all italic active:scale-95 ${
                        activeTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] border-none'
                        : 'text-slate-500 hover:text-white hover:bg-white/5 border-2 border-transparent'
                    }`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Social Push Metadata Matrix */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000">
                    <Globe className="w-64 h-64 text-emerald-500" />
                </div>

                <div className="flex items-center justify-between mb-12 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <Target className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter leading-none uppercase">SOCIAL_PUSH_MATRIX</h4>
                          <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.4em] mt-2 block italic">NEURAL_METADATA_INJECTION</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-14 relative z-10">
                    <div className="lg:col-span-7 space-y-10">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">VIRAL_MANIFEST_TITLE</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="THE_STRATEGY_THAT_CHANGED_EVERYTHING…"
                                title="Viral Title"
                                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-8 py-5 text-sm font-black text-white outline-none focus:border-emerald-500/40 transition-all placeholder-slate-800 uppercase italic shadow-inner"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">NEURAL_DESCRIPTION_BLOCK</label>
                            <textarea
                                rows={6}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="CHECK_THE_LINK_IN_BIO_FOR_MORE_INSIGHT…"
                                title="Description"
                                className="w-full bg-black/40 border-2 border-white/5 rounded-[2.5rem] px-8 py-6 text-sm font-medium text-slate-300 outline-none focus:border-emerald-500/40 transition-all placeholder-slate-800 resize-none shadow-inner leading-relaxed"
                            />
                        </div>

                        {/* Real platform target selection — only connected platforms are selectable */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">BROADCAST_TARGETS</label>
                            <div className="flex flex-wrap gap-3">
                                {PLATFORMS.map(p => {
                                    const isConn = !!connected[p.id]
                                    const isSel = selectedPlatforms.includes(p.id)
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            disabled={!isConn || isLoadingAccounts}
                                            onClick={() => togglePlatform(p.id)}
                                            title={isConn ? `Target ${p.label}` : `${p.label} not connected`}
                                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest italic border-2 transition-all ${
                                                !isConn
                                                  ? 'bg-black/40 border-white/5 text-slate-700 cursor-not-allowed opacity-50'
                                                  : isSel
                                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)]'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                            }`}
                                        >
                                            <p.icon className="w-4 h-4" />
                                            {p.label}
                                            {!isConn && <span className="text-[8px] opacity-70">(OFFLINE)</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-12">
                        {/* Real optimal posting windows from /social/optimal-times */}
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">OPTIMAL_POSTING_WINDOWS</label>
                            {optimalTimes.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {optimalTimes.map((w, i) => (
                                        <div key={i} className="px-5 py-4 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-2xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-emerald-400" />
                                                <span className="text-[11px] font-black text-white italic uppercase tracking-wider">
                                                    {formatHour(w.start)}–{formatHour(w.end)} {optimalTimezone}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest italic truncate ml-3">{w.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-5 py-6 bg-black/40 border-2 border-white/5 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest italic text-center">
                                    NO_OPTIMAL_WINDOW_DATA_AVAILABLE
                                </div>
                            )}
                        </div>

                        <div className="p-8 sm:p-10 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-[3rem] flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest italic">PUBLISH_READINESS</span>
                                    <p className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                                        {isPublishable ? 'VIDEO_READY' : 'AWAITING_RENDER'}
                                    </p>
                                </div>
                                <div className="p-5 bg-emerald-500 text-white rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                                    <BarChart3 className="w-7 h-7" />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-black italic leading-relaxed uppercase tracking-wider relative z-10">
                                {isPublishable
                                  ? `${selectedPlatforms.length}_TARGET(S)_SELECTED_OF_${connectedCount}_CONNECTED`
                                  : 'RENDER_TO_A_REACHABLE_URL_TO_ENABLE_BROADCAST'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-10 border-t-2 border-white/5 flex flex-col sm:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-5 text-slate-500 text-center sm:text-left">
                        <AlertCircle className="w-6 h-6 text-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">
                            {connectedCount === 0
                              ? 'NO_PLATFORMS_CONNECTED — LINK_AN_ACCOUNT_IN_NODE_CLUSTER'
                              : `${selectedPlatforms.length}_OF_${connectedCount}_CONNECTED_NODES_TARGETED`}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleBroadcast}
                        disabled={isSyncing || isLoadingAccounts || selectedPlatforms.length === 0 || !isPublishable}
                        title="Commence Broadcast"
                        className="w-full sm:w-auto px-16 py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] italic shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-5 relative overflow-hidden group/btn disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isSyncing
                          ? <Loader2 className="w-6 h-6 relative z-10 animate-spin" />
                          : <Radio className="w-6 h-6 relative z-10 group-hover:scale-125 transition-transform" />}
                        <span className="relative z-10">{isSyncing ? 'BROADCASTING…' : 'COMMENCE_BROADCAST'}</span>
                    </button>
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.5rem] bg-primary-500/10 border-2 border-primary-500/20 shadow-xl">
                            <Calendar className="w-7 h-7 text-primary-400" />
                        </div>
                        <div className="text-center sm:text-left">
                            <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter leading-none uppercase">CHRONO_CORE</h4>
                            <span className="text-[10px] font-black text-primary-400/60 uppercase tracking-[0.4em] mt-2 block italic">TEMPORAL_DISPATCH_QUEUE</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">DISPATCH_TIMESTAMP</label>
                            <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                title="Scheduled time"
                                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-8 py-5 text-sm font-black text-white outline-none focus:border-primary-500/40 transition-all italic shadow-inner [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">TARGET_NODES</label>
                            <div className="flex flex-wrap gap-3">
                                {selectedPlatforms.filter(p => connected[p]).length > 0 ? (
                                    selectedPlatforms.filter(p => connected[p]).map(pid => {
                                        const p = PLATFORMS.find(x => x.id === pid)!
                                        return (
                                            <span key={pid} className="flex items-center gap-2 px-5 py-2.5 bg-primary-500/5 border-2 border-primary-500/20 rounded-full text-[10px] font-black text-primary-400 italic uppercase">
                                                <p.icon className="w-3.5 h-3.5" />{p.label}
                                            </span>
                                        )
                                    })
                                ) : (
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">SELECT_TARGETS_ON_PUSH_MATRIX_TAB</span>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleSchedule}
                            disabled={isScheduling || isLoadingAccounts || selectedPlatforms.filter(p => connected[p]).length === 0 || !scheduleTime}
                            title="Schedule Dispatch"
                            className="w-full px-12 py-6 bg-primary-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] italic shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isScheduling
                              ? <Loader2 className="w-6 h-6 animate-spin" />
                              : <Plus className="w-6 h-6" />}
                            {isScheduling ? 'QUEUING…' : 'SCHEDULE_DISPATCH'}
                        </button>
                    </div>

                    <div className="space-y-5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">OPTIMAL_POSTING_WINDOWS</label>
                        {optimalTimes.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {optimalTimes.map((w, i) => (
                                    <div key={i} className="px-6 py-5 bg-primary-500/5 border-2 border-primary-500/20 rounded-[2rem] flex items-center justify-between shadow-inner">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-primary-400" />
                                            <span className="text-[12px] font-black text-white italic uppercase tracking-wider">
                                                {formatHour(w.start)}–{formatHour(w.end)} {optimalTimezone}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-black text-primary-400/70 uppercase tracking-widest italic truncate ml-3">{w.label}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-6 py-10 bg-black/40 border-2 border-white/5 rounded-[2rem] text-[10px] font-black text-slate-600 uppercase tracking-widest italic text-center">
                                NO_OPTIMAL_WINDOW_DATA_AVAILABLE
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'platforms' && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
             {/* Platform Connection Status (real) */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 space-y-10 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.5rem] bg-primary-500/10 border-2 border-primary-500/20 shadow-xl">
                    <Share2 className="w-7 h-7 text-primary-400" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">IDENTITY_<br />CLUSTERS</h4>
                </div>

                <div className="space-y-4">
                    {isLoadingAccounts ? (
                        <div className="p-10 flex items-center justify-center gap-4 text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">SCANNING_TOPOLOGY…</span>
                        </div>
                    ) : (
                        PLATFORMS.map(node => {
                            const isConn = !!connected[node.id]
                            return (
                                <div key={node.id} className="p-6 bg-black/40 border-2 border-white/5 rounded-3xl flex items-center justify-between group hover:border-white/20 transition-all shadow-inner">
                                    <div className="flex items-center gap-6">
                                        <div className={`p-4 ${node.bg} border-2 ${node.b} rounded-2xl ${node.c} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                                            <node.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-white italic tracking-tighter uppercase leading-none">{node.label}</p>
                                            <p className={`text-[10px] font-black mt-2 uppercase tracking-[0.2em] italic flex items-center gap-1.5 ${isConn ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {isConn
                                                  ? <><CheckCircle2 className="w-3 h-3" /> CONNECTED</>
                                                  : <><Link2 className="w-3 h-3" /> NOT_CONNECTED</>}
                                            </p>
                                        </div>
                                    </div>
                                    {isConn ? (
                                        <span className="px-6 py-2.5 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase italic">ACTIVE</span>
                                    ) : (
                                        <a
                                            href="/dashboard/social"
                                            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border-2 border-white/5 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase italic"
                                        >
                                            CONNECT
                                        </a>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Connection Summary (real, derived from /oauth/accounts) */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 space-y-10 relative overflow-hidden group shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 shadow-xl">
                        <Zap className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">UPLINK_<br />STATUS</h4>
                </div>

                <div className="p-8 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-[2.5rem] flex flex-col gap-6 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">CONNECTED_NODES</span>
                        <span className="text-[11px] font-black text-white italic uppercase tracking-widest">
                            {isLoadingAccounts ? '—' : `${connectedCount} / ${PLATFORMS.length}`}
                        </span>
                    </div>
                    {/* Real per-platform connection bars (1 = connected, dim = not) — no random data */}
                    <div className="flex gap-2">
                        {PLATFORMS.map(p => (
                            <div
                                key={p.id}
                                title={`${p.label}: ${connected[p.id] ? 'connected' : 'not connected'}`}
                                className={`h-6 flex-1 rounded-full transition-colors ${
                                    connected[p.id]
                                      ? 'bg-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                      : 'bg-white/5'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {PLATFORMS.map(p => (
                        <div key={p.id} className={`p-5 bg-black/40 border-2 rounded-[2rem] flex items-center justify-between shadow-inner ${connected[p.id] ? 'border-emerald-500/20' : 'border-white/5'}`}>
                            <span className="flex items-center gap-3 text-[11px] font-black text-white italic uppercase tracking-[0.25em]">
                                <p.icon className={`w-4 h-4 ${p.c}`} />{p.label}
                            </span>
                            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border-2 uppercase tracking-widest italic shadow-sm ${
                                connected[p.id]
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                                  : 'bg-slate-500/5 border-slate-500/20 text-slate-500'
                            }`}>
                                {isLoadingAccounts ? 'SCANNING' : connected[p.id] ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default DistributionHubView
