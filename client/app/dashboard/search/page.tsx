'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Compass, ChevronRight, AlertCircle } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '../../../hooks/useTranslation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-field'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/utils'

interface SearchResult {
  _id: string
  title: string
  type: string
  status: string
  [key: string]: any
}

export default function SearchPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!user) return
  }, [user])

  const handleRecon = async () => {
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query) params.append('q', query)
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      const response = await apiGet<any>(`/search/content?${params.toString()}`)
      const data = response?.data || response
      setResults(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const e = extractApiError(err)
      setError(typeof e === 'string' ? e : e?.message || t('searchPage.reconFailed'))
    } finally {
      setLoading(false)
    }
  }

  const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto text-theme-primary space-y-6">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Compass size={20} aria-hidden />
              </span>
              {t('searchPage.title')}
            </span>
          }
          description={t('searchPage.subtitle')}
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={handleRecon}
              loading={loading}
              leftIcon={!loading ? <RefreshCw size={16} aria-hidden /> : undefined}
            >
              {t('searchPage.executeGridProbe')}
            </Button>
          }
        />

        {/* Search controls */}
        <div className="ds-surface-card p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
              <Input
                id="intercept-input"
                type="text"
                placeholder={t('searchPage.interceptPlaceholder')}
                aria-label={t('searchPage.interceptSignal')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRecon()}
                className="pl-9"
              />
            </div>

            <select id="modality-select" value={type} onChange={(e) => setType(e.target.value)} aria-label={t('searchPage.emissionModalities')} className={selectClass}>
              <option value="">{t('searchPage.allModalities')}</option>
              <option value="video">{t('searchPage.modalityVideo')}</option>
              <option value="article">{t('searchPage.modalityArticle')}</option>
              <option value="podcast">{t('searchPage.modalityPodcast')}</option>
            </select>

            <select id="phase-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('searchPage.processPhases')} className={selectClass}>
              <option value="">{t('searchPage.allPhases')}</option>
              <option value="completed">{t('searchPage.phaseCompleted')}</option>
              <option value="processing">{t('searchPage.phaseProcessing')}</option>
              <option value="failed">{t('searchPage.phaseFailed')}</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {error && (
            <div className="ds-surface-card p-4 flex items-center gap-3 border border-rose-500/30">
              <AlertCircle size={20} className="text-rose-500 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-rose-500">{t('searchPage.reconFatalError')}</p>
                <p className="text-sm text-theme-secondary truncate">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center" aria-busy="true">
              <RefreshCw size={28} className="text-theme-muted animate-spin mx-auto mb-3" aria-hidden />
              <p className="ds-text-caption">{t('searchPage.probingNodes')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="ds-surface-card p-6">
              <EmptyState
                icon={Compass}
                title={t('searchPage.nullSignature')}
                description={searched && query ? t('searchPage.noMatchesFor', { query }) : t('searchPage.enterProbeParameters')}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  onClick={() => router.push(`/dashboard/content/${item._id}`)}
                  className="ds-surface-card ds-hover-lift p-5 text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-block rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                      {t('searchPage.cardModality', { type: item.type })}
                    </span>
                    <span className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      item.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                    )} />
                  </div>
                  <h3 className="ds-text-h3 text-theme-primary truncate mb-4 group-hover:text-primary transition-colors">
                    {item.title || t('searchPage.unnamedNode')}
                  </h3>
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                    <span className="ds-text-caption">{t('searchPage.cardSigLocked', { status: item.status })}</span>
                    <ChevronRight size={16} className="text-theme-muted group-hover:text-primary transition-colors" aria-hidden />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
