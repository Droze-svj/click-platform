'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Brain, Target, TrendingUp, Cpu, ArrowLeft, RefreshCw,
  Flame, AlertCircle,
} from 'lucide-react'
import { apiPost } from '../../../../../lib/api'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'
import ToastContainer from '../../../../../components/ToastContainer'
import SpectralLoader from '../../../../../components/SpectralLoader'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Panel, StatCard, SectionHeader, EmptyState, Button, IconButton,
} from '@/components/ui'

interface InsightMatrix {
  potencyScore: number;
  predictiveROI: number;
  specificAdvice: string;
  signalGaps: string[];
  kineticResonance: string;
  headline: string;
  platform_context: string;
}

export default function StrategicSynthesisHub() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const [matrix, setMatrix] = useState<InsightMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initiateScan = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiPost(`/analytics/process-insights/${params.id}`, {})
      if (res.success) {
        const data = res.matrix.metadata || res.matrix;
        setMatrix(data)
      } else {
        throw new Error(res.error || 'SCAN_INTERRUPTED')
      }
    } catch (err: any) {
      console.error('Insight scan failed:', err)
      setError(err.message || 'NEURAL_LINK_ERROR')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) initiateScan()
  }, [params.id, initiateScan])

  if (loading) return <SpectralLoader message={t('analyticsInsightPage.loaderMessage')} subMessage={t('analyticsInsightPage.loaderSubMessage')} />

  if (error) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto text-theme-primary">
      <EmptyState
        icon={AlertCircle}
        title={t('analyticsInsightPage.linkError')}
        description={error}
        className="py-24"
        action={
          <Button variant="primary" size="md" onClick={() => router.back()}>
            {t('analyticsInsightPage.returnToMatrix')}
          </Button>
        }
      />
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('analyticsInsightPage.title')}
          description={t('analyticsInsightPage.subtitle')}
          className="mb-6"
          actions={
            <>
              <IconButton
                variant="secondary"
                size="md"
                aria-label={t('analyticsInsightPage.goBack')}
                onClick={() => router.back()}
              >
                <ArrowLeft size={18} aria-hidden />
              </IconButton>
              <Button
                variant="primary"
                size="md"
                onClick={initiateScan}
                leftIcon={<RefreshCw size={16} aria-hidden />}
              >
                {t('analyticsInsightPage.reInitializeScan')}
              </Button>
            </>
          }
        />

        {matrix?.headline && (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
            <p className="ds-text-h3 text-theme-primary [overflow-wrap:anywhere]">
              &ldquo;{matrix.headline}&rdquo;
            </p>
          </Panel>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Primary yield + ROI modeling */}
          <div className="lg:col-span-2 space-y-4">
            <Panel variant="bento" className="ds-anim-rise p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                  <TrendingUp size={20} aria-hidden />
                </span>
                <SectionHeader
                  as="h2"
                  title={t('analyticsInsightPage.roiTitle')}
                  description={t('analyticsInsightPage.roiSubtitle')}
                />
              </div>

              <div className="flex flex-col items-center justify-center py-6">
                <div className="ds-text-display text-theme-primary tabular-nums">
                  +{matrix?.predictiveROI || 0}%
                </div>
                <div className="ds-text-caption mt-2">{t('analyticsInsightPage.growthResonance')}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {matrix?.specificAdvice && (
                  <Panel variant="subtle" className="p-5 flex items-start gap-4">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                      <Target size={20} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="ds-text-label text-indigo-500 mb-1">{t('analyticsInsightPage.strategicDirective')}</div>
                      <p className="ds-text-body text-theme-primary [overflow-wrap:anywhere]">{matrix.specificAdvice}</p>
                    </div>
                  </Panel>
                )}
                {matrix?.kineticResonance && (
                  <Panel variant="subtle" className="p-5 flex items-start gap-4">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <Flame size={20} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="ds-text-label text-rose-500 mb-1">{t('analyticsInsightPage.kineticFlow')}</div>
                      <p className="ds-text-body text-theme-primary [overflow-wrap:anywhere]">{matrix.kineticResonance}</p>
                    </div>
                  </Panel>
                )}
              </div>
            </Panel>
          </div>

          {/* Signal diagnostic */}
          <Panel variant="bento" className="ds-anim-rise p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Brain size={20} aria-hidden />
              </span>
              <SectionHeader
                as="h2"
                title={t('analyticsInsightPage.signalDiagnostic')}
                description={t('analyticsInsightPage.signalDiagnosticSubtitle')}
              />
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="ds-text-label text-theme-secondary">{t('analyticsInsightPage.potencyScore')}</span>
                  <span className="ds-text-h3 text-theme-primary tabular-nums">{matrix?.potencyScore || 0}/100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-accent overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: `${matrix?.potencyScore || 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                <span className="ds-text-label text-theme-secondary">{t('analyticsInsightPage.signalGapsDetected')}</span>
                <div className="flex flex-wrap gap-2">
                  {(matrix?.signalGaps || [t('analyticsInsightPage.dataMissing')]).map(gap => (
                    <span key={gap} className="px-3 py-1.5 rounded-lg bg-accent ds-text-caption text-theme-secondary">
                      {gap}
                    </span>
                  ))}
                </div>
              </div>

              {matrix?.platform_context && (
                <StatCard
                  className="ds-hover-lift"
                  label={t('analyticsInsightPage.manifestPlatform')}
                  value={t('analyticsInsightPage.platformSynced', { platform: matrix.platform_context.toUpperCase() })}
                  icon={Cpu}
                />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </ErrorBoundary>
  )
}
