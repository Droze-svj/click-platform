'use client'

import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Zap,
  Twitter,
  Video as TikTokIcon,
  Youtube,
  Instagram,
  Link as LinkIcon,
  X,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Globe,
  Fingerprint,
  Cpu,
  Radio,
  ShieldCheck,
  ArrowUpRight,
  ZapOff
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, apiGet } from '../../../lib/api'
import { EditorCategory } from '../../../types/editor'

interface SocialVaultViewProps {
  category: EditorCategory
  currentTime: number
  videoId: string
  setActiveCategory: (v: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const SocialVaultView: React.FC<SocialVaultViewProps> = ({
  category, currentTime, videoId, setActiveCategory, showToast
}) => {
  const [accounts, setAccounts] = useState<any>({
    twitter: null,
    tiktok: null,
    youtube: null,
    instagram: null
  })
  const [loading, setLoading] = useState(true)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const data = await apiGet<{ success?: boolean; accounts?: any }>('/oauth/accounts')
      if (data?.success && data.accounts) {
        setAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch accounts', error)
      showToast('Account sync failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleConnect = async (platform: string) => {
    try {
      showToast(`Initiating ${platform} link...`, 'info')
      const res = await api.get(`/oauth/${platform}/connect`)
      const data = res.data as { success?: boolean; auth_url?: string }
      if (data?.success && data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Connection failed', 'error')
    }
  }

  const handleDisconnect = async (platform: string, platformUserId: string) => {
    try {
      if (!confirm(`Disconnect ${platform}?`)) return
      const res = await api.delete(`/oauth/${platform}/disconnect`, {
        data: { platform_user_id: platformUserId }
      })
      const data = res.data as { success?: boolean }
      if (data?.success) {
        showToast(`${platform} disconnected`, 'success')
        fetchAccounts()
      }
    } catch (error) {
      showToast('Disconnect failed', 'error')
    }
  }

  const PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, color: 'from-pink-500 to-rose-600', glow: 'rgba(244,63,94,0.3)', desc: 'Short-form viral engine' },
    { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'from-red-600 to-red-700', glow: 'rgba(220,38,38,0.3)', desc: 'Long-form & Shorts hub' },
    { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-500', glow: 'rgba(217,70,239,0.3)', desc: 'Visual storytelling' },
    { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'from-slate-700 to-slate-900', glow: 'rgba(255,255,255,0.1)', desc: 'Real-time narrative' }
  ]

  return (
    <div className="space-y-12 max-w-6xl mx-auto py-8 px-4">
      {/* Elite Sub-Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.4em] italic text-indigo-400 shadow-xl">
            <Globe className="w-4 h-4 animate-pulse" />
            Ecosystem Command
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-none">
            NEURAL<br />FORGE
          </h1>
          <p className="text-slate-500 text-2xl font-medium tracking-tight max-w-xl">
            Synchronize your creator identity clusters for <span className="text-white font-black italic underline decoration-indigo-500/30 underline-offset-8">Elite-tier</span> multi-node distribution.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchAccounts}
          disabled={loading}
          title="Refresh account synchronization status"
          className="p-6 bg-white/[0.03] border border-white/10 rounded-[2.5rem] text-slate-400 hover:text-white hover:bg-white/10 shadow-3xl group transition-all"
        >
          <RefreshCcw className={`w-8 h-8 ${loading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Platform Grid (Elite) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {PLATFORMS.map((platform, idx) => {
          const account = accounts[platform.id]
          const isConnected = !!account

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative p-10 rounded-[3rem] border transition-all duration-700 group overflow-hidden ${isConnected ? `${glassStyle} border-white/20 shadow-3xl` : 'bg-black/40 border-white/5 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'}`}
            >
              {/* Dynamic Glow */}
              <div className={`absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br ${platform.color} opacity-0 group-hover:opacity-10 blur-[100px] transition-opacity duration-1000`} />

              {/* HUD Indicators */}
              <div className="absolute top-8 right-8 flex gap-3">
                <button
                  onClick={() => setActivePreviewId(activePreviewId === platform.id ? null : platform.id)}
                  title={`View AI-driven social media preview for ${platform.id}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[9px] font-black uppercase italic transition-all ${activePreviewId === platform.id ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
                >
                  <Sparkles className={`w-3 h-3 ${activePreviewId === platform.id ? 'animate-pulse' : ''}`} />
                  AI Preview
                </button>
                {isConnected ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400 italic">
                    <Radio className="w-3 h-3 animate-pulse" />
                    Linked
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase text-slate-700 italic">
                    <ZapOff className="w-3 h-3" />
                    Offline
                  </div>
                )}
              </div>

              <div className="relative space-y-8">
                <div className="flex items-start gap-8">
                  <div className={`w-20 h-20 rounded-[1.8rem] bg-gradient-to-br ${platform.color} shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-700`}>
                    <platform.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-4xl font-black text-white italic tracking-tighter uppercase">{platform.label}</h4>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">{platform.desc}</p>
                  </div>
                </div>

                <AnimatePresence>
                  {activePreviewId === platform.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 p-6 rounded-[2.5rem] bg-black/60 border border-white/10 shadow-inner space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic flex items-center gap-2">
                            <Zap className="w-3 h-3" /> Native Format Render
                          </span>
                          <span className="text-[9px] font-black text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">Ready for sync</span>
                        </div>
                        <div className={`h-48 rounded-[2rem] bg-gradient-to-br ${platform.color} flex items-center justify-center relative overflow-hidden group/preview border border-white/10`}>
                          <div className="absolute inset-0 bg-black/40 group-hover/preview:bg-black/20 transition-colors z-10" />
                          <platform.icon className="w-20 h-20 text-white opacity-20 absolute z-0 scale-150 rotate-12" />

                          {/* Simulated UI Overlay */}
                          <div className="absolute bottom-6 left-6 right-6 z-20 space-y-4">
                            <div className="flex items-end justify-between">
                              <div className="space-y-2 w-2/3">
                                <div className="w-3/4 h-2.5 bg-white/90 rounded-full" />
                                <div className="w-1/2 h-2 bg-white/60 rounded-full" />
                              </div>
                              <div className="space-y-3 flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10" />
                                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isConnected ? (
                  <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group-hover:border-white/10 transition-colors shadow-inner">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[1.2rem] bg-white/5 border border-white/5 overflow-hidden shadow-2xl">
                        {account.avatar ? <img src={account.avatar} alt={account.display_name || account.username} className="w-full h-full object-cover" /> : <platform.icon className="w-8 h-8 text-white/10 m-4" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl font-black text-white italic tracking-tight leading-none">{account.display_name || account.username}</p>
                        <p className="text-[10px] text-slate-500 font-medium italic">Syncing your content&apos;s digital DNA...</p>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDisconnect(platform.id, account.platform_user_id)}
                      className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-xl"
                      title="Disconnect Node"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-[11px] font-black uppercase tracking-[0.4em] italic">Encryption Primed</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConnect(platform.id)}
                      title={`Connect your ${platform.label} account`}
                      className="px-8 py-4 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] italic hover:bg-zinc-200 transition-all shadow-2xl shadow-white/10 flex items-center gap-3"
                    >
                      Link Node
                      <ArrowUpRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}

                {isConnected && (
                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-center gap-10">
                      <div className="text-left">
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest leading-none mb-2">Reach Potential</p>
                        <p className="text-2xl font-black text-white italic tabular-nums leading-none">
                          {account.metadata?.subscriber_count || account.metadata?.followers_count || 'Syncing...'}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest leading-none mb-2">Neural Status</p>
                        <p className="text-2xl font-black text-emerald-400 italic uppercase leading-none">Elite</p>
                      </div>
                    </div>
                    <button
                      onClick={() => showToast(`${platform.label} telemetry coming soon`, 'info')}
                      title={`View account telemetry for ${platform.id}`}
                      className="p-3 bg-white/5 rounded-2xl text-slate-600 hover:text-white hover:bg-white/10 border border-white/5 transition-all"
                    >
                      <Fingerprint className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Unified Command Center (Elite) */}
      <div className={`p-16 rounded-[4.5rem] ${glassStyle} text-center relative overflow-hidden group shadow-3xl`}>
        <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
          <Cpu className="w-64 h-64 text-indigo-500" />
        </div>

        <div className="relative z-10 space-y-8 max-w-3xl mx-auto">
          <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center mx-auto shadow-[0_30px_60px_rgba(99,102,241,0.4)] border border-white/20 animate-pulse">
            <Zap className="w-12 h-12 text-white fill-white" />
          </div>
          <div className="space-y-4">
            <h3 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">UNIFIED DISTRIBUTION</h3>
            <p className="text-xl text-slate-500 font-medium tracking-tight leading-relaxed">
              Your identity nodes are bridged to Click&apos;s <span className="text-white font-black italic">Neural Distribution Matrix</span>. Full-stack ecosystem broadcasting is initialized.
            </p>
          </div>
          <div className="flex justify-center gap-6 pt-8">
            <motion.button
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory('export')}
              title="Go to export section to begin viral distribution"
              className="px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] italic shadow-3xl shadow-indigo-600/40 border border-white/20 flex items-center gap-4 group/btn"
            >
              Initiate Viral Sequence
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </motion.button>
          </div>
        </div>

        {/* HUD Footer */}
        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between opacity-30 px-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Multi-Node Link Stable</span>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-[9px] font-black text-slate-800 uppercase tracking-[0.4em] italic">TX_ID: 0x82...E1</span>
            <span className="text-[9px] font-black text-slate-800 uppercase tracking-[0.4em] italic">GLOBAL_UPLINK_V3</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SocialVaultView
