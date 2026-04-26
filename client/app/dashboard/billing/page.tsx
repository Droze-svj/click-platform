'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Gem, Zap, ArrowLeft, ArrowRight, Activity, CreditCard, Receipt,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Crown, Rocket,
  Database, Video, FileText, Calendar, Clock, RefreshCw, Download
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

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

interface Plan {
  id: string
  name: string
  price: number
  period: 'mo' | 'yr'
  tagline: string
  highlights: string[]
  recommended?: boolean
  icon: any
  gradient: string
}

const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', price: 0, period: 'mo',
    tagline: 'For trying Click without commitment.',
    highlights: ['10 video clips/mo', '50 AI generations/mo', 'Basic analytics', '1 social account'],
    icon: Sparkles, gradient: 'from-slate-600 to-slate-900',
  },
  {
    id: 'pro', name: 'Pro', price: 29, period: 'mo',
    tagline: 'For solo creators publishing weekly.',
    highlights: ['Unlimited clips', '500 AI generations/mo', 'Full analytics + insights', '5 social accounts', 'Brand kit + templates'],
    recommended: true,
    icon: Rocket, gradient: 'from-indigo-600 to-violet-700',
  },
  {
    id: 'agency', name: 'Agency', price: 99, period: 'mo',
    tagline: 'For teams managing multiple brands.',
    highlights: ['Everything in Pro', 'Unlimited AI generations', 'Workspaces + brand switching', '25 social accounts', 'Approval workflows', 'Priority support'],
    icon: Crown, gradient: 'from-amber-500 to-rose-600',
  },
]

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.6)] transition-all duration-300'

function fmtNumber(n?: number) { if (n == null) return '0'; return n.toLocaleString() }
function fmtCurrency(n?: number, cur = 'USD') { if (n == null) return '—'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n / 100) }

