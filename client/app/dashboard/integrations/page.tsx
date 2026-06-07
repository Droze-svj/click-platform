'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Plus, RefreshCw, Trash2, Search, X,
  Zap, Globe, Radio, Link2, Unlink, AlertTriangle, Network,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { apiGet, apiPost, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Modal,
  StatCard,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../components/ui'

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
  tiktok:    'from-slate-800 to-black',
  instagram: 'from-pink-500 via-rose-500 to-amber-500',
  youtube:   'from-rose-500 to-rose-700',
  twitter:   'from-slate-700 to-slate-900',
  x:         'from-slate-700 to-slate-900',
  linkedin:  'from-blue-500 to-blue-700',
  facebook:  'from-indigo-500 to-indigo-700',
  threads:   'from-slate-800 to-black',
  pinterest: 'from-rose-500 to-rose-800',
  default:   'from-primary to-primary/70',
}

const STATUS_CFG: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  inactive: 'ds-surface-subtle text-theme-muted',
  error:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  pending:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}
const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500', inactive: 'bg-theme-muted', error: 'bg-rose-500', pending: 'bg-amber-500',
}

export default function IntegrationsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()

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
      showToast(t('integrationsPage.toastLoadFailed'), 'error')
    } finally { setLoading(false) }
  }, [showToast, t])

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
      showToast(t('integrationsPage.toastConnected', { name: item.name }), 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.response?.data?.error || t('integrationsPage.toastAuthRequired'), 'error')
    } finally { setInstallingId(null) }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await apiPost(`/integrations/${id}/sync`, {})
      showToast(t('integrationsPage.toastSyncStarted'), 'success')
      await loadAll()
    } catch {
      showToast(t('integrationsPage.toastSyncFailed'), 'error')
    } finally { setSyncingId(null) }
  }

  const handleRemove = async (id: string) => {
    setRemoving(true)
    try {
      await apiDelete(`/integrations/${id}`)
      showToast(t('integrationsPage.toastDisconnected'), 'success')
      await loadAll()
    } catch {
      showToast(t('integrationsPage.toastDisconnectFailed'), 'error')
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
      <div className="ds-bg-mesh-soft min-h-screen flex items-center justify-center py-24">
        <ClickLoadingState intent="loading" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('integrationsPage.title')}
          description={t('integrationsPage.subtitle')}
          actions={
            <Button
              variant={showMarketplace ? 'secondary' : 'primary'}
              size="md"
              leftIcon={showMarketplace ? <X size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
              onClick={() => setShowMarketplace(s => !s)}
            >
              {showMarketplace ? t('integrationsPage.closeCatalog') : t('integrationsPage.browsePlatforms')}
            </Button>
          }
        />

        {/* Stats (real counts) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('integrationsPage.statConnected')} value={installed.length} icon={Link2} />
          <StatCard label={t('integrationsPage.statActiveSync')} value={installed.filter(i => i.status === 'active').length} icon={Zap} />
          <StatCard label={t('integrationsPage.statIssuesFound')} value={installed.filter(i => i.status === 'error').length} icon={AlertTriangle} />
          <StatCard label={t('integrationsPage.statSupportedApps')} value={marketplace.length} icon={Globe} />
        </section>

        {/* Marketplace */}
        <AnimatePresence initial={false}>
          {showMarketplace && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Panel variant="bento" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <SectionHeader as="h2" title={t('integrationsPage.catalogTitle')} description={t('integrationsPage.catalogSubtitle')} className="flex-1" />
                  <div className="relative w-full md:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                    <Input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('integrationsPage.searchPlaceholder')} aria-label={t('integrationsPage.searchPlaceholder')} className="pl-9" />
                  </div>
                </div>

                {visibleMarketplace.length === 0 ? (
                  <EmptyState icon={Search} title={t('integrationsPage.noPlatformsMatch')} className="ds-surface-subtle" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visibleMarketplace.map(m => {
                      const id = m._id || m.id || m.provider!
                      const isInstalling = installingId === id
                      return (
                        <div key={id} className="ds-surface-subtle ds-hover-lift rounded-2xl p-5 flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-lg shrink-0', gradientFor(m.provider))}>
                                {(m.icon || m.name?.charAt(0) || '?').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="ds-text-label text-theme-primary truncate">{m.name}</h4>
                                <p className="ds-text-caption">{m.category || t('integrationsPage.categorySocial')}</p>
                              </div>
                            </div>
                            {m.popular && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">{t('integrationsPage.popular')}</Badge>}
                          </div>
                          {m.description && <p className="ds-text-body text-theme-muted line-clamp-2">{m.description}</p>}
                          <Button variant="secondary" size="md" loading={isInstalling} disabled={isInstalling} onClick={() => handleInstall(m)} leftIcon={!isInstalling ? <Plus size={16} aria-hidden /> : undefined} className="mt-auto w-full">
                            {isInstalling ? t('integrationsPage.authorizing') : t('integrationsPage.connect')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connected Platforms */}
        <Panel variant="bento" className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--border-subtle)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-theme-muted">
              <Radio size={22} aria-hidden />
            </div>
            <div>
              <h2 className="ds-text-h3 text-theme-primary">{t('integrationsPage.activeIntegrations')}</h2>
              <p className="ds-text-caption">{t('integrationsPage.manageConnections')}</p>
            </div>
          </div>

          {installed.length === 0 ? (
            <EmptyState
              icon={Unlink}
              title={t('integrationsPage.noPlatformsConnected')}
              description={t('integrationsPage.noPlatformsConnectedDesc')}
              action={
                <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => setShowMarketplace(true)}>
                  {t('integrationsPage.connectPlatform')}
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {installed.map(intg => {
                const statusKey = STATUS_CFG[intg.status] ? intg.status : 'inactive'
                const isSyncing = syncingId === intg._id
                return (
                  <div key={intg._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn('h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-lg shrink-0', gradientFor(intg.provider || intg.type))}>
                        {(intg.name?.charAt(0) || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="ds-text-label text-theme-primary truncate">{intg.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 ds-text-caption">
                          <span className="text-theme-secondary">{intg.provider || intg.type}</span>
                          <span aria-hidden>·</span>
                          <span>{t('integrationsPage.lastSync', { time: intg.lastSyncAt ? new Date(intg.lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t('integrationsPage.never') })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <Badge className={cn('gap-1.5', STATUS_CFG[statusKey])}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[statusKey])} aria-hidden />
                        {t(`integrationsPage.status_${statusKey}`)}
                      </Badge>
                      <div className="flex items-center gap-1.5 ml-auto md:ml-0">
                        <IconButton variant="secondary" size="md" disabled={isSyncing} onClick={() => handleSync(intg._id)} title={t('integrationsPage.syncPlatform')} aria-label={t('integrationsPage.syncPlatform')}>
                          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} aria-hidden />
                        </IconButton>
                        <IconButton variant="secondary" size="md" onClick={() => setRemoveTargetId(intg._id)} title={t('integrationsPage.disconnectPlatform')} aria-label={t('integrationsPage.disconnectPlatform')} className="text-rose-500">
                          <Trash2 size={16} aria-hidden />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* Disconnect Modal */}
        <Modal open={!!removeTarget} onClose={() => { if (!removing) setRemoveTargetId(null) }} title={removeTarget ? t('integrationsPage.disconnectModalTitle', { name: removeTarget.name }) : ''} className="max-w-md">
          {removeTarget && (
            <div className="space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <Unlink size={24} aria-hidden />
              </div>
              <p className="ds-text-body text-theme-muted">{t('integrationsPage.disconnectModalBody', { name: removeTarget.name })}</p>
              <footer className="flex items-center justify-end gap-3">
                <Button variant="ghost" size="md" disabled={removing} onClick={() => setRemoveTargetId(null)}>{t('integrationsPage.cancel')}</Button>
                <Button variant="destructive" size="md" disabled={removing} loading={removing} onClick={() => handleRemove(removeTarget._id)} leftIcon={!removing ? <Unlink size={16} aria-hidden /> : undefined}>
                  {removing ? t('integrationsPage.disconnecting') : t('integrationsPage.disconnect')}
                </Button>
              </footer>
            </div>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
