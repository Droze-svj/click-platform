'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Gem, Zap, ArrowLeft, ArrowRight, Activity, CreditCard, Receipt,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Crown,
  Database, Video, FileText, Calendar, Clock, RefreshCw, Download
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, CardSkeleton } from '../../../components/LoadingSkeleton'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { PLANS, buildCheckoutTarget, type BillingPeriod, type Plan as CanonicalPlan } from '../../../lib/plans'

interface UsageRecord {
  videosProcessed?: number
  contentGenerated?: number
  quotesCreated?: number
  postsScheduled?: number
  storageUsedMb?: number
  aiCreditsUsed?: number
  [k: string]: any
}

interface UsageLimits {
  videosProcessed?: number | null
  contentGenerated?: number | null
  quotesCreated?: number | null
  postsScheduled?: number | null
  storageUsedMb?: number | null
  aiCreditsUsed?: number | null
}

interface Invoice {
  _id?: string
  id?: string
  amount?: number
  currency?: string
  status?: string
  createdAt?: string
  description?: string
}

const BILLING_PERIOD: BillingPeriod = 'monthly'

function fmtNumber(n?: number) { if (n == null) return '0'; return n.toLocaleString() }
function fmtCurrency(n?: number, cur = 'USD') { if (n == null) return '—'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n / 100) }

