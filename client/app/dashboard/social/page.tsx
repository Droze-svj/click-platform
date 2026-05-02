'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import {
  Twitter, Linkedin, Facebook, Instagram, Youtube, Video,
  Unlink, ExternalLink, CheckCircle, AlertCircle, Link2,
  Cpu, Shield, Globe, Zap, Radio, Terminal, Brain,
  Sparkles, RefreshCw, Fingerprint, Lock, Activity
} from 'lucide-react'
import { useOAuth } from '../../../hooks/useOAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useToast } from '../../../contexts/ToastContext'

interface PlatformAccount {
  id: string
  platform: string
  platform_user_id: string
  username: string
  display_name: string
  avatar?: string
  is_connected: boolean
  metadata?: any
  created_at: string
}

interface ConnectedAccounts {
  twitter?: PlatformAccount | null
  linkedin?: PlatformAccount | null
  facebook?: PlatformAccount | null
  instagram?: PlatformAccount | null
  youtube?: PlatformAccount | null
  tiktok?: PlatformAccount | null
  [key: string]: PlatformAccount | null | undefined
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl transition-all duration-300'

const PLATFORM_CONFIG: Record<string, { 
  name: string; 
  icon: any; 
  desc: string; 
  gradient: string;
  color: string;
}> = {
  twitter: { 
    name: 'X / Twitter', 
    icon: Twitter, 
    desc: 'Neural-text dissemination & viral threads.',
    gradient: 'from-slate-700 to-black',
    color: 'text-slate-400'
  },
  youtube: { 
    name: 'YouTube', 
    icon: Youtube, 
    desc: 'High-fidelity cinematic broadcast node.',
    gradient: 'from-rose-600 to-red-900',
    color: 'text-rose-500'
  },
  instagram: { 
    name: 'Instagram', 
    icon: Instagram, 
    desc: 'Aesthetic resonance & visual storytelling.',
    gradient: 'from-pink-500 via-rose-500 to-amber-500',
    color: 'text-pink-500'
  },
  linkedin: { 
    name: 'LinkedIn', 
    icon: Linkedin, 
    desc: 'Professional capital & industry authority.',
    gradient: 'from-blue-600 to-blue-900',
    color: 'text-blue-500'
  },
  facebook: { 
    name: 'Facebook', 
    icon: Facebook, 
    desc: 'Community mesh & social graph engagement.',
    gradient: 'from-indigo-600 to-indigo-900',
    color: 'text-indigo-500'
  },
  tiktok: { 
    name: 'TikTok', 
    icon: Video, 
    desc: 'Short-form kinetic viral catalyst.',
    gradient: 'from-slate-900 via-fuchsia-600 to-cyan-500',
    color: 'text-fuchsia-500'
  }
}

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth() as any
  const { showToast } = useToast()
  const { connect, disconnect, getConnections, loading: oauthLoading } = useOAuth()
  
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const connections = await getConnections()
      setAccounts(connections as ConnectedAccounts)
    } catch (err: any) {
      showToast('Failed to sync neural connections', 'error')
    } finally {
      setLoading(false)
    }
  }, [getConnections, showToast])

  useEffect(() => {
    loadAccounts()

    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const platformParam = searchParams.get('platform')

    if (successParam === 'true' && platformParam) {
      showToast(`${platformParam} uplink established`, 'success')
    } else if (errorParam) {
      showToast(`Uplink failed: ${errorParam}`, 'error')
    }
  }, [searchParams, loadAccounts, showToast])

  const connectAccount = async (platform: string) => {
    try {
      setConnecting(platform)
      await connect(platform)
    } catch (err: any) {
      showToast(err.message || `Failed to establish ${platform} link`, 'error')
      setConnecting(null)
    }
  }

  const disconnectAccount = async (platform: string) => {
    try {
      setDisconnecting(platform)
      await disconnect(platform)
      showToast(`${platform} link severed`, 'success')
      await loadAccounts()
    } catch (err: any) {
      showToast(err.message || `Failed to sever ${platform} link`, 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-screen gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <Radio size={64} className="text-indigo-500 animate-pulse relative z-10" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.4em] animate-pulse">Scanning Social Nodes...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-6 lg:px-12 pt-12 max-w-[1600px] mx-auto space-y-12 font-inter">
        <ToastContainer />

        {/* Background Ambience */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-0">
          <Fingerprint size={1000} className="text-white absolute -bottom-40 -left-40 rotate-12" />
          <Globe size={800} className="text-white absolute -top-40 -right-40 -rotate-12" />
        </div>

        {/* Header HUD */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-50">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-3xl flex items-center justify-center shadow-2xl relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Globe size={40} className="text-indigo-400 relative z-10" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Cpu size={14} className="text-indigo-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400/80 italic">Neural Uplink Interface</span>
              </div>
              <h1 className="text-5xl font-black text-[var(--text-main)] tracking-tighter leading-none italic uppercase">Social Vault</h1>
              <p className="text-slate-400 text-sm mt-2 font-medium max-w-lg italic">Manage your platform manifest. Establish neural links to automate content dissemination across the social mesh.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Sync_Status: NOMINAL</span>
             </div>
             <button onClick={loadAccounts} className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl">
               <RefreshCw size={20} />
             </button>
          </div>
        </header>

        {/* Vault Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {Object.entries(PLATFORM_CONFIG).map(([id, cfg], i) => {
            const account = accounts?.[id]
            const isConnecting = connecting === id
            const isDisconnecting = disconnecting === id
            const isActive = !!account

            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
                key={id} 
                className={`${glassStyle} rounded-[3rem] p-8 flex flex-col gap-8 group hover:bg-white/[0.04] relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${cfg.gradient} blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity`} />
                
                <div className="flex items-center justify-between relative z-10">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500`}>
                    <cfg.icon size={32} className="text-white" />
                  </div>
                  <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] italic flex items-center gap-2 ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-300 border-white/5'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                    {isActive ? 'UPLINKED' : 'OFFLINE'}
                  </div>
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight mb-2">{cfg.name}</h3>
                  <p className="text-xs text-slate-400 font-medium italic opacity-70 leading-relaxed">{cfg.desc}</p>
                </div>

                {isActive ? (
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.03] border border-white/5 group/node transition-all hover:bg-white/[0.06]">
                      <div className="relative">
                        {account.avatar ? (
                          <img src={account.avatar} alt={account.username} className="w-12 h-12 rounded-2xl object-cover grayscale group-hover/node:grayscale-0 transition-all border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <cfg.icon size={20} className="text-slate-300" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-emerald-500 border-2 border-[#020205] flex items-center justify-center shadow-lg">
                          <CheckCircle size={10} className="text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate uppercase italic">{account.display_name || account.username}</p>
                        <p className="text-[10px] font-bold text-slate-300 truncate uppercase tracking-widest italic">NODE_ID: {account.platform_user_id.slice(0, 12)}...</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => window.open(account.metadata?.profile_url || '#', '_blank')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90">
                          <ExternalLink size={16} />
                        </button>
                        <button onClick={() => disconnectAccount(id)} disabled={isDisconnecting} className="w-10 h-10 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90 shadow-xl disabled:opacity-40">
                          {isDisconnecting ? <RefreshCw size={16} className="animate-spin" /> : <Unlink size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => connectAccount(id)} 
                    disabled={isConnecting}
                    className={`mt-auto w-full py-4 rounded-[1.5rem] bg-white text-black font-black uppercase text-[11px] tracking-[0.3em] italic hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 disabled:opacity-40 group/btn`}
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        NEGOTIATING...
                      </>
                    ) : (
                      <>
                        <Link2 size={16} className="group-hover:rotate-45 transition-transform" />
                        Establish Link
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Security / System Stats HUD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {[
            { label: 'Neural Encryption', val: '256-BIT SHARDS', icon: Shield, col: 'text-indigo-400' },
            { label: 'Link Latency', val: '12ms AVG', icon: Activity, col: 'text-emerald-400' },
            { label: 'Secure Protocols', val: 'OAUTH 2.0 MATRIX', icon: Lock, col: 'text-cyan-400' },
          ].map((s, i) => (
            <div key={i} className={`${glassStyle} rounded-[2rem] p-6 flex items-center gap-6`}>
              <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <s.icon size={22} className={s.col} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic mb-1 opacity-60 leading-none">{s.label}</p>
                <p className={`text-sm font-black italic uppercase tracking-tight text-white`}>{s.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Technical Footer HUD */}
        <footer className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em] italic">
            <Terminal size={14} />
            VAULT_VERSION: 2.0.4 // SYSTEM_STABLE
          </div>
          <div className="flex items-center gap-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em] italic">
            <span>Uptime: 99.9%</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Region: EU-WEST-1</span>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
