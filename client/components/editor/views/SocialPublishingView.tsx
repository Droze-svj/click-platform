import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Share2, Youtube, Twitter, Instagram, Send, Sparkles, 
  Clock, AlertCircle, CheckCircle2, ChevronRight, 
  Repeat, Calendar, Info, Smartphone, Play, Image as ImageIcon
} from 'lucide-react'
import { apiPost } from '../../../lib/api'

interface SocialPublishingViewProps {
  videoUrl: string
  duration: number
  transcript: string
  niche?: string
  onClose: () => void
  complianceResult?: any
}

interface PlatformState {
  enabled: boolean
  title: string
  description: string
  tags: string[]
  scheduledAt: string | null
  loading?: boolean
  error?: string
  success?: boolean
}

const PLATFORM_LIMITS = {
  tiktok: { maxDuration: 600, label: 'TikTok (Max 10m)' },
  youtube: { maxDuration: 60, label: 'YouTube Shorts (Max 60s)' },
  twitter: { maxDuration: 140, label: 'X/Twitter (Max 2m20s)' }
}

export const SocialPublishingView: React.FC<SocialPublishingViewProps> = ({
  videoUrl,
  duration,
  transcript,
  niche = 'General',
  onClose,
  complianceResult
}) => {
  const [platforms, setPlatforms] = useState<Record<string, PlatformState>>({
    tiktok: { enabled: true, title: '', description: '', tags: [], scheduledAt: null },
    youtube: { enabled: true, title: '', description: '', tags: [], scheduledAt: null },
    twitter: { enabled: false, title: '', description: '', tags: [], scheduledAt: null }
  })

  const [recursiveReach, setRecursiveReach] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const isComplianceFailed = complianceResult?.status === 'failed' || complianceResult?.approved === false

  // Neural Compliance Guard
  const getValidationErrors = (platform: string) => {
    const limits = PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS]
    if (!limits) return null
    if (duration > limits.maxDuration) {
      return `Video duration (${Math.round(duration)}s) exceeds ${limits.label} limit.`
    }
    return null
  }

  const handleAiForge = async () => {
    setIsGenerating(true)
    try {
      const response = await apiPost<any>('/social/generate-metadata', {
        transcript,
        niche,
        tone: 'energetic'
      })

      if (response.success && response.metadata) {
        const { metadata } = response
        setPlatforms(prev => ({
          ...prev,
          youtube: { ...prev.youtube, title: metadata.youtube.title, description: metadata.youtube.description, tags: metadata.youtube.tags },
          tiktok: { ...prev.tiktok, description: metadata.tiktok.caption, tags: metadata.tiktok.hashtags },
          twitter: { ...prev.twitter, description: metadata.twitter.text, tags: metadata.twitter.hashtags }
        }))
      }
    } catch (error) {
      console.error('Neural Forge Failure:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (isComplianceFailed) return

    setIsPublishing(true)
    const enabledPlatforms = Object.entries(platforms)
      .filter(([_, state]) => state.enabled)
      .map(([id]) => id)

    try {
      const response = await apiPost<any>('/social/publish', {
        platforms: enabledPlatforms,
        contentData: {
          title: platforms.youtube.title || 'New Video',
          description: platforms.youtube.description || platforms.tiktok.description,
          mediaUrl: videoUrl,
          tags: platforms.youtube.tags || platforms.tiktok.tags
        },
        recursiveReach
      })

      if (response.success) {
        // Handle results
        alert('Universal Distribution Initiated!')
        onClose()
      }
    } catch (error) {
      console.error('Distribution Failure:', error)
    } finally {
      setIsPublishing(false)
    }
  }

  const [scheduleOpenFor, setScheduleOpenFor] = useState<string | null>(null)

  const handleSchedule = async (platformId: string) => {
    const state = platforms[platformId]
    if (!state?.scheduledAt) {
      setPlatforms(prev => ({
        ...prev,
        [platformId]: { ...prev[platformId], error: 'Pick a date and time first.' }
      }))
      return
    }

    const when = new Date(state.scheduledAt)
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setPlatforms(prev => ({
        ...prev,
        [platformId]: { ...prev[platformId], error: 'Scheduled time must be in the future.' }
      }))
      return
    }

    setPlatforms(prev => ({
      ...prev,
      [platformId]: { ...prev[platformId], loading: true, error: undefined, success: undefined }
    }))

    try {
      const response = await apiPost<any>('/scheduler/schedule', {
        platform: platformId,
        content: state.description || state.title || '',
        scheduledTime: when.toISOString(),
        mediaUrl: videoUrl,
        hashtags: state.tags || []
      })

      const ok = response && (response.success !== false)
      setPlatforms(prev => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          loading: false,
          success: ok,
          error: ok ? undefined : (response?.error || 'Failed to schedule post.')
        }
      }))
      if (ok) setScheduleOpenFor(null)
    } catch (error: any) {
      setPlatforms(prev => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          loading: false,
          error: error?.message || 'Failed to schedule post.'
        }
      }))
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#050510] text-white p-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Share2 className="w-6 h-6 text-blue-500" />
            Social Publishing Hub
          </h2>
          <p className="text-sm text-gray-400 mt-1">Unified Distribution & Neural Metadata</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAiForge}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Forging...' : 'One-Click AI Forge'}
        </motion.button>
      </div>

      {isComplianceFailed && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-1">Compliance Guard Active</h4>
            <p className="text-xs text-red-400/80 leading-relaxed">
              Our safety engine detected potential violations (profanity, malicious links, or brand safety risks).
              Publishing is disabled until these issues are resolved in the editor.
            </p>
          </div>
        </div>
      )}

      {/* Platform Selection & Config */}
      <div className="space-y-6">
        {Object.entries(platforms).map(([id, state]) => (
          <div 
            key={id} 
            className={`p-5 rounded-2xl border transition-all duration-300 ${
              state.enabled ? 'bg-white/5 border-blue-500/30' : 'bg-white/[0.02] border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  id === 'youtube' ? 'bg-red-500/20 text-red-500' :
                  id === 'tiktok' ? 'bg-pink-500/20 text-pink-500' :
                  'bg-blue-400/20 text-blue-400'
                }`}>
                  {id === 'youtube' && <Youtube className="w-5 h-5" />}
                  {id === 'tiktok' && <Smartphone className="w-5 h-5" />}
                  {id === 'twitter' && <Twitter className="w-5 h-5" />}
                </div>
                <span className="font-bold capitalize">{id}</span>
              </div>
              <input 
                type="checkbox" 
                checked={state.enabled}
                onChange={(e) => setPlatforms(prev => ({ 
                  ...prev, 
                  [id]: { ...prev[id], enabled: e.target.checked }
                }))}
                className="w-5 h-5 rounded-md border-white/20 bg-transparent text-blue-500 focus:ring-blue-500"
              />
            </div>

            {state.enabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                {/* Compliance Guard */}
                {getValidationErrors(id) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-400 font-medium leading-tight">
                      {getValidationErrors(id)}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Caption / Description</label>
                  <textarea 
                    value={state.description}
                    onChange={(e) => setPlatforms(prev => ({
                      ...prev,
                      [id]: { ...prev[id], description: e.target.value }
                    }))}
                    placeholder={`Write your ${id} post...`}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none transition-all h-24 custom-scrollbar"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setScheduleOpenFor(scheduleOpenFor === id ? null : id)}
                    disabled={!!getValidationErrors(id) || isComplianceFailed}
                    className="flex-1 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {scheduleOpenFor === id ? 'Hide schedule' : 'Schedule Post'}
                  </button>
                  <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all">
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                {scheduleOpenFor === id && (
                  <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <label htmlFor={`schedule-${id}`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">When to post</label>
                    <input
                      id={`schedule-${id}`}
                      type="datetime-local"
                      aria-label={`Schedule time for ${id}`}
                      value={state.scheduledAt || ''}
                      onChange={(e) => setPlatforms(prev => ({
                        ...prev,
                        [id]: { ...prev[id], scheduledAt: e.target.value || null, error: undefined, success: undefined }
                      }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSchedule(id)}
                        disabled={state.loading || !state.scheduledAt}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {state.loading ? 'Scheduling...' : 'Confirm schedule'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlatforms(prev => ({
                            ...prev,
                            [id]: { ...prev[id], scheduledAt: null, error: undefined, success: undefined }
                          }))
                          setScheduleOpenFor(null)
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                    {state.error && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> {state.error}
                      </p>
                    )}
                    {state.success && (
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" /> Scheduled.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Recursive Reach Toggle */}
      <div className="mt-8 p-5 bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-blue-500/30 rounded-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Repeat className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Recursive Reach</h4>
              <p className="text-[10px] text-blue-300/70">Auto-repost sequence (+24h delay)</p>
            </div>
          </div>
          <button 
            onClick={() => setRecursiveReach(!recursiveReach)}
            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${
              recursiveReach ? 'bg-blue-500' : 'bg-white/10'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-all ${
              recursiveReach ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
        <p className="text-xs text-blue-200/60 leading-relaxed italic">
          "The Shadow Scheduler will automatically handle distribution to other channels 24 hours after the initial wave."
        </p>
      </div>

      {/* Action Footer */}
      <div className="mt-auto pt-8 flex gap-4">
        <button 
          onClick={onClose}
          className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={handlePublish}
          disabled={isPublishing || isComplianceFailed || Object.values(platforms).every(p => !p.enabled)}
          className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPublishing ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Send className="w-5 h-5" />
            </motion.div>
          ) : (
            <Send className="w-5 h-5" />
          )}
          {isPublishing ? 'Distributing...' : 'Unified Distribution'}
        </button>
      </div>
    </div>
  )
}