export default function BillingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
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
      showToast('LEDGER_SYNC_ERR: BILLING_NODE_OFFLINE', 'error')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadAll()
  }, [user, authLoading, router, loadAll])

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return
    setUpgradingId(planId)
    try {
      const res: any = await apiPost('/billing/upgrade', { planId })
      const url = res?.data?.checkoutUrl || res?.checkoutUrl
      if (url) { window.location.href = url; return }
      showToast(`✓ PLAN_UPGRADE_INITIATED: ${planId.toUpperCase()}`, 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'UPGRADE_REJECTED: PAYMENT_GATEWAY_OFFLINE', 'error')
    } finally { setUpgradingId(null) }
  }

  const meters = [
    { label: 'Videos Processed',  used: usage.videosProcessed,  cap: limits.videosProcessed,  icon: Video,    color: 'text-rose-400',    bar: 'bg-rose-500' },
    { label: 'AI Generations',    used: usage.contentGenerated, cap: limits.contentGenerated, icon: Sparkles, color: 'text-indigo-400',  bar: 'bg-indigo-500' },
    { label: 'Posts Scheduled',   used: usage.postsScheduled,   cap: limits.postsScheduled,   icon: Calendar, color: 'text-amber-400',   bar: 'bg-amber-500' },
    { label: 'Quote Cards',       used: usage.quotesCreated,    cap: limits.quotesCreated,    icon: FileText, color: 'text-emerald-400', bar: 'bg-emerald-500' },
    { label: 'Storage (MB)',      used: usage.storageUsedMb,    cap: limits.storageUsedMb,    icon: Database, color: 'text-violet-400',  bar: 'bg-violet-500' },
    { label: 'AI Credits',        used: usage.aiCreditsUsed,    cap: limits.aiCreditsUsed,    icon: Zap,      color: 'text-cyan-400',    bar: 'bg-cyan-500' },
  ]

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-10 backdrop-blur-3xl">
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 animate-pulse" />
        <Gem size={80} className="text-amber-500 animate-spin relative z-10" />
      </div>
      <p className="text-[12px] font-black text-amber-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Resolving Ledger Vector...</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-16 bg-[#020205]">
        <ToastContainer />

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back" className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:border-rose-500/50">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl">
              <Gem size={40} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-amber-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-amber-400 italic leading-none">Sovereign Ledger</span>
              </div>
              <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Billing & Usage</h1>
              <p className="text-slate-500 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">Plan tier · consumption meters · ledger history.</p>
            </div>
          </div>
          <div className={`${glassStyle} px-8 py-5 rounded-[2.5rem] flex items-center gap-5 border-amber-500/20`}>
            <div className={`w-3 h-3 rounded-full ${subStatus === 'active' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : subStatus === 'trial' ? 'bg-amber-500 animate-pulse' : 'bg-slate-500'}`} />
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none mb-1">CURRENT_TIER</p>
              <p className="text-xl font-black text-white italic uppercase tracking-tight leading-none">{currentPlan} · <span className={subStatus === 'active' ? 'text-emerald-400' : subStatus === 'trial' ? 'text-amber-400' : 'text-slate-400'}>{subStatus}</span></p>
            </div>
          </div>
        </div>

        {/* Usage meters */}
        <div className={`${glassStyle} rounded-[3rem] overflow-hidden`}>
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-white/5">
            <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <TrendingUp size={26} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Consumption Meters</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">CURRENT_BILLING_CYCLE</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-10">
            {meters.map(m => {
              const pct = m.cap && m.cap > 0 ? Math.min(100, Math.round(((m.used || 0) / m.cap) * 100)) : 0
              const overage = m.cap != null && (m.used || 0) > m.cap
              return (
                <div key={m.label} className={`${glassStyle} rounded-[2rem] p-7 flex flex-col gap-4 ${overage ? 'border-rose-500/30' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-white/[0.03] border border-white/10 flex items-center justify-center">
                      <m.icon size={22} className={m.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">{m.label}</p>
                    </div>
                    {overage && <span className="text-[8px] font-black text-rose-400 uppercase tracking-[0.3em] italic flex items-center gap-1"><AlertTriangle size={10} /> OVER</span>}
                  </div>
                  <div className="flex items-end gap-3">
                    <p className={`text-4xl font-black italic tabular-nums tracking-tighter leading-none ${m.color}`}>{fmtNumber(m.used)}</p>
                    {m.cap != null && <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em] italic mb-1 leading-none">/ {m.cap === -1 ? '∞' : fmtNumber(m.cap)}</p>}
                  </div>
                  {m.cap && m.cap > 0 && (
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full ${overage ? 'bg-rose-500' : m.bar}`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Plans */}
        <div className={`${glassStyle} rounded-[3rem] overflow-hidden`}>
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-white/5">
            <div className="w-14 h-14 rounded-[1.4rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Crown size={26} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Tier Selector</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">UPGRADE · DOWNGRADE · COMMIT</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-10">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan
              const isUpgrading = upgradingId === plan.id
              return (
                <div key={plan.id} className={`${glassStyle} rounded-[2.5rem] p-8 flex flex-col gap-6 relative ${plan.recommended ? 'border-indigo-500/40 shadow-[0_0_80px_rgba(99,102,241,0.15)]' : ''} ${isCurrent ? 'ring-2 ring-emerald-500/40' : ''}`}>
                  {plan.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.4em] italic shadow-[0_10px_30px_rgba(99,102,241,0.4)]">RECOMMENDED</span>}
                  {isCurrent && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.4em] italic">CURRENT_TIER</span>}
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-[1.4rem] bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-xl`}>
                      <plan.icon size={26} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{plan.name}</h3>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic mt-2 leading-none">{plan.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="text-6xl font-black text-white italic tabular-nums tracking-tighter leading-none">${plan.price}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic mb-2 leading-none">/ {plan.period}</p>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.highlights.map(h => (
                      <li key={h} className="flex items-start gap-3 text-[11px] text-slate-300 leading-relaxed">
                        <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled={isCurrent || isUpgrading} onClick={() => handleUpgrade(plan.id)} className={`mt-auto py-4 rounded-full text-[11px] font-black uppercase tracking-[0.4em] italic transition-colors flex items-center justify-center gap-3 ${isCurrent ? 'bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/30 cursor-default' : plan.recommended ? 'bg-white text-black hover:bg-indigo-500 hover:text-white' : 'bg-white/5 border-2 border-white/10 text-slate-300 hover:text-white hover:border-white/30'} disabled:opacity-60`}>
                    {isCurrent ? 'ACTIVE_TIER' : isUpgrading ? <><RefreshCw size={14} className="animate-spin" /> ROUTING...</> : <>UPGRADE_TO_{plan.name.toUpperCase()} <ArrowRight size={14} /></>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* History */}
        <div className={`${glassStyle} rounded-[3rem] overflow-hidden`}>
          <div className="flex items-center gap-6 px-10 py-8 border-b-2 border-white/5">
            <div className="w-14 h-14 rounded-[1.4rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Receipt size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Ledger History</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">{history.length} INVOICES_LOGGED</p>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center gap-4">
              <Clock size={48} className="text-slate-500" />
              <p className="text-2xl font-black text-white italic uppercase tracking-tight">Ledger Empty</p>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic">No invoices recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {history.map((inv, i) => (
                <div key={inv._id || inv.id || i} className="flex items-center gap-6 px-10 py-6 hover:bg-white/[0.02] transition-colors">
                  <div className="w-12 h-12 rounded-[1rem] bg-white/[0.03] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-white italic uppercase tracking-tight leading-none mb-1.5 truncate">{inv.description || 'Subscription Renewal'}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-none">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <p className="text-2xl font-black text-white italic tabular-nums tracking-tight">{fmtCurrency(inv.amount, inv.currency || 'USD')}</p>
                  <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] italic border ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : inv.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                    {(inv.status || 'PENDING').toUpperCase()}
                  </span>
                  <button type="button" title="Download invoice" className="w-10 h-10 rounded-[1rem] bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