export default function BillingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [usage, setUsage] = useState<UsageRecord>({})
  const [limits, setLimits] = useState<UsageLimits>({})
  const [history, setHistory] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradingId, setUpgradingId] = useState<string | null>(null)

  const currentPlan = (user?.subscription?.plan || 'starter').toLowerCase()
  const subStatus = user?.subscription?.status || 'inactive'

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [u, h]: any[] = await Promise.allSettled([apiGet('/billing/usage/stats'), apiGet('/billing/history')]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null))
      const usageBody = u?.data ?? u
      setUsage(usageBody?.usage ?? usageBody ?? {})
      setLimits(usageBody?.limits ?? {})
      const histBody = h?.data ?? h
      const hist = Array.isArray(histBody) ? histBody : (histBody?.invoices ?? histBody?.history ?? [])
      setHistory(Array.isArray(hist) ? hist : [])
    } catch {
      showToast(t('billingPage.loadFailed'), 'error')
    } finally { setLoading(false) }
  }, [showToast, t])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadAll()
  }, [user, authLoading, router, loadAll])

  const handleUpgrade = async (plan: CanonicalPlan) => {
    if (plan.id === currentPlan) return
    setUpgradingId(plan.id)
    try {
      const target = buildCheckoutTarget(plan, BILLING_PERIOD, user || null)
      if (target.kind === 'whop') {
        window.location.href = target.href
        return
      }
      const res: any = await apiPost('/billing/upgrade', { planId: plan.id })
      const url = res?.data?.checkoutUrl || res?.checkoutUrl
      if (url) { window.location.href = url; return }
      showToast(t('billingPage.upgradeInitiated', { plan: plan.id.toUpperCase() }), 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || t('billingPage.upgradeRejected'), 'error')
    } finally { setUpgradingId(null) }
  }

  const meters = [
    { label: t('billingPage.meterVideosProcessed'),  used: usage.videosProcessed,  cap: limits.videosProcessed,  icon: Video,    color: 'text-rose-600 dark:text-rose-400',    bar: 'bg-rose-500' },
    { label: t('billingPage.meterAiGenerations'),    used: usage.contentGenerated, cap: limits.contentGenerated, icon: Sparkles, color: 'text-primary-600 dark:text-primary-400',  bar: 'bg-primary-500' },
    { label: t('billingPage.meterPostsScheduled'),   used: usage.postsScheduled,   cap: limits.postsScheduled,   icon: Calendar, color: 'text-amber-600 dark:text-amber-400',   bar: 'bg-amber-500' },
    { label: t('billingPage.meterQuoteCards'),       used: usage.quotesCreated,    cap: limits.quotesCreated,    icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
    { label: t('billingPage.meterStorage'),      used: usage.storageUsedMb,    cap: limits.storageUsedMb,    icon: Database, color: 'text-violet-600 dark:text-violet-400',  bar: 'bg-violet-500' },
    { label: t('billingPage.meterAiCredits'),        used: usage.aiCreditsUsed,    cap: limits.aiCreditsUsed,    icon: Zap,      color: 'text-cyan-600 dark:text-cyan-400',    bar: 'bg-cyan-500' },
  ]

  if (loading) return (
    <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-8 pt-12 max-w-[1700px] mx-auto space-y-16 bg-surface-page transition-colors duration-500" aria-busy="true" aria-label={t('billingPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-8 pt-12 max-w-[1700px] mx-auto space-y-16 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 border-b border-surface-200 dark:border-surface-800 pb-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title={t('billingPage.back')} className="w-16 h-16 rounded-[1.8rem] bg-surface-card border border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center shadow-lg">
              <Gem size={40} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-amber-500 dark:text-amber-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-amber-500 dark:text-amber-400 italic leading-none">{t('billingPage.sovereignLedger')}</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-3">{t('billingPage.title')}</h1>
              <p className="text-surface-500 dark:text-slate-400 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">{t('billingPage.subtitle')}</p>
            </div>
          </div>
          <div className="bg-surface-card backdrop-blur-3xl px-8 py-5 rounded-[2.5rem] flex items-center gap-5 border border-surface-200 dark:border-amber-500/20 shadow-xl">
            <div className={`w-3 h-3 rounded-full ${subStatus === 'active' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : subStatus === 'trial' ? 'bg-amber-500 animate-pulse' : 'bg-surface-300 dark:bg-slate-500'}`} />
            <div>
              <p className="text-[9px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none mb-1">{t('billingPage.currentTier')}</p>
              <p className="text-xl font-black text-surface-900 dark:text-white italic uppercase tracking-tight leading-none">{currentPlan} · <span className={subStatus === 'active' ? 'text-emerald-600 dark:text-emerald-400' : subStatus === 'trial' ? 'text-amber-600 dark:text-amber-400' : 'text-surface-400 dark:text-slate-500'}>{subStatus.toUpperCase()}</span></p>
            </div>
          </div>
        </header>

        {/* Usage meters */}
        <section className="bg-surface-card backdrop-blur-3xl rounded-[3rem] overflow-hidden border border-surface-200 dark:border-surface-800 shadow-xl transition-all duration-500">
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-surface-100 dark:border-white/5 bg-surface-page/30 dark:bg-white/[0.01]">
            <div className="w-14 h-14 rounded-[1.4rem] bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <TrendingUp size={26} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">{t('billingPage.consumptionMeters')}</h2>
              <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{t('billingPage.currentBillingCycle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-10">
            {meters.map(m => {
              const pct = m.cap && m.cap > 0 ? Math.min(100, Math.round(((m.used || 0) / m.cap) * 100)) : 0
              const overage = m.cap != null && (m.used || 0) > m.cap
              return (
                <div key={m.label} className="bg-surface-page dark:bg-white/[0.02] border border-surface-200 dark:border-white/10 rounded-[2rem] p-7 flex flex-col gap-4 transition-all duration-500 hover:bg-surface-card hover:shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[1rem] bg-surface-card dark:bg-white/[0.03] border border-surface-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                        <m.icon size={22} className={m.color} />
                      </div>
                      <p className="text-[10px] font-black text-surface-500 dark:text-slate-400 uppercase tracking-[0.4em] italic leading-none">{m.label}</p>
                    </div>
                    {overage && <span className="text-[8px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-[0.3em] italic flex items-center gap-1"><AlertTriangle size={10} /> {t('billingPage.over')}</span>}
                  </div>
                  <div className="flex items-end gap-3">
                    <p className={`text-4xl font-black italic tabular-nums tracking-tighter leading-none ${m.color}`}>{fmtNumber(m.used)}</p>
                    {m.cap != null && <p className="text-[12px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] italic mb-1 leading-none">/ {m.cap === -1 ? '∞' : fmtNumber(m.cap)}</p>}
                  </div>
                  {m.cap && m.cap > 0 && (
                    <div className="h-2 rounded-full bg-surface-200 dark:bg-white/5 overflow-hidden shadow-inner">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full ${overage ? 'bg-rose-500' : m.bar}`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Plans */}
        <section className="bg-surface-card backdrop-blur-3xl rounded-[3rem] overflow-hidden border border-surface-200 dark:border-surface-800 shadow-xl transition-all duration-500">
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-surface-100 dark:border-white/5 bg-surface-page/30 dark:bg-white/[0.01]">
            <div className="w-14 h-14 rounded-[1.4rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Crown size={26} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">{t('billingPage.tierSelector')}</h2>
              <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{t('billingPage.tierSelectorSubtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 p-10">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan || (plan.id === 'free' && currentPlan === 'starter')
              const isUpgrading = upgradingId === plan.id
              const includedFeatures = plan.features.filter(f => f.included)
              const PlanIcon = plan.icon
              return (
                <div key={plan.id} className={`bg-surface-page dark:bg-white/[0.02] border border-surface-200 dark:border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 relative transition-all duration-500 hover:bg-surface-card hover:shadow-2xl ${plan.featured ? 'ring-2 ring-primary-500/40 shadow-xl' : ''} ${isCurrent ? 'ring-2 ring-emerald-500/40' : ''}`}>
                  {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-600 text-white text-[9px] font-black uppercase tracking-[0.4em] italic shadow-lg">{t('billingPage.recommended')}</span>}
                  {isCurrent && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.4em] italic">{t('billingPage.currentTier')}</span>}
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-[1.4rem] bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg border border-black/10`}>
                      <PlanIcon size={26} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">{plan.name}</h3>
                      <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] italic mt-2 leading-none">{plan.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="text-5xl font-black text-surface-900 dark:text-white italic tabular-nums tracking-tighter leading-none">${plan.priceMonthly}</p>
                    <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] italic mb-2 leading-none">{t('billingPage.perMonth')}</p>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {includedFeatures.map(f => (
                      <li key={f.label} className="flex items-start gap-3 text-[11px] text-surface-600 dark:text-slate-300 leading-relaxed font-bold italic uppercase tracking-tight">
                        <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled={isCurrent || isUpgrading} onClick={() => handleUpgrade(plan)} className={`mt-auto py-4 rounded-full text-[11px] font-black uppercase tracking-[0.4em] italic transition-all flex items-center justify-center gap-3 active:scale-95 border-none ${isCurrent ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default' : plan.featured ? 'bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white shadow-lg' : 'bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 text-surface-500 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-white/10 shadow-sm'} disabled:opacity-60`}>
                    {isCurrent ? t('billingPage.activeTier') : isUpgrading ? <><RefreshCw size={14} className="animate-spin" /> {t('billingPage.routing')}</> : <>{plan.cta.label.toUpperCase().replace(/ /g, '_')} <ArrowRight size={14} /></>}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* History */}
        <section className="bg-surface-card backdrop-blur-3xl rounded-[3rem] overflow-hidden border border-surface-200 dark:border-surface-800 shadow-xl transition-all duration-500">
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-surface-100 dark:border-white/5 bg-surface-page/30 dark:bg-white/[0.01]">
            <div className="w-14 h-14 rounded-[1.4rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Receipt size={26} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">{t('billingPage.ledgerHistory')}</h2>
              <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{t('billingPage.invoicesLogged', { count: history.length })}</p>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-center gap-6 opacity-20">
              <Clock size={64} className="text-surface-900 dark:text-white" />
              <div className="space-y-2">
                 <p className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tight">{t('billingPage.ledgerEmpty')}</p>
                 <p className="text-[11px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic">{t('billingPage.noInvoices')}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-white/[0.04] bg-surface-page/5">
              {history.map((inv, i) => (
                <div key={inv._id || inv.id || i} className="flex items-center gap-6 px-10 py-6 hover:bg-surface-page dark:hover:bg-white/[0.02] transition-colors group">
                  <div className="w-12 h-12 rounded-[1rem] bg-surface-card dark:bg-white/[0.03] border border-surface-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                    <CreditCard size={20} className="text-surface-400 dark:text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-surface-900 dark:text-white italic uppercase tracking-tight leading-none mb-1.5 truncate">{inv.description || t('billingPage.subscriptionRenewal')}</p>
                    <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] italic leading-none">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <p className="text-2xl font-black text-surface-900 dark:text-white italic tabular-nums tracking-tight">{fmtCurrency(inv.amount, inv.currency || 'USD')}</p>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] italic border shadow-inner ${inv.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : inv.status === 'failed' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'}`}>
                    {(inv.status || 'PENDING').toUpperCase()}
                  </span>
                  <button type="button" title={t('billingPage.downloadInvoice')} className="w-10 h-10 rounded-[1rem] bg-surface-card dark:bg-white/[0.03] border border-surface-200 dark:border-white/10 text-surface-400 hover:text-surface-900 dark:hover:text-white flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-sm">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
