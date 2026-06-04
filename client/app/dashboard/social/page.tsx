'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import {
  Twitter, Linkedin, Facebook, Instagram, Youtube, Video,
  Unlink, CheckCircle, AlertCircle, Link2,
  Cpu, Shield, Globe, Zap, Radio, Terminal, Brain,
  Sparkles, RefreshCw, Fingerprint, Lock, Activity, ArrowLeft, ArrowRight,
  MoreVertical, Share2, Command, Monitor, Database
} from 'lucide-react'
import { useOAuth } from '../../../hooks/useOAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'

interface PlatformAccount {
  id?: string
  accountId?: string
  platform: string
  platform_user_id: string
  username: string
  display_name: string
  avatar?: string
  is_connected?: boolean
  isPrimary?: boolean
  isActive?: boolean
  metadata?: any
  created_at?: string
  connected_at?: string | null
}

// Multi-account: each platform key now stores an array. A user can have
// 0..N accounts per platform. The first entry is the primary; `isActive`
// marks the one the worker publishes from when no accountId is specified.
interface ConnectedAccounts {
  twitter?: PlatformAccount[] | null
  linkedin?: PlatformAccount[] | null
  facebook?: PlatformAccount[] | null
  instagram?: PlatformAccount[] | null
  youtube?: PlatformAccount[] | null
  tiktok?: PlatformAccount[] | null
  google?: PlatformAccount[] | null
  [key: string]: PlatformAccount[] | null | undefined
}

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
    color: 'text-slate-600 dark:text-slate-400'
  },
  youtube: { 
    name: 'YouTube', 
    icon: Youtube, 
    desc: 'High-fidelity cinematic broadcast node.',
    gradient: 'from-rose-600 to-red-900',
    color: 'text-rose-600 dark:text-rose-500'
  },
  instagram: { 
    name: 'Instagram', 
    icon: Instagram, 
    desc: 'Aesthetic resonance & visual storytelling.',
    gradient: 'from-pink-500 via-rose-500 to-amber-500',
    color: 'text-pink-600 dark:text-pink-500'
  },
  linkedin: { 
    name: 'LinkedIn', 
    icon: Linkedin, 
    desc: 'Professional capital & industry authority.',
    gradient: 'from-blue-600 to-blue-900',
    color: 'text-blue-600 dark:text-blue-500'
  },
  facebook: { 
    name: 'Facebook', 
    icon: Facebook, 
    desc: 'Community mesh & social graph engagement.',
    gradient: 'from-indigo-600 to-indigo-900',
    color: 'text-indigo-600 dark:text-indigo-500'
  },
  tiktok: {
    name: 'TikTok',
    icon: Video,
    desc: 'Short-form kinetic viral catalyst.',
    gradient: 'from-slate-900 via-fuchsia-600 to-cyan-500',
    color: 'text-fuchsia-600 dark:text-fuchsia-500'
  },
  // Google = read-only integration. Different OAuth client from YouTube
  // because it asks for the broader scope set: YouTube Analytics
  // (channel views / retention), Search Console (top queries / CTR), and
  // basic profile. The data flows into getTopPerformingPlaybook so the
  // AI's suggestions improve over time based on what's actually winning
  // on the creator's own channel + site. Doesn't replace the YouTube
  // card — that one handles video UPLOADS; this one handles ANALYTICS.
  google: {
    name: 'Google Analytics',
    icon: Globe,
    desc: 'YouTube Analytics + Search Console insights. Read-only.',
    gradient: 'from-sky-500 via-emerald-500 to-amber-400',
    color: 'text-sky-600 dark:text-sky-400',
  },
}

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth() as any
  const { showToast } = useToast()
  const { t } = useTranslation()
  const { connect, disconnect, getConnections, loading: oauthLoading } = useOAuth()
  
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)

  // Stabilise `loadAccounts` via a ref so the effect below can call the
  // latest closure without putting it in the dep array. Without this,
  // `getConnections` and `showToast` (returned from non-memoising hooks)
  // changed identity every render, recreating `loadAccounts`, which made
  // the mount effect re-fire and call `setAccounts`, which re-rendered,
  // which recreated `loadAccounts` again — the React "Maximum update
  // depth exceeded" loop the dashboard was caught in.
  const loadAccountsRef = useRef<() => Promise<void>>(async () => {})
  loadAccountsRef.current = async () => {
    try {
      setLoading(true)
      const connections = await getConnections()
      setAccounts(connections as ConnectedAccounts)
    } catch {
      showToast(t('socialPage.toastSyncFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }
  const loadAccounts = useCallback(() => loadAccountsRef.current(), [])

  useEffect(() => {
    loadAccounts()

    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const platformParam = searchParams.get('platform')

    if (successParam === 'true' && platformParam) {
      showToast(t('socialPage.toastUplinkEstablished', { platform: platformParam.toUpperCase() }), 'success')
    } else if (errorParam) {
      showToast(t('socialPage.toastUplinkFailure', { error: errorParam }), 'error')
    }
    // Intentionally omit `loadAccounts` (stable via ref) and `showToast`
    // (not memoised by useToast) from the dep array — including them
    // caused an infinite render loop. We only re-run when the URL's
    // search params change, which is the only meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const connectAccount = async (platform: string) => {
    try {
      setConnecting(platform)
      await connect(platform)
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastUplinkErr', { platform: platform.toUpperCase() }), 'error')
      setConnecting(null)
    }
  }

  /**
   * Disconnect one specific account (multi-account aware) or the whole
   * platform (when accountId is undefined). The new backend forwards
   * accountId to the per-platform service so only the requested entry
   * is removed; remaining accounts stay connected.
   */
  const disconnectAccount = async (platform: string, accountId?: string) => {
    const label = accountId
      ? t('socialPage.severLabelSelected', { platform: platform.toUpperCase() })
      : t('socialPage.severLabelEvery', { platform: platform.toUpperCase() })
    if (!confirm(t('socialPage.severConfirm', { label }))) return
    try {
      setDisconnecting(`${platform}:${accountId || 'all'}`)
      await disconnect(platform, accountId)
      showToast(t('socialPage.toastLinkSevered', { platform: platform.toUpperCase() }), 'success')
      await loadAccounts()
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastDecouplingErr', { platform: platform.toUpperCase() }), 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  /**
   * Switch which connected account is active for one-account UIs (e.g.
   * the editor's "post to" dropdown). The worker uses this as the
   * default when a scheduled post has no explicit accountId.
   */
  const setActive = async (platform: string, accountId: string) => {
    try {
      const { apiPost } = await import('../../../lib/api')
      await apiPost(`/oauth/${platform}/active`, { accountId })
      showToast(t('socialPage.toastActiveSwitched', { platform: platform.toUpperCase() }), 'success')
      await loadAccounts()
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastActiveSwitchFailed', { platform }), 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
        <Radio size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">{t('socialPage.scanningNodes')}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Header HUD */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} aria-label={t('socialPage.backToDashboard')} title={t('socialPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                 <Globe size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('socialPage.badgeSocialLattice')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        {t('socialPage.syncNominal')}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('socialPage.title')}</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full md:w-auto">
              <div className="flex items-center gap-4 px-8 py-4 bg-surface-card border-2 border-surface-100 dark:border-surface-800 rounded-2xl text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic shadow-inner">
                 <Activity size={16} className="text-primary-500" /> {t('socialPage.activeCount', { count: accounts ? Object.values(accounts).filter(Boolean).length : 0 })}
              </div>
              <button type="button" onClick={loadAccounts} aria-label={t('socialPage.refreshAccounts')} title={t('socialPage.refreshAccounts')} className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90">
                 <RefreshCw size={28} />
              </button>
           </div>
        </header>

        {/* Vault Matrix Hero */}
        <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
           <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Share2 size={450} className="text-primary-500" /></div>
           <div className="relative z-10 max-w-4xl space-y-8">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[1.8rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                    <Fingerprint size={32} className="text-primary-600 dark:text-primary-400" />
                 </div>
                 <div>
                    <h2 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none">{t('socialPage.authMatrix')}</h2>
                    <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{t('socialPage.oauthSyncProtocol')}</p>
                 </div>
              </div>
              <p className="text-lg font-bold text-surface-500 dark:text-slate-400 leading-relaxed italic uppercase tracking-tight max-w-3xl">
                {t('socialPage.heroIntro')} <strong className="text-primary-500">{t('socialPage.heroFeature1')}</strong>, <strong className="text-primary-500">{t('socialPage.heroFeature2')}</strong>, {t('socialPage.heroAnd')} <strong className="text-primary-500">{t('socialPage.heroFeature3')}</strong>.
              </p>
              <div className="flex flex-wrap gap-6 pt-4">
                 {[
                   { label: t('socialPage.statNeuralEncryption'), val: '256-BIT', icon: Shield },
                   { label: t('socialPage.statUplinkLatency'), val: '12ms AVG', icon: Activity },
                   { label: t('socialPage.statMatrixStability'), val: '99.9%', icon: Zap }
                 ].map((s, i) => (
                   <div key={i} className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 shadow-inner backdrop-blur-xl">
                      <s.icon size={18} className="text-primary-500" />
                      <div>
                         <p className="text-[8px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none mb-1">{s.label}</p>
                         <p className="text-[11px] font-black text-surface-900 dark:text-white uppercase italic leading-none">{s.val}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        {/* Vault Matrix Grid — auto-rows-fr keeps every platform card the
            same height regardless of whether the TikTok "Coming Soon" card
            renders compact content or a connected account renders an
            expanded panel. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-10 relative z-10">
          {Object.entries(PLATFORM_CONFIG).map(([id, cfg], i) => {
            // Multi-account: each platform's slot is now an array. The
            // first entry is rendered as the primary "active" account,
            // and the rest stack below it with their own switch /
            // disconnect controls.
            const rawSlot = accounts?.[id]
            const accountList: PlatformAccount[] = Array.isArray(rawSlot)
              ? rawSlot
              : (rawSlot ? [rawSlot as unknown as PlatformAccount] : [])
            const primary = accountList.find((a) => a.isPrimary) || accountList[0] || null
            const isConnecting = connecting === id
            const isActive = accountList.length > 0
            const isTikTok = id === 'tiktok'

            return (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.8, type: 'spring' }}
                whileHover={{ y: -15, scale: 1.02 }}
                key={id}
                className={`bg-surface-card backdrop-blur-3xl rounded-[3.5rem] p-12 flex flex-col min-h-[480px] group transition-all duration-500 border shadow-2xl relative overflow-hidden ${isTikTok ? 'border-amber-500/20 hover:border-amber-500/40' : 'border-surface-200 dark:border-surface-800 hover:border-primary-500/30'}`}
              >
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${cfg.gradient} blur-[120px] opacity-10 group-hover:opacity-30 transition-opacity duration-1000`} />

                <div className="flex items-center justify-between relative z-10 mb-12">
                  <div className={`w-20 h-20 rounded-[2.5rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-700 border-2 border-white/10 ${isTikTok ? 'opacity-60' : ''}`}>
                    <cfg.icon size={40} className="text-white drop-shadow-lg" />
                  </div>
                  <div className={`px-6 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-[0.4em] italic flex items-center gap-3 shadow-lg ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : isTikTok ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-surface-page dark:bg-surface-950/50 text-surface-300 dark:text-slate-800 border-surface-100 dark:border-surface-800'}`}>
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse' : isTikTok ? 'bg-amber-500 animate-pulse' : 'bg-surface-200 dark:bg-slate-900'}`} />
                    {isActive ? t('socialPage.statusUplinked') : isTikTok ? t('socialPage.statusComingSoon') : t('socialPage.statusOffline')}
                  </div>
                </div>

                <div className="relative z-10 flex-1">
                  <p className={`text-[10px] font-black uppercase tracking-[0.5em] mb-4 italic ${cfg.color} opacity-80 group-hover:opacity-100 transition-opacity`}>{t('socialPage.nodeManifest')}</p>
                  <h3 className="text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter mb-4 group-hover:text-primary-500 transition-colors leading-tight">{cfg.name}</h3>
                  <div className="p-6 bg-surface-page/50 dark:bg-surface-950/40 rounded-[2rem] border-2 border-surface-100 dark:border-surface-800 shadow-inner backdrop-blur-xl">
                    <p className="text-sm text-surface-500 dark:text-slate-400 font-bold leading-relaxed italic uppercase tracking-tight opacity-60 group-hover:opacity-100 transition-opacity">
                      {t(`socialPage.platformDesc.${id}`)}
                    </p>
                  </div>
                </div>

                {isActive && primary ? (
                  <div className="space-y-4 relative z-10 mt-8 pt-8 border-t-2 border-surface-100 dark:border-surface-800">
                    {/* One row per connected account on this platform.
                        The active account is marked; non-active rows have
                        a "Make active" button. Each row has its own
                        disconnect. */}
                    {accountList.map((acct) => {
                      const aid = acct.accountId || acct.platform_user_id
                      const rowBusy = disconnecting === `${id}:${aid}`
                      return (
                        <div key={aid} className={`flex items-center gap-4 p-5 rounded-[2rem] bg-surface-page dark:bg-surface-950/60 border-2 ${acct.isActive ? 'border-emerald-500/40' : 'border-surface-100 dark:border-surface-800'} group/node transition-all hover:border-primary-500/20 shadow-inner backdrop-blur-2xl`}>
                          <div className="relative flex-shrink-0">
                            {acct.avatar ? (
                              <img src={acct.avatar} alt={acct.username} className="w-12 h-12 rounded-2xl object-cover border-2 border-surface-100 dark:border-surface-800 shadow-lg" />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner">
                                <cfg.icon size={22} className="text-surface-300 dark:text-slate-800" />
                              </div>
                            )}
                            {acct.isActive && (
                              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-lg bg-emerald-500 border-2 border-surface-card dark:border-surface-page flex items-center justify-center shadow-xl">
                                <CheckCircle size={10} className="text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-black text-surface-900 dark:text-white truncate uppercase italic tracking-tighter leading-tight">{acct.display_name || acct.username || acct.platform_user_id}</p>
                              {acct.isPrimary && <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-primary-500/10 text-primary-500 border border-primary-500/20">{t('socialPage.badgePrimary')}</span>}
                              {acct.isActive && !acct.isPrimary && <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{t('socialPage.badgeActive')}</span>}
                            </div>
                            <p className="text-[9px] font-black text-surface-400 dark:text-slate-600 truncate uppercase tracking-widest italic leading-none mt-1">{t('socialPage.accountIdLabel', { id: String(acct.platform_user_id).slice(0, 14).toUpperCase() })}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!acct.isActive && (
                              <button
                                type="button"
                                onClick={() => setActive(id, aid)}
                                title={t('socialPage.makeActiveTitle')}
                                className="px-3 py-2 rounded-xl bg-primary-500/5 border-2 border-primary-500/20 text-primary-500 text-[9px] font-black uppercase tracking-widest hover:bg-primary-500 hover:text-white transition-all"
                              >{t('socialPage.useButton')}</button>
                            )}
                            <button
                              type="button"
                              onClick={() => disconnectAccount(id, aid)}
                              disabled={rowBusy}
                              title={t('socialPage.disconnectAccount', { account: acct.username || aid })}
                              aria-label={t('socialPage.disconnectAccount', { account: acct.username || aid })}
                              className="w-10 h-10 rounded-xl bg-rose-500/5 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center"
                            >
                              {rowBusy ? <RefreshCw size={14} className="animate-spin" /> : <Unlink size={14} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add another account on this same platform. The
                        backend now appends to accounts[] instead of
                        overwriting, so this is safe to call when an
                        account already exists. */}
                    <button
                      type="button"
                      onClick={() => connectAccount(id)}
                      disabled={isConnecting}
                      className="w-full py-4 rounded-[1.5rem] bg-surface-page dark:bg-surface-950 border-2 border-dashed border-surface-200 dark:border-surface-800 hover:border-primary-500/40 text-[10px] font-black uppercase tracking-widest italic text-surface-400 hover:text-primary-500 transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                    >
                      {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
                      {isConnecting ? t('socialPage.negotiatingShort') : t('socialPage.addAnotherAccount', { platform: id.toUpperCase() })}
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 relative z-10 pt-8 border-t-2 border-surface-100 dark:border-surface-800">
                    {isTikTok ? (
                      <div className="space-y-6">
                        <div className="p-6 rounded-[2rem] bg-amber-500/5 border-2 border-amber-500/20">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] italic mb-3">{t('socialPage.pendingApiApproval')}</p>
                          <p className="text-sm font-bold text-surface-500 dark:text-slate-400 italic leading-relaxed">
                            {t('socialPage.tiktokPendingBody')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => connectAccount(id)}
                          disabled={isConnecting}
                          className="w-full py-6 rounded-[2.5rem] bg-amber-500 text-black font-black uppercase text-[12px] tracking-[0.6em] italic hover:bg-amber-400 transition-all active:scale-95 shadow-[0_20px_60px_rgba(245,158,11,0.3)] flex items-center justify-center gap-6 disabled:opacity-40 group/btn border-none"
                        >
                          {isConnecting ? <><RefreshCw size={24} className="animate-spin" /> {t('socialPage.negotiating')}</> : <><Link2 size={24} className="group-hover/btn:rotate-45 transition-transform duration-500" /> {t('socialPage.preConnectAccount')}</>}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => connectAccount(id)}
                        disabled={isConnecting}
                        className="w-full py-6 rounded-[2.5rem] bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[12px] tracking-[0.8em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all active:scale-95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex items-center justify-center gap-6 disabled:opacity-40 group/btn border-none"
                      >
                        {isConnecting ? <><RefreshCw size={24} className="animate-spin" /> {t('socialPage.negotiating')}</> : <><Link2 size={24} className="group-hover/btn:rotate-45 transition-transform duration-500" /> {t('socialPage.establishUplink')}</>}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Technical Registry HUD */}
        <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-12 relative z-10 shadow-xl group">
           <div className="flex items-center gap-8">
              <div className="w-16 h-16 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 shadow-inner group-hover:rotate-12 transition-transform">
                 <Database size={28} />
              </div>
              <div>
                 <h4 className="text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter leading-none mb-1">{t('socialPage.globalRegistryMatrix')}</h4>
                 <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic">{t('socialPage.secureOauthConnection')}</p>
              </div>
           </div>
           <div className="flex items-center gap-10">
              <div className="text-right">
                 <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic mb-2">{t('socialPage.lastGlobalSync')}</p>
                 <p className="text-sm font-black text-surface-900 dark:text-white uppercase italic tabular-nums">{new Date().toLocaleTimeString().toUpperCase()}</p>
              </div>
              <div className="h-12 w-[2px] bg-surface-100 dark:bg-surface-800 rounded-full" />
              <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl">
                 <Shield size={18} className="text-emerald-500" />
                 <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">{t('socialPage.encrypted256')}</span>
              </div>
           </div>
        </section>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
