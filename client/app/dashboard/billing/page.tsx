'use client'

import { loginPathForCurrentPage } from '../../../lib/authRedirect'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, ArrowRight, CreditCard, Receipt,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Crown,
  Database, Video, FileText, Calendar, Clock, Download, FlaskConical,
  ShieldCheck, Lock, RefreshCw, Scale, ExternalLink, HelpCircle,
  ChevronDown, ChevronUp, Shield,
} from 'lucide-react'
import Link from 'next/link'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import SubscriptionStatus from '../../../components/SubscriptionStatus'
import { StatsCardSkeleton, CardSkeleton } from '../../../components/LoadingSkeleton'
import { apiGet, apiPost, api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import {
  PLANS,
  buildCheckoutTarget,
  fetchPublicCatalog,
  earlyAccessFeatures,
  formatPrice,
  formatPriceCadence,
  yearlySavingsPct,
  type BillingPeriod,
  type Plan as CanonicalPlan,
  type CatalogFeature,
} from '../../../lib/plans'
import { accountCheckoutUrl } from '../../../lib/checkout'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  EmptyState,
  SectionHeader,
  PageShell,
  Modal,
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
  videosProcessed?: number
  contentGenerated?: number
  quotesCreated?: number
  postsScheduled?: number
  storageUsedMb?: number
  aiCreditsUsed?: number
  [k: string]: any
}

interface Invoice {
  id?: string
  _id?: string
  invoiceNumber?: string
  amount?: number
  currency?: string
  status?: string
  createdAt?: string
  description?: string
  invoice?: {
    date?: string
    amount?: {
      total?: number
      currency?: string
    }
    items?: Array<{ description?: string; total?: number }>
  }
  payment?: {
    transactionId?: string
    paidAt?: string
    status?: string
  }
  [k: string]: any
}

// Question/answer translation keys; translated where rendered.
const BILLING_LEGAL_FAQS = [
  { q: 'billingPage.faq1Q', a: 'billingPage.faq1A' },
  { q: 'billingPage.faq2Q', a: 'billingPage.faq2A' },
  { q: 'billingPage.faq3Q', a: 'billingPage.faq3A' },
  { q: 'billingPage.faq4Q', a: 'billingPage.faq4A' },
  { q: 'billingPage.faq5Q', a: 'billingPage.faq5A' },
  { q: 'billingPage.faq6Q', a: 'billingPage.faq6A' },
]

function fmtNumber(n?: number) { if (n == null) return '0'; return n.toLocaleString() }
// Invoice totals are stored in major units (dollars), as the Whop webhook
// records them; dividing by 100 showed a $29 invoice as $0.29.
function fmtCurrency(n?: number, cur = 'USD') { if (n == null) return '—'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n) }

