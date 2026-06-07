'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Shield, Activity, CheckCircle2, Target,
  Sparkles, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'

// Force dynamic rendering to avoid SSR issues with localStorage
export const dynamic = 'force-dynamic'
import { API_URL } from '../../../lib/api'

interface MembershipPackage {
  _id: string; name: string; slug: string; description: string;
  price: { monthly: number; yearly: number };
  features: any;
  limits: any;
}

interface CurrentMembership {
  package: MembershipPackage | null;
  subscription: any;
  usage: any;
  limits: any;
}

export default function IdentityDNARegistryPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [packages, setPackages] = useState<MembershipPackage[]>([])
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const loadAccessData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const [packagesRes, membershipRes] = await Promise.all([
        axios.get(`${API_URL}/membership/packages`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/membership/current`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      const pkgs = packagesRes.data.success ? packagesRes.data.data : (packagesRes.data.packages || packagesRes.data)
      const current = membershipRes.data.success ? membershipRes.data.data : (membershipRes.data.membership || membershipRes.data)

      setPackages(Array.isArray(pkgs) ? pkgs : [])
      setCurrentMembership(current)
    } catch {
      showToast(t('membershipPage.toastAccessDataOffline'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login')
      return
    }
    loadAccessData()
  }, [user, router, loadAccessData, loading])

  const handleEscalateProtocol = async (packageSlug: string) => {
    setUpgrading(packageSlug)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/membership/upgrade`,
        { packageSlug },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        showToast(t('membershipPage.toastAscensionComplete'), 'success')
        await loadAccessData()
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || t('membershipPage.toastAscensionFailed'), 'error')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 ds-bg-mesh-soft min-h-screen">
        <Shield size={40} className="text-primary animate-pulse mb-4" />
        <span className="ds-text-caption">{t('membershipPage.synchronizing')}</span>
     </div>
  )

  const currentPackageSlug = currentMembership?.package?.slug

  return (
    <ErrorBoundary>
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto space-y-8">
        <ToastContainer />

        {/* Header */}
        <header className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
            <Shield size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-text-h1 text-theme-primary leading-none">{t('membershipPage.title')}</h1>
            <p className="ds-text-caption mt-1 max-w-2xl">{t('membershipPage.subtitle')}</p>
          </div>
        </header>

        {/* Current plan + usage */}
        {currentMembership && (
          <section className="ds-surface-card p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  {t('membershipPage.activeNodeUplink')}
                </span>
                <h2 className="ds-text-h2 text-theme-primary">
                  {currentMembership.package?.name || t('membershipPage.genericAccess')}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-theme-muted">{t('membershipPage.lifecycleStatus')}</span>
                  <span className={currentMembership.subscription?.status === 'active' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                    {currentMembership.subscription?.status || t('membershipPage.uninitialized')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UsageCard icon={Target} label={t('membershipPage.spectralVideoFlux')} value={currentMembership.usage?.videosProcessed || 0} limit={currentMembership.limits?.videosPerMonth} />
              <UsageCard icon={Sparkles} label={t('membershipPage.logicSynthesisBandwidth')} value={currentMembership.usage?.contentGenerated || 0} limit={currentMembership.limits?.contentPerMonth} />
            </div>
          </section>
        )}

        {/* Packages */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(packages || []).map((pkg) => {
            const isCurrent = currentPackageSlug === pkg.slug
            const isUpgrading = upgrading === pkg.slug

            return (
              <div key={pkg._id}
                className={cn('ds-surface-card p-5 sm:p-6 flex flex-col relative',
                  isCurrent && 'ring-1 ring-primary/40 border-primary/40')}
              >
                {isCurrent && (
                  <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    {t('membershipPage.activeNode')}
                  </span>
                )}

                <div className="mb-5">
                  <p className="ds-text-label text-theme-muted">{t('membershipPage.stratumTier')}</p>
                  <h3 className="ds-text-h2 text-theme-primary mt-1">{pkg.name}</h3>
                  <p className="ds-text-caption mt-2 line-clamp-2">{pkg.description}</p>
                </div>

                <div className="mb-5 pb-5 border-b border-[var(--border-subtle)]">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-theme-primary tabular-nums">${pkg.price.monthly}</span>
                    <span className="ds-text-caption">{t('membershipPage.perCycle')}</span>
                  </div>
                  {pkg.price.yearly > 0 && (
                    <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                      {t('membershipPage.annualSync', { price: pkg.price.yearly })}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3 mb-5">
                  <FeatureRow icon={Activity} label={t('membershipPage.spectralVideoFlux')} value={pkg.features.videoProcessing.maxVideosPerMonth === -1 ? t('membershipPage.infiniteCognition') : t('membershipPage.nodesPerCycle', { count: pkg.features.videoProcessing.maxVideosPerMonth })} />
                  <FeatureRow icon={Sparkles} label={t('membershipPage.synthesisBandwidth')} value={pkg.features.contentGeneration.maxGenerationsPerMonth === -1 ? t('membershipPage.infiniteNeuralBursts') : t('membershipPage.burstsPerCycle', { count: pkg.features.contentGeneration.maxGenerationsPerMonth })} />

                  <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
                    {[
                      { check: pkg.features.analytics.advancedAnalytics, label: t('membershipPage.deepSpectralIntel') },
                      { check: pkg.features.analytics.apiAccess, label: t('membershipPage.coreMatrixUplink') },
                      { check: pkg.features.support.prioritySupport, label: t('membershipPage.primeCommandUplink') }
                    ].map((f, i) => f.check && (
                      <div key={i} className="flex items-center gap-2 text-sm text-theme-secondary">
                        <CheckCircle2 size={16} className="text-primary shrink-0" />
                        {f.label}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant={isCurrent ? 'secondary' : 'primary'}
                  onClick={() => handleEscalateProtocol(pkg.slug)}
                  disabled={isCurrent}
                  loading={isUpgrading}
                  rightIcon={!isCurrent && !isUpgrading ? <ArrowUpRight size={16} /> : undefined}
                  className="w-full"
                >
                  {isCurrent ? t('membershipPage.activeProtocol') : isUpgrading ? t('membershipPage.ascending') : pkg.price.monthly === 0 ? t('membershipPage.genesisUplink') : t('membershipPage.escalateProtocol')}
                </Button>
              </div>
            )
          })}
        </section>
      </div>
    </ErrorBoundary>
  )
}

function UsageCard({ icon: Icon, label, value, limit }: { icon: any; label: string; value: number; limit: number }) {
  const percent = limit === -1 ? 5 : Math.min(100, (value / (limit || 1)) * 100)
  return (
    <div className="rounded-xl border border-input p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="ds-text-label text-theme-muted">{label}</span>
        <Icon size={18} className="text-theme-muted" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="ds-text-h2 text-theme-primary tabular-nums">{value}</span>
        {limit !== -1 && <span className="ds-text-caption">/ {limit}</span>}
      </div>
      <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function FeatureRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 ds-text-caption">
        <Icon size={14} className="text-theme-muted" /> {label}
      </span>
      <span className="text-sm font-medium text-theme-primary text-right">{value}</span>
    </div>
  )
}
