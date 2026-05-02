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
  tiktok:    'from-surface-900 to-black',
  instagram: 'from-pink-500 via-rose-500 to-amber-500',
  youtube:   'from-rose-500 to-rose-700',
  twitter:   'from-surface-700 to-surface-900',
  x:         'from-surface-700 to-surface-900',
  linkedin:  'from-blue-500 to-blue-700',
  facebook:  'from-indigo-500 to-indigo-700',
  threads:   'from-surface-800 to-black',
  pinterest: 'from-rose-500 to-rose-800',
  default:   'from-primary-500 to-primary-700',
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  active:   { label: 'Connected', color: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50' },
  inactive: { label: 'Inactive',  color: 'text-surface-600 dark:text-surface-400',  dot: 'bg-surface-400',  bg: 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700' },
  error:    { label: 'Auth Failed', color: 'text-rose-700 dark:text-rose-400',   dot: 'bg-rose-500',   bg: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50' },
  pending:  { label: 'Connecting', color: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50' },
}

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
      showToast('Failed to load integrations', 'error')
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
      showToast('Integration disconnected', 'success')
      await loadAll()
    } catch {
      showToast('Failed to disconnect integration', 'error')
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
      <div className="flex flex-col items-center justify-center py-24 min-h-screen bg-surface-50 dark:bg-surface-950 gap-6">
        <RefreshCw size={40} className="text-primary-500 animate-spin" />
        <p className="text-sm font-bold text-surface-500 uppercase tracking-widest">Loading Integrations...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter pb-32">
        <ToastContainer />

        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10 space-y-10">
          {/* Header */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <button onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <Network size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    Ecosystem
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Integrations</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium max-w-lg">Manage your connected social platforms to automate publishing and track performance data.</p>
              </div>
            </div>
            <button onClick={() => setShowMarketplace(s => !s)} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-sm ${showMarketplace ? 'bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-700' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
              {showMarketplace ? <X size={16} /> : <Plus size={16} />}
              {showMarketplace ? 'Close Catalog' : 'Browse Platforms'}
            </button>
          </header>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Connected', value: installed.length, icon: Link2 },
              { label: 'Active Sync',  value: installed.filter(i => i.status === 'active').length, icon: Zap },
              { label: 'Issues Found',   value: installed.filter(i => i.status === 'error').length, icon: AlertTriangle },
              { label: 'Supported Apps',value: marketplace.length, icon: Globe },
            ].map((s, i) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center">
                  <s.icon size={20} className="text-surface-600 dark:text-surface-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 leading-none">{s.label}</p>
                  <p className="text-2xl font-black text-surface-900 dark:text-white tabular-nums leading-none">{s.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Marketplace Section */}
          <AnimatePresence>
            {showMarketplace && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 lg:p-10 shadow-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center">
                        <Globe size={24} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-1">Integration Catalog</h2>
                        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Browse available platforms</p>
                      </div>
                    </div>
                    <div className="relative w-full md:w-80">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
                      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search platforms..." className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-shadow" />
                    </div>
                  </div>

                  {visibleMarketplace.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                      <Search size={32} className="text-surface-300 dark:text-surface-700 mx-auto" />
                      <p className="text-sm font-bold text-surface-500">No platforms match your search.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {visibleMarketplace.map(m => {
                        const id = m._id || m.id || m.provider!
                        const isInstalling = installingId === id
                        return (
                          <div key={id} className="bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 flex flex-col gap-5 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFor(m.provider)} flex items-center justify-center text-white font-black text-xl shadow-sm border border-black/10`}>
                                  {(m.icon || m.name?.charAt(0) || '?').toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="text-base font-black text-surface-900 dark:text-white tracking-tight mb-1">{m.name}</h4>
                                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">{m.category || 'Social'}</p>
                                </div>
                              </div>
                              {m.popular && <span className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-[9px] font-bold uppercase tracking-wider">POPULAR</span>}
                            </div>
                            <p className="text-sm text-surface-600 dark:text-surface-400 font-medium leading-relaxed line-clamp-2">{m.description}</p>
                            <button onClick={() => handleInstall(m)} disabled={isInstalling} className="mt-auto w-full py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                              {isInstalling ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                              {isInstalling ? 'Authorizing...' : 'Connect'}
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

          {/* Connected Platforms */}
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-6 px-8 py-6 border-b border-surface-200 dark:border-surface-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <Radio size={24} className="text-surface-600 dark:text-surface-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-1">Active Integrations</h2>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Manage connections</p>
                </div>
              </div>
            </div>

            {installed.length === 0 ? (
              <div className="py-24 flex flex-col items-center text-center gap-6 px-8">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center">
                  <Unlink size={32} className="text-surface-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-surface-900 dark:text-white">No Platforms Connected</h3>
                  <p className="text-surface-500 text-sm max-w-sm mx-auto">Connect your first platform to start distributing content.</p>
                </div>
                <button onClick={() => setShowMarketplace(true)} className="px-6 py-3 bg-primary-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
                  <Plus size={16} /> Connect Platform
                </button>
              </div>
            ) : (
              <div className="divide-y divide-surface-200 dark:divide-surface-800">
                {installed.map(intg => {
                  const cfg = STATUS_CFG[intg.status] || STATUS_CFG.inactive
                  const isSyncing = syncingId === intg._id
                  return (
                    <div key={intg._id} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 sm:p-8 hover:bg-surface-50 dark:hover:bg-surface-950/50 transition-colors group">
                      <div className="flex items-center gap-6">
                         <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientFor(intg.provider || intg.type)} flex items-center justify-center text-white font-black text-xl shadow-sm border border-black/10 shrink-0`}>
                           {(intg.name?.charAt(0) || '?').toUpperCase()}
                         </div>
                         <div>
                           <h4 className="text-lg font-black text-surface-900 dark:text-white tracking-tight mb-2">{intg.name}</h4>
                           <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                             <span className="text-surface-700 dark:text-surface-300">{intg.provider || intg.type}</span>
                             <span>•</span>
                             <span>Last Sync: {intg.lastSyncAt ? new Date(intg.lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</span>
                           </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${cfg.bg} ${cfg.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-auto md:ml-0">
                          <button disabled={isSyncing} onClick={() => handleSync(intg._id)} title="Sync" className="w-10 h-10 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm">
                            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                          </button>
                          <button onClick={() => setRemoveTargetId(intg._id)} title="Disconnect" className="w-10 h-10 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center transition-colors shadow-sm">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Disconnect Modal */}
          <AnimatePresence>
            {removeTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm" onClick={() => !removing && setRemoveTargetId(null)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-surface-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-surface-200 dark:border-surface-800">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center mb-6">
                    <Unlink size={24} className="text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-2">Disconnect {removeTarget.name}?</h3>
                  <p className="text-sm font-medium text-surface-500 mb-8 leading-relaxed">
                    This will remove the connection to {removeTarget.name}. All scheduled posts for this platform will fail to publish until reconnected.
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button disabled={removing} onClick={() => setRemoveTargetId(null)} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                      Cancel
                    </button>
                    <button disabled={removing} onClick={() => handleRemove(removeTarget._id)} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2">
                      {removing ? <RefreshCw size={14} className="animate-spin" /> : <Unlink size={14} />}
                      {removing ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  )
}
