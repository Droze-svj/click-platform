'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug, Plus, RefreshCw, Trash2, ArrowLeft, Search, X,
  Zap, Globe, Radio, Settings, Link2, Unlink, ExternalLink, ShieldCheck, Cpu, Network, AlertTriangle
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { apiGet, apiPost, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

interface Integration {
  _id: string
  name: string
  type: string
  provider?: string
  status: 'active' | 'inactive' | 'error' | 'pending' | string
  lastSyncAt?: string
  config?: Record<string, any>
  createdAt: string
}

interface MarketplaceItem {
  _id?: string
  id?: string
  name: string
  provider: string
  description?: string
  category?: string
  icon?: string
  popular?: boolean
}

const PROVIDER_GRADIENT: Record<string, string> = {
  tiktok:    'from-slate-900 via-fuchsia-600 to-cyan-500',
  instagram: 'from-pink-500 via-rose-500 to-amber-500',
  youtube:   'from-rose-600 to-red-900',
  twitter:   'from-slate-700 to-slate-950',
  x:         'from-slate-700 to-slate-950',
  linkedin:  'from-blue-600 to-blue-900',
  facebook:  'from-indigo-600 to-indigo-900',
  threads:   'from-slate-800 to-black',
  pinterest: 'from-rose-600 to-rose-900',
  default:   'from-indigo-600 to-violet-900',
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  active:   { label: 'Connected', color: 'text-[var(--tint-emerald-fg)]', dot: 'bg-emerald-500', bg: 'bg-[var(--tint-emerald-bg)]' },
  inactive: { label: 'Inactive',  color: 'text-slate-400',  dot: 'bg-slate-600',  bg: 'bg-white/5' },
  error:    { label: 'Auth Failed', color: 'text-[var(--tint-rose-fg)]',   dot: 'bg-rose-500',   bg: 'bg-[var(--tint-rose-bg)]' },
  pending:  { label: 'Connecting', color: 'text-[var(--tint-amber-fg)]',  dot: 'bg-amber-500',  bg: 'bg-[var(--tint-amber-bg)]' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl transition-all duration-300'

export default function IntegrationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()

  const [installed, setInstalled] = useState<Integration[]>([])
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [a, b]: any[] = await Promise.all([apiGet('/integrations'), apiGet('/integrations/marketplace')])
      const installedList = a?.data?.integrations ?? a?.integrations ?? []
      const marketList = b?.data?.integrations ?? b?.integrations ?? []
      setInstalled(Array.isArray(installedList) ? installedList : [])
      setMarketplace(Array.isArray(marketList) ? marketList : [])
    } catch {
      showToast('Failed to sync platform connections', 'error')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadAll()
  }, [user, authLoading, router, loadAll])

  const handleInstall = async (item: MarketplaceItem) => {
    const id = item._id || item.id || item.provider
    if (!id) return
    setInstallingId(id)
    try {
      await apiPost('/integrations/install', { marketplaceId: id, config: { provider: item.provider } })
      showToast(`${item.name} connected successfully`, 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Authentication required to connect', 'error')
    } finally { setInstallingId(null) }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await apiPost(`/integrations/${id}/sync`, {})
      showToast('Synchronization started', 'success')
      await loadAll()
    } catch {
      showToast('Synchronization failed', 'error')
    } finally { setSyncingId(null) }
  }

  const handleRemove = async (id: string) => {
    setRemoving(true)
    try {
      await apiDelete(`/integrations/${id}`)
      showToast('Connection removed', 'success')
      await loadAll()
    } catch {
      showToast('Failed to remove connection', 'error')
    } finally { setRemoving(false); setRemoveTargetId(null) }
  }

  const removeTarget = removeTargetId ? installed.find(i => i._id === removeTargetId) : null

  const visibleMarketplace = marketplace.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.provider || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)
  })

  const gradientFor = (provider?: string) => PROVIDER_GRADIENT[(provider || '').toLowerCase()] || PROVIDER_GRADIENT.default

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-screen gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <Plug size={64} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.4em] animate-pulse">Syncing Platforms...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-6 lg:px-12 pt-12 max-w-[1600px] mx-auto space-y-12 font-inter">
        <ToastContainer />

        {/* Header HUD */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-50">
          <div className="flex items-center gap-8">
            <button onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl">
              <ArrowLeft size={24} />
            </button>
            <div className="w-16 h-16 bg-[var(--tint-indigo-bg)] border-2 border-[var(--tint-indigo-edge)] rounded-2xl flex items-center justify-center shadow-2xl relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Network size={32} className="text-[var(--tint-indigo-fg)] relative z-10" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Cpu size={14} className="text-[var(--tint-indigo-fg)] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--tint-indigo-fg)]/80 italic">Neural Connection Mesh</span>
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight leading-none">Platform Vault</h1>
              <p className="text-slate-400 text-sm mt-2 font-medium max-w-lg">Manage your social ecosystems. Connect platforms to automate publishing and track performance data.</p>
            </div>
          </div>
          <button onClick={() => setShowMarketplace(s => !s)} className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl ${showMarketplace ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-white text-black hover:bg-indigo-500 hover:text-white'}`}>
            {showMarketplace ? <X size={18} /> : <Plus size={18} />}
            {showMarketplace ? 'Exit Marketplace' : 'Browse Platforms'}
          </button>
        </header>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 relative z-10">
          {[
            { label: 'Total Connections', value: installed.length, icon: Link2, color: 'text-white' },
            { label: 'Active Sync',  value: installed.filter(i => i.status === 'active').length, icon: Zap, color: 'text-[var(--tint-emerald-fg)]' },
            { label: 'Issues Found',   value: installed.filter(i => i.status === 'error').length, icon: AlertTriangle, color: 'text-[var(--tint-rose-fg)]' },
            { label: 'Supported Apps',value: marketplace.length, icon: Globe, color: 'text-[var(--tint-indigo-fg)]' },
          ].map((s, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className={`${glassStyle} rounded-3xl p-6 flex items-center gap-4 hover:bg-white/[0.04]`}>
              <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <s.icon size={22} className={s.color} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic opacity-60 leading-none">{s.label}</p>
                <p className={`text-2xl font-black italic tabular-nums tracking-tighter leading-none ${s.color}`}>{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Marketplace Section */}
        <AnimatePresence>
          {showMarketplace && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-8 relative z-10">
              <div className={`${glassStyle} rounded-[2.5rem] p-8 lg:p-12 bg-indigo-500/5 border-[var(--tint-indigo-edge)]`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--tint-indigo-bg)] border border-[var(--tint-indigo-edge)] flex items-center justify-center">
                      <Globe size={28} className="text-[var(--tint-indigo-fg)]" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Connect New Platforms</h2>
                      <p className="text-xs font-medium text-slate-400 tracking-wide uppercase italic opacity-60">Browse available social nodes for integration.</p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search platforms..." className="w-full bg-black/60 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600" />
                  </div>
                </div>

                {visibleMarketplace.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <Search size={48} className="text-slate-600 mx-auto" />
                    <p className="text-xl font-bold text-slate-400">No platforms match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {visibleMarketplace.map(m => {
                      const id = m._id || m.id || m.provider!
                      const isInstalling = installingId === id
                      return (
                        <div key={id} className={`${glassStyle} rounded-3xl p-6 flex flex-col gap-6 hover:bg-white/[0.04] group`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientFor(m.provider)} flex items-center justify-center text-white font-black text-2xl shadow-xl group-hover:scale-110 transition-transform`}>
                              {(m.icon || m.name?.charAt(0) || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xl font-black text-white tracking-tight truncate leading-none mb-2">{m.name}</h4>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">{m.category || 'Social'}</p>
                            </div>
                            {m.popular && <span className="px-2.5 py-1 rounded-full bg-[var(--tint-amber-bg)] text-[var(--tint-amber-fg)] border border-[var(--tint-amber-edge)] text-[8px] font-black uppercase tracking-widest">POPULAR</span>}
                          </div>
                          <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2 opacity-80">{m.description}</p>
                          <button onClick={() => handleInstall(m)} disabled={isInstalling} className="mt-auto py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 group-hover:shadow-lg active:scale-95">
                            {isInstalling ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                            {isInstalling ? 'Authorizing...' : 'Connect Platform'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connected Platforms Mesh */}
        <div className={`${glassStyle} rounded-[2.5rem] overflow-hidden bg-black/40 relative z-10`}>
          <div className="flex items-center justify-between gap-6 px-10 py-8 border-b border-white/5">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--tint-emerald-bg)] border-2 border-[var(--tint-emerald-edge)] flex items-center justify-center shadow-xl">
                <Radio size={28} className="text-[var(--tint-emerald-fg)]" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight leading-none">Active Ecosystem</h2>
                <p className="text-xs font-medium text-slate-400 tracking-wide mt-1 italic opacity-60 uppercase leading-none">Live platform connections and sync status.</p>
              </div>
            </div>
          </div>

          {installed.length === 0 ? (
            <div className="py-32 flex flex-col items-center text-center gap-8 px-8">
              <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Unlink size={40} className="text-slate-600" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white">No Platforms Linked</h3>
                <p className="text-slate-400 text-sm max-w-sm font-medium leading-relaxed opacity-80">Connect your first platform to start distributing content and tracking cross-platform growth.</p>
              </div>
              <button onClick={() => setShowMarketplace(true)} className="px-8 py-4 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-3">
                <Plus size={18} /> Link First Node
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {installed.map(intg => {
                const cfg = STATUS_CFG[intg.status] || STATUS_CFG.inactive
                const isSyncing = syncingId === intg._id
                return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={intg._id} className="flex flex-col md:flex-row items-center gap-8 px-10 py-8 hover:bg-white/[0.02] transition-colors group">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientFor(intg.provider || intg.type)} flex items-center justify-center text-white font-black text-2xl shadow-xl flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      {(intg.name?.charAt(0) || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-center md:text-left space-y-2">
                      <h4 className="text-2xl font-black text-white tracking-tight truncate leading-none uppercase italic">{intg.name}</h4>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none opacity-60">
                        <span className="text-white">{intg.provider || intg.type}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-700" />
                        <span>Last Sync: {intg.lastSyncAt ? new Date(intg.lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending Initial Sync'}</span>
                      </div>
                    </div>
                    
                    <div className={`px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] italic flex items-center gap-3 ${cfg.bg} ${cfg.color} border-white/5`}>
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} ${intg.status === 'active' ? 'shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`} />
                      {cfg.label}
                    </div>

                    <div className="flex items-center gap-3">
                      <button disabled={isSyncing} onClick={() => handleSync(intg._id)} className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 flex items-center justify-center transition-all active:scale-90 shadow-lg">
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                      </button>
                      <button className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 flex items-center justify-center transition-all active:scale-90 shadow-lg">
                        <Settings size={18} />
                      </button>
                      <button onClick={() => setRemoveTargetId(intg._id)} className="w-11 h-11 rounded-xl bg-rose-500/5 border border-[var(--tint-rose-edge)] text-[var(--tint-rose-fg)] hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all active:scale-90 shadow-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Disconnect HUD Overlay */}
        <AnimatePresence>
          {removeTarget && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl" onClick={() => !removing && setRemoveTargetId(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className={`${glassStyle} rounded-[3rem] p-10 max-w-xl w-full border-[var(--tint-rose-edge)] bg-[#050505]`}>
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--tint-rose-bg)] border-2 border-[var(--tint-rose-edge)] flex items-center justify-center">
                    <Unlink size={28} className="text-[var(--tint-rose-fg)]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[var(--tint-rose-fg)] uppercase tracking-[0.4em] italic mb-1 block">Termination Protocol</span>
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic leading-none">Disconnect {removeTarget.name}?</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-10 opacity-80 italic">
                  This will purge all OAuth credentials and sever the neural link. All scheduled posts for this platform will be terminated immediately.
                </p>
                <div className="flex items-center gap-4 justify-end">
                  <button disabled={removing} onClick={() => setRemoveTargetId(null)} className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">CANCEL</button>
                  <button disabled={removing} onClick={() => handleRemove(removeTarget._id)} className="px-8 py-3 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-500 shadow-xl active:scale-95 flex items-center gap-2">
                    {removing ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {removing ? 'SEVERING LINK...' : 'CONFIRM TERMINATION'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
