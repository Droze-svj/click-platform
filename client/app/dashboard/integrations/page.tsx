'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug, Plus, RefreshCw, Trash2, ArrowLeft, ArrowRight, Search, X,
  CheckCircle, AlertTriangle, Activity, Zap, Globe, Database, Radio,
  Settings, Shield, Link2, Unlink
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

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: 'CONNECTED',    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5', dot: 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' },
  inactive: { label: 'INACTIVE',     color: 'text-slate-400 border-white/10 bg-white/[0.02]',          dot: 'bg-slate-600' },
  error:    { label: 'AUTH_FAILED',  color: 'text-rose-400 border-rose-500/30 bg-rose-500/5',          dot: 'bg-rose-500 animate-pulse' },
  pending:  { label: 'CONNECTING',   color: 'text-amber-400 border-amber-500/30 bg-amber-500/5',       dot: 'bg-amber-500 animate-pulse' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.6)] transition-all duration-300'

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
      showToast('INTEGRATION_SYNC_ERR: UPLINK_DIFFRACTED', 'error')
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
      showToast(`✓ ${item.name.toUpperCase()}_LINKED`, 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'INSTALL_REJECTED: AUTH_REQUIRED', 'error')
    } finally { setInstallingId(null) }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await apiPost(`/integrations/${id}/sync`, {})
      showToast('✓ SYNC_DISPATCHED', 'success')
      await loadAll()
    } catch {
      showToast('SYNC_FAILED: HEALTH_CHECK_PENDING', 'error')
    } finally { setSyncingId(null) }
  }

  const handleRemove = async (id: string) => {
    setRemoving(true)
    try {
      await apiDelete(`/integrations/${id}`)
      showToast('✓ INTEGRATION_PURGED', 'success')
      await loadAll()
    } catch {
      showToast('PURGE_FAILED: SYSTEM_LOCK', 'error')
    } finally { setRemoving(false); setRemoveTargetId(null) }
  }

  const removeTarget = removeTargetId ? installed.find(i => i._id === removeTargetId) : null

  const visibleMarketplace = marketplace.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.provider || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)
  })

  const gradientFor = (provider?: string) => PROVIDER_GRADIENT[(provider || '').toLowerCase()] || PROVIDER_GRADIENT.default

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-10 backdrop-blur-3xl">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
        <Plug size={80} className="text-indigo-500 animate-spin relative z-10" />
      </div>
      <div className="space-y-4 text-center">
        <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Linking Integration Mesh...</p>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">RESOLVING_OAUTH_HANDSHAKES</p>
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-16 bg-[#020205]">
        <ToastContainer />

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back" className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:border-rose-500/50">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl relative">
              <Plug size={40} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-indigo-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 italic leading-none">Integration Mesh</span>
              </div>
              <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Integrations</h1>
              <p className="text-slate-500 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">Connect publishing surfaces, analytics nodes, and external uplinks.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowMarketplace(s => !s)} className={`px-12 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] italic flex items-center gap-5 transition-colors ${showMarketplace ? 'bg-white/5 border-2 border-white/10 text-slate-400 hover:text-white' : 'bg-white text-black hover:bg-indigo-500 hover:text-white'}`}>
            {showMarketplace ? <X size={22} /> : <Plus size={22} />}
            {showMarketplace ? 'CLOSE_BROWSER' : 'BROWSE_MARKETPLACE'}
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {[
            { label: 'Total Connected', value: installed.length, icon: Link2, color: 'text-white' },
            { label: 'Active Uplinks',  value: installed.filter(i => i.status === 'active').length, icon: Zap, color: 'text-emerald-400' },
            { label: 'Auth Failures',   value: installed.filter(i => i.status === 'error').length, icon: AlertTriangle, color: 'text-rose-400' },
            { label: 'Marketplace Size',value: marketplace.length, icon: Globe, color: 'text-indigo-400' },
          ].map(s => (
            <div key={s.label} className={`${glassStyle} rounded-[2.5rem] p-8 flex items-center gap-6`}>
              <div className="w-14 h-14 rounded-[1.4rem] bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <s.icon size={26} className={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mb-1 leading-none">{s.label}</p>
                <p className={`text-4xl font-black italic tabular-nums tracking-tighter leading-none ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Marketplace browser */}
        <AnimatePresence>
          {showMarketplace && (
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }} transition={{ type: 'spring', damping: 22, stiffness: 200 }} className={`${glassStyle} rounded-[3rem] overflow-hidden border-indigo-500/20`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-10 py-8 border-b-2 border-white/5 bg-indigo-600/5">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Globe size={26} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Marketplace</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{visibleMarketplace.length} / {marketplace.length} AVAILABLE_NODES</p>
                  </div>
                </div>
                <div className="relative w-full md:w-96">
                  <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="SCAN_PROVIDERS..." className="w-full bg-black/60 border-2 border-white/5 rounded-full pl-12 pr-10 py-3 text-[12px] font-black text-white uppercase tracking-[0.4em] italic focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-600" />
                </div>
              </div>

              {visibleMarketplace.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center gap-4">
                  <Search size={48} className="text-slate-500" />
                  <p className="text-2xl font-black text-white italic uppercase tracking-tight">No Providers Match</p>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Marketplace may be unpopulated for your tier.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-10">
                  {visibleMarketplace.map(m => {
                    const id = m._id || m.id || m.provider!
                    const isInstalling = installingId === id
                    return (
                      <div key={id} className={`${glassStyle} rounded-[2rem] p-7 flex flex-col gap-5 hover:border-indigo-500/30`}>
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-[1.2rem] bg-gradient-to-br ${gradientFor(m.provider)} flex items-center justify-center text-white font-black text-2xl shadow-2xl`}>
                            {(m.icon || m.name?.charAt(0) || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[18px] font-black text-white italic uppercase tracking-tighter leading-none mb-2 truncate">{m.name}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none truncate">{m.provider} {m.category ? `· ${m.category}` : ''}</p>
                          </div>
                          {m.popular && <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[8px] font-black uppercase tracking-[0.3em] italic">POPULAR</span>}
                        </div>
                        {m.description && <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-3">{m.description}</p>}
                        <button type="button" disabled={isInstalling} onClick={() => handleInstall(m)} className="mt-auto py-3 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:bg-indigo-500 hover:text-white transition-colors italic disabled:opacity-40 flex items-center justify-center gap-3">
                          {isInstalling ? <><RefreshCw size={14} className="animate-spin" /> LINKING...</> : <><Plus size={14} /> CONNECT</>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connected list */}
        <div className={`${glassStyle} rounded-[3rem] overflow-hidden`}>
          <div className="flex items-center justify-between gap-6 px-10 py-8 border-b-2 border-white/5">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-[1.4rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Radio size={26} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Active Uplinks</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{installed.length} CONNECTED_PROVIDERS</p>
              </div>
            </div>
          </div>
          {installed.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-center gap-6 px-8">
              <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center"><Unlink size={44} className="text-slate-500" /></div>
              <p className="text-3xl font-black text-white italic uppercase tracking-tight">No Uplinks Established</p>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic max-w-md leading-relaxed">Connect a publishing surface so Click can post, sync analytics, and orchestrate scheduled deliveries.</p>
              <button type="button" onClick={() => setShowMarketplace(true)} className="px-10 py-4 bg-white text-black rounded-full text-[12px] font-black uppercase tracking-[0.5em] hover:bg-indigo-500 hover:text-white transition-colors italic flex items-center gap-3">
                <Plus size={18} /> BROWSE_MARKETPLACE
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {installed.map(intg => {
                const cfg = STATUS_CFG[intg.status] || STATUS_CFG.inactive
                const isSyncing = syncingId === intg._id
                return (
                  <div key={intg._id} className="flex flex-col xl:flex-row items-center gap-6 px-10 py-8 hover:bg-white/[0.02] transition-colors">
                    <div className={`w-16 h-16 rounded-[1.4rem] bg-gradient-to-br ${gradientFor(intg.provider || intg.type)} flex items-center justify-center text-white font-black text-2xl shadow-xl flex-shrink-0`}>
                      {(intg.name?.charAt(0) || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-center xl:text-left">
                      <p className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-2 truncate">{intg.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">
                        <span>{intg.provider || intg.type}</span>
                        <span className="opacity-40">·</span>
                        <span>SYNC: {intg.lastSyncAt ? new Date(intg.lastSyncAt).toLocaleString() : 'NEVER'}</span>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.4em] italic flex items-center gap-2 ${cfg.color}`}>
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <button type="button" disabled={isSyncing} onClick={() => handleSync(intg._id)} title="Sync now" className="w-12 h-12 rounded-[1.2rem] bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white hover:border-indigo-500/40 flex items-center justify-center transition-colors disabled:opacity-40">
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                      </button>
                      <button type="button" title="Configure" className="w-12 h-12 rounded-[1.2rem] bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white hover:border-indigo-500/40 flex items-center justify-center transition-colors">
                        <Settings size={18} />
                      </button>
                      <button type="button" onClick={() => setRemoveTargetId(intg._id)} title="Disconnect" className="w-12 h-12 rounded-[1.2rem] bg-rose-500/5 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Disconnect confirmation */}
      <AnimatePresence>
        {removeTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-[#020205]/90 backdrop-blur-2xl" onClick={() => !removing && setRemoveTargetId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }} transition={{ type: 'spring', damping: 22, stiffness: 240 }} onClick={e => e.stopPropagation()} className={`${glassStyle} rounded-[3rem] p-10 max-w-2xl w-full border-rose-500/20`}>
              <div className="flex items-start gap-6 mb-8">
                <div className="w-14 h-14 rounded-[1.4rem] bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center"><Unlink size={24} className="text-rose-400" /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.5em] italic mb-2">DISCONNECT_PROTOCOL</p>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tight leading-tight mb-3">Disconnect {removeTarget.name}?</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] italic leading-relaxed">Scheduled posts using this uplink will fail until re-linked. OAuth credentials will be purged.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 justify-end">
                <button type="button" disabled={removing} onClick={() => setRemoveTargetId(null)} className="px-7 py-3 bg-white/5 border-2 border-white/10 text-slate-300 rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:text-white hover:bg-white/10 italic disabled:opacity-40">ABORT</button>
                <button type="button" disabled={removing} onClick={() => handleRemove(removeTarget._id)} className="px-9 py-3 bg-rose-600 text-white rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:bg-rose-500 italic shadow-[0_20px_60px_rgba(244,63,94,0.3)] disabled:opacity-40 flex items-center gap-3">
                  {removing ? <RefreshCw size={14} className="animate-spin" /> : <Unlink size={14} />}
                  {removing ? 'PURGING...' : 'CONFIRM_DISCONNECT'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  )
}
