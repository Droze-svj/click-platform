'use client'

import { useEffect, useState } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import IngestPanel from '../../../components/IngestPanel'
import {
  History, RefreshCw, UploadCloud, FileText, Settings,
  Activity, BrainCircuit,
} from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useRouter } from 'next/navigation'
import { useTranslation } from '../../../hooks/useTranslation'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'

interface ManifestHistory {
  _id: string;
  title: string;
  topic: string;
  createdAt: string;
  metadata: {
    hooks: any[];
    hashtags: string[];
  };
}

export default function OneClickForgePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [history, setHistory] = useState<ManifestHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState(false)

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true)
      setHistoryError(false)
      const res = await apiGet('/intelligence/factory/history')
      setHistory(res.success ? (res.data || []) : [])
    } catch (err) {
      console.error('Failed to fetch history:', err)
      setHistoryError(true)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    // Intentionally run once on mount — `t` is excluded so changing the UI
    // language doesn't refetch history and flicker the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.title = t('forgePage.documentTitle')
  }, [t])

  return (
    <ErrorBoundary>
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1600px] mx-auto space-y-8">
        <ToastContainer />

        <header className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
            <BrainCircuit size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-text-h1 text-theme-primary leading-none">{t('forgePage.title')}</h1>
            <p className="ds-text-caption mt-1">{t('forgePage.intelligenceFactory')}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <main className="xl:col-span-8 space-y-6">
            {/* Step 1: Ingest */}
            <section className="ds-surface-card p-5 sm:p-6">
              <header className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-accent text-theme-muted inline-flex items-center justify-center">
                  <UploadCloud size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="ds-text-h3 text-theme-primary">{t('forgePage.initializePayload')}</h2>
                  <p className="ds-text-caption mt-0.5">{t('forgePage.initializePayloadDesc')}</p>
                </div>
              </header>
              <IngestPanel />
            </section>

            {/* Step 2: Synthesis */}
            <section className="ds-surface-card p-5 sm:p-6">
              <header className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="ds-text-h3 text-theme-primary">{t('forgePage.synthesisHub')}</h2>
                  <p className="ds-text-caption mt-0.5">{t('forgePage.synthesisHubDesc')}</p>
                </div>
              </header>
              <AutonomousCreator />
            </section>
          </main>

          {/* Right Sidebar: History */}
          <aside className="xl:col-span-4">
            <div className="ds-surface-card p-5 sm:p-6 flex flex-col xl:sticky xl:top-6">
              <header className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-accent text-theme-muted inline-flex items-center justify-center">
                  <History size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="ds-text-h3 text-theme-primary">{t('forgePage.manifestArchive')}</h3>
                  <p className="ds-text-caption mt-0.5">{t('forgePage.recentFactoryYields')}</p>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[640px] pr-1">
                {loadingHistory ? (
                  <div className="py-16 text-center space-y-3">
                    <RefreshCw size={28} className="text-primary animate-spin mx-auto" />
                    <p className="ds-text-caption">{t('forgePage.decodingHistory')}</p>
                  </div>
                ) : historyError ? (
                  <EmptyState
                    icon={Activity}
                    title={t('common.error')}
                    action={
                      <Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={fetchHistory}>
                        {t('common.retry')}
                      </Button>
                    }
                  />
                ) : history.length > 0 ? (
                  history.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => router.push(`/dashboard/video/edit/${item._id}`)}
                      className="w-full text-left rounded-xl border border-input p-4 hover:bg-accent transition-colors ds-hover-lift"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="ds-text-caption">
                          {t('forgePage.dateCycle', { date: new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">{t('forgePage.manifested')}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent text-theme-muted inline-flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-primary leading-snug line-clamp-2">{item.title}</p>
                          <p className="ds-text-caption mt-1">{t('forgePage.idLabel', { id: item._id.slice(-8) })}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState icon={History} title={t('forgePage.nullHistory')} />
                )}
              </div>

              <Button
                variant="secondary"
                onClick={fetchHistory}
                title={t('forgePage.syncArchive')}
                aria-label={t('forgePage.syncArchive')}
                className="mt-5 w-full"
                leftIcon={<RefreshCw size={16} className={loadingHistory ? 'animate-spin' : ''} />}
              >
                {t('forgePage.syncArchive')}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </ErrorBoundary>
  )
}
