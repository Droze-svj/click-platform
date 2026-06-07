'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, ArrowRight, CreditCard, Receipt,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Crown,
  Database, Video, FileText, Calendar, Clock, RefreshCw, Download,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, CardSkeleton } from '../../../components/LoadingSkeleton'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { PLANS, buildCheckoutTarget, type BillingPeriod, type Plan as CanonicalPlan } from '../../../lib/plans'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

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
    { label: t('billingPage.meterVideosProcessed'),  used: usage.videosProcessed,  cap: limits.videosProcessed,  icon: Video,    accent: 'text-rose-500 bg-rose-500/10',    bar: 'bg-rose-500' },
    { label: t('billingPage.meterAiGenerations'),    used: usage.contentGenerated, cap: limits.contentGenerated, icon: Sparkles, accent: 'text-indigo-500 bg-indigo-500/10', bar: 'bg-indigo-500' },
    { label: t('billingPage.meterPostsScheduled'),   used: usage.postsScheduled,   cap: limits.postsScheduled,   icon: Calendar, accent: 'text-amber-500 bg-amber-500/10',   bar: 'bg-amber-500' },
    { label: t('billingPage.meterQuoteCards'),       used: usage.quotesCreated,    cap: limits.quotesCreated,    icon: FileText, accent: 'text-emerald-500 bg-emerald-500/10', bar: 'bg-emerald-500' },
    { label: t('billingPage.meterStorage'),          used: usage.storageUsedMb,    cap: limits.storageUsedMb,    icon: Database, accent: 'text-violet-500 bg-violet-500/10', bar: 'bg-violet-500' },
    { label: t('billingPage.meterAiCredits'),        used: usage.aiCreditsUsed,    cap: limits.aiCreditsUsed,    icon: Zap,      accent: 'text-cyan-500 bg-cyan-500/10',    bar: 'bg-cyan-500' },
  ]

  if (loading) return (
    <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-6" aria-busy="true" aria-label={t('billingPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* Header (global DashboardHeader provides breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('billingPage.title')}
          description={t('billingPage.subtitle')}
          className="mb-6"
          actions={
            <Panel variant="subtle" className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn('h-2.5 w-2.5 rounded-full',
                subStatus === 'active' ? 'bg-emerald-500' : subStatus === 'trial' ? 'bg-amber-500' : 'bg-theme-muted')} />
              <div>
                <p className="ds-text-caption">{t('billingPage.currentTier')}</p>
                <p className="ds-text-label text-theme-primary capitalize">
                  {currentPlan} · <span className={subStatus === 'active' ? 'text-emerald-500' : subStatus === 'trial' ? 'text-amber-500' : 'text-theme-muted'}>{subStatus}</span>
                </p>
              </div>
            </Panel>
          }
        />

        <div className="space-y-6">
          {/* Usage meters (real /billing/usage/stats) */}
          <Panel variant="bento">
            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-[var(--border-subtle)]">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <TrendingUp size={20} aria-hidden />
              </span>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.consumptionMeters')}</h2>
                <p className="ds-text-caption">{t('billingPage.currentBillingCycle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {meters.map(m => {
                const pct = m.cap && m.cap > 0 ? Math.min(100, Math.round(((m.used || 0) / m.cap) * 100)) : 0
                const overage = m.cap != null && (m.used || 0) > m.cap
                const MIcon = m.icon
                return (
                  <div key={m.label} className="ds-surface-subtle p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', m.accent)}>
                          <MIcon size={18} aria-hidden />
                        </span>
                        <p className="ds-text-label text-theme-secondary truncate">{m.label}</p>
                      </div>
                      {overage && (
                        <span className="ds-text-caption inline-flex items-center gap-1 text-rose-500">
                          <AlertTriangle size={11} aria-hidden /> {t('billingPage.over')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <p className="ds-text-h2 text-theme-primary tabular-nums leading-none">{fmtNumber(m.used)}</p>
                      {m.cap != null && (
                        <p className="ds-text-caption mb-1">/ {m.cap === -1 ? '∞' : fmtNumber(m.cap)}</p>
                      )}
                    </div>
                    {m.cap && m.cap > 0 ? (
                      <div className="h-1.5 rounded-full bg-theme-muted/15 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', overage ? 'bg-rose-500' : m.bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Plans (real lib/plans PLANS) */}
          <Panel variant="bento">
            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-[var(--border-subtle)]">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Crown size={20} aria-hidden />
              </span>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.tierSelector')}</h2>
                <p className="ds-text-caption">{t('billingPage.tierSelectorSubtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {PLANS.map(plan => {
                const isCurrent = plan.id === currentPlan || (plan.id === 'free' && currentPlan === 'starter')
                const isUpgrading = upgradingId === plan.id
                const includedFeatures = plan.features.filter(f => f.included)
                const PlanIcon = plan.icon
                return (
                  <div key={plan.id} className={cn('ds-surface-subtle p-6 flex flex-col gap-4 relative',
                    plan.featured && 'ring-2 ring-primary/40',
                    isCurrent && 'ring-2 ring-emerald-500/40')}
                  >
                    {plan.featured && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">{t('billingPage.recommended')}</span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{t('billingPage.currentTier')}</span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', plan.gradient)}>
                        <PlanIcon size={22} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="ds-text-h3 text-theme-primary truncate">{plan.name}</h3>
                        <p className="ds-text-caption truncate">{plan.tagline}</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <p className="ds-text-display text-theme-primary tabular-nums leading-none">${plan.priceMonthly}</p>
                      <p className="ds-text-caption mb-1.5">{t('billingPage.perMonth')}</p>
                    </div>
                    <ul className="space-y-2 flex-1">
                      {includedFeatures.map(f => (
                        <li key={f.label} className="flex items-start gap-2 ds-text-caption text-theme-secondary">
                          <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" aria-hidden />
                          <span>{f.label}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={isCurrent ? 'ghost' : plan.featured ? 'primary' : 'secondary'}
                      size="md"
                      className="w-full mt-auto"
                      disabled={isCurrent || isUpgrading}
                      loading={isUpgrading}
                      onClick={() => handleUpgrade(plan)}
                      rightIcon={!isCurrent && !isUpgrading ? <ArrowRight size={14} aria-hidden /> : undefined}
                    >
                      {isCurrent ? t('billingPage.activeTier') : isUpgrading ? t('billingPage.routing') : plan.cta.label}
                    </Button>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* History (real /billing/history) */}
          <Panel variant="bento" className="p-0">
            <div className="flex items-center gap-3 p-5 border-b border-[var(--border-subtle)]">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Receipt size={20} aria-hidden />
              </span>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.ledgerHistory')}</h2>
                <p className="ds-text-caption">{t('billingPage.invoicesLogged', { count: history.length })}</p>
              </div>
            </div>
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('billingPage.ledgerEmpty')}
                description={t('billingPage.noInvoices')}
                className="py-16"
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {history.map((inv, i) => (
                  <li key={inv._id || inv.id || i} className="flex items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-accent transition-colors">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                      <CreditCard size={18} aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="ds-text-label text-theme-primary truncate">{inv.description || t('billingPage.subscriptionRenewal')}</p>
                      <p className="ds-text-caption">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}</p>
                    </div>
                    <p className="ds-text-label text-theme-primary tabular-nums whitespace-nowrap">{fmtCurrency(inv.amount, inv.currency || 'USD')}</p>
                    <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
                      inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500'
                        : inv.status === 'failed' ? 'bg-rose-500/10 text-rose-500'
                        : 'bg-amber-500/10 text-amber-500')}>
                      {inv.status || 'pending'}
                    </span>
                    <IconButton variant="ghost" size="sm" aria-label={t('billingPage.downloadInvoice')} className="flex-shrink-0 hidden sm:inline-flex">
                      <Download size={16} aria-hidden />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </ErrorBoundary>
  )
}