export default function BillingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { tier: entTier, isEarlyAccess } = useEntitlements()
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [usage, setUsage] = useState<UsageRecord>({})
  const [limits, setLimits] = useState<UsageLimits>({})
  const [history, setHistory] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradingId, setUpgradingId] = useState<string | null>(null)
  const [earlyAccess, setEarlyAccess] = useState<CatalogFeature[]>([])
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<CanonicalPlan | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [showManageModal, setShowManageModal] = useState(false)
  const [manageTab, setManageTab] = useState<'cancel' | 'refund'>('cancel')
  const [manageReason, setManageReason] = useState('Not using enough')
  const [manageDetails, setManageDetails] = useState('')
  const [manageLoading, setManageLoading] = useState(false)

  const handleCancelSubscription = async () => {
    try {
      setManageLoading(true)
      const res: any = await apiPost('/billing/cancel', {})
      const msg = res?.data?.message || res?.message || t('billingPage.toastCancelled')
      showToast(msg, 'success')
      setShowManageModal(false)
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || t('billingPage.toastCancelFailed'), 'error')
    } finally {
      setManageLoading(false)
    }
  }

  // window.open() can't send the Authorization header, so the download 401'd.
  // Fetch the PDF through the API client and save it.
  const downloadInvoice = async (invoiceNumber: string) => {
    try {
      const res = await api.get(`/billing/invoices/${encodeURIComponent(invoiceNumber)}/download`, { responseType: 'blob' })
      const blob: Blob = res.data
      if (blob.type && !blob.type.includes('pdf')) {
        // JSON answer: a stored PDF URL.
        const body = JSON.parse(await blob.text())
        const url = body?.data?.url
        if (url) { window.open(url, '_blank', 'noopener'); return }
        throw new Error('no pdf')
      }
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `invoice-${invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10000)
    } catch {
      showToast(t('billingPage.invoiceDownloadFailed'), 'error')
    }
  }

  const handleRequestRefund = async () => {
    try {
      setManageLoading(true)
      const res: any = await apiPost('/billing/refund-request', {
        reason: manageReason,
        details: manageDetails,
      })
      const msg = res?.data?.message || res?.message || t('billingPage.toastRefundSubmitted')
      showToast(msg, 'success')
      setShowManageModal(false)
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || t('billingPage.toastRefundFailed'), 'error')
    } finally {
      setManageLoading(false)
    }
  }

  // Derive the current plan from the canonical resolved entitlements tier
  // (free/creator/pro/agency) — NOT the raw subscription.plan, which can be a
  // legacy/blank value. entTier is the single source of truth the server
  // already resolved for this user; default to 'free', never 'starter'.
  const currentPlan = entTier || 'free'
  const subStatus = user?.subscription?.status || (entTier !== 'free' ? 'active' : 'inactive')
  const userCycle = user?.subscription?.billingCycle || 'monthly'

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [u, h]: any[] = await Promise.allSettled([apiGet('/billing/usage'), apiGet('/billing/history')]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null))
      const usageBody = u?.data ?? u
      setUsage(usageBody?.usage ?? {})
      setLimits(usageBody?.limits ?? {})
      const histBody = h?.data ?? h
      // Real invoices (BillingHistory, written by the Whop webhook) come back as
      // `invoices`; the server used to send only `changes`, so this list was
      // always empty.
      const hist = Array.isArray(histBody) ? histBody : (histBody?.invoices ?? histBody?.history ?? [])
      setHistory(Array.isArray(hist) ? hist : [])
    } catch {
      showToast(t('billingPage.loadFailed'), 'error')
    } finally { setLoading(false) }
  }, [showToast, t])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push(loginPathForCurrentPage()); return }
    loadAll()
  }, [user, authLoading, router, loadAll])

  // Real early-access feature list from the canonical catalog (GET /api/plans).
  useEffect(() => {
    let alive = true
    fetchPublicCatalog().then((cat) => {
      if (alive && cat) setEarlyAccess(earlyAccessFeatures(cat))
    })
    return () => { alive = false }
  }, [])

  const handlePlanSelect = (plan: CanonicalPlan) => {
    if (plan.id === currentPlan) return
    if (plan.id === 'free') {
      // Moving to Free = cancelling the paid plan. This used to POST
      // /billing/upgrade, which only records a pending change nothing ever
      // completes, and then said "Upgrade started". The cancel dialog calls
      // POST /billing/cancel, which stops the renewal at Whop (or explains how
      // to cancel on whop.com when it can't).
      setManageTab('cancel')
      setShowManageModal(true)
      return
    }
    setSelectedPlanForCheckout(plan)
    setAgreedToTerms(false)
  }

  const handleUpgrade = async (plan: CanonicalPlan) => {
    setUpgradingId(plan.id)
    try {
      const target = buildCheckoutTarget(plan, billingPeriod, user || null)
      if (target.kind === 'whop') {
        window.location.href = await accountCheckoutUrl(plan.id, billingPeriod, target.href)
        return
      }
      // No checkout link for this plan/period. Plans change only through a
      // Whop checkout (the signed webhook grants the tier), so there is
      // nothing to "start" here — say so instead of reporting success.
      showToast(t('billingPage.checkoutUnavailable'), 'error')
    } catch (e: any) {
      showToast(e?.response?.data?.error || t('billingPage.upgradeRejected'), 'error')
    } finally {
      setUpgradingId(null)
      setSelectedPlanForCheckout(null)
    }
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
      <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen overflow-x-hidden">
        <ToastContainer />

        {/* Header */}
        <SectionHeader
          as="h1"
          title={t('billingPage.title')}
          description={t('billingPage.subtitle')}
          className="mb-6"
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {currentPlan !== 'free' && (
                <>
                  <a
                    href="https://whop.com/hub/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl ds-surface-subtle hover:bg-accent text-theme-primary transition-colors border border-[var(--border-subtle)] shadow-sm"
                    title={t('billingPage.portalLinkTitle')}
                  >
                    <CreditCard size={14} className="text-primary" />
                    <span>{t('billingPage.portalLink')}</span>
                    <ExternalLink size={12} className="text-theme-muted" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageModal(true)
                      setManageTab('cancel')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl ds-surface-subtle hover:bg-accent text-theme-secondary hover:text-theme-primary transition-colors border border-[var(--border-subtle)]"
                    title={t('billingPage.cancelRefundTitle')}
                  >
                    <RefreshCw size={13} className="text-amber-500" />
                    <span>{t('billingPage.cancelRefund')}</span>
                  </button>
                </>
              )}
              <Panel variant="subtle" className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full',
                  subStatus === 'active' ? 'bg-emerald-500' : subStatus === 'trial' ? 'bg-amber-500' : 'bg-slate-400')} />
                <div>
                  <p className="ds-text-caption">{t('billingPage.currentTier')}</p>
                  <p className="ds-text-label text-theme-primary capitalize">
                    {currentPlan} · <span className={subStatus === 'active' ? 'text-emerald-500' : subStatus === 'trial' ? 'text-amber-500' : 'text-theme-muted'}>{subStatus}</span>
                    {currentPlan !== 'free' && (
                      <span className="text-theme-secondary text-xs font-normal ml-1.5">
                        ({userCycle})
                      </span>
                    )}
                  </p>
                </div>
              </Panel>
            </div>
          }
        />

        <div className="space-y-6">
          {/* Usage meters */}
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
                const overage = m.cap != null && m.cap !== -1 && (m.used || 0) > m.cap
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
                        <p className="ds-text-caption mb-1">/ {m.cap === -1 ? t('billingPage.unlimited') : fmtNumber(m.cap)}</p>
                      )}
                    </div>
                    {m.cap && m.cap > 0 ? (
                      <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', overage ? 'bg-rose-500' : m.bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-1.5 rounded-full bg-emerald-500/15 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500/40 w-full" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Plans selector with cadence toggle */}
          <Panel variant="bento">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Crown size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.tierSelector')}</h2>
                  <p className="ds-text-caption">{t('billingPage.tierSelectorSubtitle')}</p>
                </div>
              </div>

              {/* Monthly / Yearly Cadence Switcher */}
              <div className="inline-flex items-center rounded-xl bg-accent p-1 border border-[var(--border-subtle)] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    billingPeriod === 'monthly'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {t('billingPage.monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('yearly')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                    billingPeriod === 'yearly'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  <span>{t('billingPage.yearly')}</span>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 text-[10px] font-bold">
                    {t('billingPage.saveAbout17')}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {PLANS.map(plan => {
                const isCurrent = plan.id === currentPlan
                const isUpgrading = upgradingId === plan.id
                const includedFeatures = plan.features.filter(f => f.included)
                const PlanIcon = plan.icon
                const savings = yearlySavingsPct(plan)

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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-end gap-1.5">
                        <p className="ds-text-display text-theme-primary tabular-nums leading-none">
                          {formatPrice(plan, billingPeriod)}
                        </p>
                        <p className="ds-text-caption mb-1.5">
                          {formatPriceCadence(billingPeriod)}
                        </p>
                      </div>
                      {billingPeriod === 'yearly' && plan.priceYearly > 0 && (
                        <p className="ds-text-caption text-emerald-500 font-medium">
                          {t('billingPage.billedYearly', { price: `$${plan.priceYearly}` })} {savings > 0 ? `· ${t('billingPage.savePct', { pct: savings })}` : ''}
                        </p>
                      )}
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
                      onClick={() => handlePlanSelect(plan)}
                      rightIcon={!isCurrent && !isUpgrading ? <ArrowRight size={14} aria-hidden /> : undefined}
                    >
                      {isCurrent ? t('billingPage.activeTier') : isUpgrading ? t('billingPage.routing') : plan.cta.label}
                    </Button>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Trust & Guarantees 4-Pillar Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="ds-surface-subtle p-5 rounded-2xl border border-[var(--border-subtle)] flex items-start gap-3.5 shadow-sm">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wide">{t('billingPage.moneyBackGuarantee')}</h4>
                <p className="text-xs text-theme-secondary mt-1 leading-relaxed">
                  {t('billingPage.trustMoneyBackBody')}
                </p>
              </div>
            </div>

            <div className="ds-surface-subtle p-5 rounded-2xl border border-[var(--border-subtle)] flex items-start gap-3.5 shadow-sm">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <RefreshCw size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wide">{t('billingPage.trustCancelTitle')}</h4>
                <p className="text-xs text-theme-secondary mt-1 leading-relaxed">
                  {t('billingPage.trustCancelBody')}
                </p>
              </div>
            </div>

            <div className="ds-surface-subtle p-5 rounded-2xl border border-[var(--border-subtle)] flex items-start gap-3.5 shadow-sm">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                <Lock size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wide">{t('billingPage.trustSecureTitle')}</h4>
                <p className="text-xs text-theme-secondary mt-1 leading-relaxed">
                  {t('billingPage.trustSecureBody')}
                </p>
              </div>
            </div>

            <div className="ds-surface-subtle p-5 rounded-2xl border border-[var(--border-subtle)] flex items-start gap-3.5 shadow-sm">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Scale size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wide">{t('billingPage.trustOwnershipTitle')}</h4>
                <p className="text-xs text-theme-secondary mt-1 leading-relaxed">
                  {t('billingPage.trustOwnershipBody')}
                </p>
              </div>
            </div>
          </div>

          {/* Agency early-access */}
          {earlyAccess.length > 0 && (
            <Panel variant="bento" className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-fuchsia-600/[0.04]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <FlaskConical size={20} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.earlyAccessTitle')}</h2>
                    <p className="ds-text-caption">
                      {currentPlan === 'agency'
                        ? t('billingPage.earlyAccessAvailable')
                        : t('billingPage.earlyAccessLocked')}
                    </p>
                  </div>
                </div>
                <Button
                  variant={currentPlan === 'agency' ? 'secondary' : 'primary'}
                  size="md"
                  className="flex-shrink-0"
                  onClick={() => router.push('/dashboard/labs')}
                  rightIcon={<ArrowRight size={14} aria-hidden />}
                >
                  {currentPlan === 'agency' ? t('billingPage.openLabs') : t('billingPage.exploreLabs')}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {earlyAccess.map((f) => {
                  const unlocked = currentPlan === 'agency' && isEarlyAccess(f.id)
                  return (
                    <div key={f.id} className="ds-surface-subtle p-4 flex items-center gap-3">
                      <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                        unlocked ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                        {unlocked ? <CheckCircle size={17} aria-hidden /> : <Sparkles size={17} aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="ds-text-label text-theme-primary truncate">{f.label}</p>
                        <p className="ds-text-caption">
                          {unlocked ? t('billingPage.earlyAccessOn') : t('billingPage.earlyAccessAgencyOnly')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* History */}
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
                {history.map((inv: any, i) => {
                  const itemDesc = inv.description || inv.invoice?.items?.[0]?.description || t('billingPage.subscriptionRenewal')
                  const itemDate = inv.createdAt || inv.invoice?.date || inv.payment?.paidAt
                  const itemAmount = inv.amount ?? inv.invoice?.amount?.total
                  const itemCurrency = inv.currency || inv.invoice?.amount?.currency || 'USD'
                  const invNum = inv.invoiceNumber || inv.payment?.transactionId || inv.id || inv._id

                  return (
                    <li key={inv._id || inv.id || i} className="flex items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-accent transition-colors">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                        <CreditCard size={18} aria-hidden />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="ds-text-label text-theme-primary truncate">{itemDesc}</p>
                        <p className="ds-text-caption">{itemDate ? new Date(itemDate).toLocaleDateString() : '—'}</p>
                      </div>
                      <p className="ds-text-label text-theme-primary tabular-nums whitespace-nowrap">{fmtCurrency(itemAmount, itemCurrency)}</p>
                      <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500'
                          : inv.status === 'failed' ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-amber-500/10 text-amber-500')}>
                        {inv.status || t('billingPage.statusPending')}
                      </span>
                      {invNum && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label={t('billingPage.downloadInvoice')}
                          className="flex-shrink-0 hidden sm:inline-flex"
                          onClick={() => downloadInvoice(String(invNum))}
                        >
                          <Download size={16} aria-hidden />
                        </IconButton>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* Billing & Legal Compliance FAQ Accordion */}
          <Panel variant="bento">
            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-[var(--border-subtle)]">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HelpCircle size={20} aria-hidden />
              </span>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('billingPage.faqTitle')}</h2>
                <p className="ds-text-caption">{t('billingPage.faqSubtitle')}</p>
              </div>
            </div>

            <div className="space-y-3">
              {BILLING_LEGAL_FAQS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div
                    key={idx}
                    className="ds-surface-subtle rounded-xl border border-[var(--border-subtle)] overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 p-4 text-left font-medium text-sm text-theme-primary hover:bg-accent/40 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-primary font-mono">0{idx + 1}.</span>
                        <span>{t(faq.q)}</span>
                      </span>
                      {isOpen ? (
                        <ChevronUp size={16} className="text-theme-muted flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-theme-muted flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-xs text-theme-secondary leading-relaxed border-t border-[var(--border-subtle)]/50">
                        {t(faq.a, { email: 'billing@clickapp.io' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Legal Compliance & Support Trust Bar */}
          <div className="p-4 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-theme-secondary">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-emerald-500 flex-shrink-0" />
              <span>
                {t('billingPage.complianceNote')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
              <Link href="/terms" className="text-primary hover:underline">{t('billingPage.termsOfService')}</Link>
              <span className="text-theme-muted">·</span>
              <Link href="/privacy" className="text-primary hover:underline">{t('billingPage.privacyPolicy')}</Link>
              <span className="text-theme-muted">·</span>
              <Link href="/refund" className="text-primary hover:underline">{t('billingPage.refundPolicy')}</Link>
              <span className="text-theme-muted">·</span>
              <Link href="/ai-disclosure" className="text-primary hover:underline">{t('billingPage.aiDisclosure')}</Link>
              <span className="text-theme-muted">·</span>
              <a href="mailto:billing@clickapp.io" className="text-theme-primary hover:underline">billing@clickapp.io</a>
            </div>
          </div>
        </div>

        {/* Pre-Checkout Confirmation Modal */}
        {selectedPlanForCheckout && (
          <Modal
            open={!!selectedPlanForCheckout}
            onClose={() => {
              if (!upgradingId) setSelectedPlanForCheckout(null)
            }}
            title={t('billingPage.confirmTitle')}
            description={t('billingPage.confirmDescription')}
            className="max-w-md"
          >
            <div className="space-y-4 pt-3">
              {/* Plan summary pill */}
              <div className="p-4 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-white', selectedPlanForCheckout.gradient)}>
                      <Crown size={18} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-theme-primary">{t('billingPage.planTier', { plan: selectedPlanForCheckout.name })}</h4>
                      <p className="text-xs text-theme-secondary capitalize">{billingPeriod === 'yearly' ? t('billingPage.yearlyBilling') : t('billingPage.monthlyBilling')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-theme-primary tabular-nums">
                      {formatPrice(selectedPlanForCheckout, billingPeriod)}
                    </p>
                    <p className="text-[11px] text-theme-muted">
                      {formatPriceCadence(billingPeriod)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5 text-xs text-theme-secondary">
                  <div className="flex justify-between">
                    <span>{t('billingPage.moneyBackGuarantee')}</span>
                    <span className="text-emerald-500 font-medium">{t('billingPage.includedFullRefund')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('billingPage.creatorRights')}</span>
                    <span className="text-emerald-500 font-medium">{t('billingPage.ownedByYou')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('billingPage.autoRenewal')}</span>
                    <span className="text-theme-primary">{billingPeriod === 'yearly' ? t('billingPage.renewsYearly') : t('billingPage.renewsMonthly')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('billingPage.taxes')}</span>
                    <span className="text-theme-muted">{t('billingPage.taxesAtCheckout')}</span>
                  </div>
                </div>
              </div>

              {/* Legal Terms Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-accent border border-[var(--border-subtle)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-theme-muted text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-xs text-theme-secondary leading-relaxed">
                  {t('billingPage.agreePrefix')}{' '}
                  <Link href="/terms" target="_blank" className="text-primary underline hover:text-primary/80 font-medium">
                    {t('billingPage.termsOfService')}
                  </Link>
                  ,{' '}
                  <Link href="/privacy" target="_blank" className="text-primary underline hover:text-primary/80 font-medium">
                    {t('billingPage.privacyPolicy')}
                  </Link>
                  , {t('billingPage.agreeAnd')}{' '}
                  <Link href="/refund" target="_blank" className="text-primary underline hover:text-primary/80 font-medium">
                    {t('billingPage.refundPolicy14')}
                  </Link>
                  {t('billingPage.agreeSuffix')}
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="md"
                  className="flex-1"
                  disabled={!!upgradingId}
                  onClick={() => setSelectedPlanForCheckout(null)}
                >
                  {t('billingPage.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={!agreedToTerms || !!upgradingId}
                  loading={upgradingId === selectedPlanForCheckout.id}
                  onClick={() => handleUpgrade(selectedPlanForCheckout)}
                  rightIcon={<ArrowRight size={14} />}
                >
                  {t('billingPage.proceedToWhop')}
                </Button>
              </div>

              <p className="text-[11px] text-center text-theme-muted flex items-center justify-center gap-1.5">
                <Lock size={12} className="text-emerald-500" />
                <span>{t('billingPage.securedByWhop')}</span>
              </p>
            </div>
          </Modal>
        )}

        {/* In-App Cancellation & 14-Day Refund Modal */}
        {showManageModal && (
          <Modal
            open={showManageModal}
            onClose={() => {
              if (!manageLoading) setShowManageModal(false)
            }}
            title={t('billingPage.manageTitle')}
            description={t('billingPage.manageDescription')}
            className="max-w-md"
          >
            <div className="space-y-4 pt-3">
              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-accent border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setManageTab('cancel')}
                  className={cn(
                    'py-1.5 text-xs font-semibold rounded-lg transition-all',
                    manageTab === 'cancel'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {t('billingPage.cancelRenewal')}
                </button>
                <button
                  type="button"
                  onClick={() => setManageTab('refund')}
                  className={cn(
                    'py-1.5 text-xs font-semibold rounded-lg transition-all',
                    manageTab === 'refund'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {t('billingPage.refundTab')}
                </button>
              </div>

              {manageTab === 'cancel' ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-semibold text-xs">
                      <CheckCircle size={15} />
                      <span>{t('billingPage.prepaidKept')}</span>
                    </div>
                    <p className="text-xs text-theme-secondary leading-relaxed">
                      {t('billingPage.cancelBodyBefore')} <strong className="text-theme-primary capitalize">{currentPlan}</strong> {t('billingPage.cancelBodyAfter')}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="md"
                      className="flex-1"
                      disabled={manageLoading}
                      onClick={() => setShowManageModal(false)}
                    >
                      {t('billingPage.keepPlan')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="md"
                      className="flex-1"
                      disabled={manageLoading}
                      loading={manageLoading}
                      onClick={handleCancelSubscription}
                    >
                      {t('billingPage.cancelRenewal')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                      <ShieldCheck size={15} />
                      <span>{t('billingPage.moneyBackGuarantee')}</span>
                    </div>
                    <p className="text-xs text-theme-secondary leading-relaxed">
                      {t('billingPage.refundBody')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-theme-primary block">{t('billingPage.refundReason')}</label>
                    <select
                      value={manageReason}
                      onChange={(e) => setManageReason(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Not satisfied with features">{t('billingPage.reasonNotSatisfied')}</option>
                      <option value="Found an alternative tool">{t('billingPage.reasonAlternative')}</option>
                      <option value="Missing specific export integration">{t('billingPage.reasonMissingIntegration')}</option>
                      <option value="Accidental subscription or duplicate charge">{t('billingPage.reasonAccidental')}</option>
                      <option value="Other">{t('billingPage.reasonOther')}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-theme-primary block">{t('billingPage.feedbackLabel')}</label>
                    <textarea
                      rows={2}
                      value={manageDetails}
                      onChange={(e) => setManageDetails(e.target.value)}
                      placeholder={t('billingPage.feedbackPlaceholder')}
                      className="w-full text-xs px-3 py-2 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="md"
                      className="flex-1"
                      disabled={manageLoading}
                      onClick={() => setShowManageModal(false)}
                    >
                      {t('billingPage.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      disabled={manageLoading}
                      loading={manageLoading}
                      onClick={handleRequestRefund}
                    >
                      {t('billingPage.submitRequest')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )}
        {/* Live plan + renewal state from GET /api/subscription/status — the only
            client for that endpoint, and it was never imported. Billing is the
            canonical plan surface (/dashboard/membership redirects here). */}
        <ErrorBoundary><SubscriptionStatus /></ErrorBoundary>
      </PageShell>
    </ErrorBoundary>
  )
}
