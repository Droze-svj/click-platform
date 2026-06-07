'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import TemplateMarketplace from '../../../components/TemplateMarketplace'
import {
  Layers, CheckCircle, Globe, Zap, LayoutTemplate, HardDrive,
} from 'lucide-react'
import { API_URL } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  Badge,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

interface Template {
  _id: string
  name: string
  description: string
  category: string
  niche: string
  preview?: {
    thumbnail?: string
    description?: string
  }
  usageCount: number
  rating: {
    average: number
    count: number
  }
  tags: string[]
  isPublic: boolean
}

export default function TemplatesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [showTerminal, setShowTerminal] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedSector !== 'all') params.append('category', selectedSector)
      if (selectedDomain !== 'all') params.append('niche', selectedDomain)

      const response = await axios.get(`${API_URL}/templates?${params.toString()}`)
      const templatesData: any = extractApiData<any[]>(response)
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('templatesPage.toastSyncFailed'), type: 'error' } }))
    } finally {
      setLoading(false)
    }
  }, [selectedSector, selectedDomain, t])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadTemplates()
  }, [user, router, loadTemplates])

  const handleUseTemplate = async (templateId: string) => {
    try {
      const [, templateRes] = await Promise.all([
        axios.post(`${API_URL}/templates/${templateId}/use`, {}),
        axios.get(`${API_URL}/templates/${templateId}`)
      ])

      const templateData: any = extractApiData(templateRes)

      if (templateData) {
        if (templateData.category === 'script') {
          router.push(`/dashboard/scripts?template=${templateId}`)
        } else {
          router.push(`/dashboard/content?template=${templateId}`)
        }
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('templatesPage.toastInjectionComplete'), type: 'success' } }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('templatesPage.toastInjectionFailed'), type: 'error' } }))
    }
  }

  if (loading) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center gap-4 py-48" aria-busy="true" aria-label={t('templatesPage.decipheringBlueprints')}>
        <Layers size={32} className="text-primary animate-spin" aria-hidden />
        <p className="ds-text-label text-theme-muted">{t('templatesPage.decipheringBlueprints')}</p>
      </div>
    )
  }

  const sectors = ['all', 'social', 'video', 'blog', 'email', 'script', 'quote']
  const domains = ['all', 'health', 'finance', 'education', 'technology', 'lifestyle', 'business', 'entertainment']

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        {/* Header (global DashboardHeader provides the breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('templatesPage.title')}
          description={t('templatesPage.subtitle')}
          className="mb-6"
          actions={
            <Button
              variant={showTerminal ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setShowTerminal(!showTerminal)}
              title={showTerminal ? t('templatesPage.abortTerminal') : t('templatesPage.blueprintTerminal')}
              leftIcon={<Globe size={16} aria-hidden />}
            >
              {showTerminal ? t('templatesPage.abortTerminalCta') : t('templatesPage.blueprintTerminalCta')}
            </Button>
          }
        />

        {showTerminal ? (
          <TemplateMarketplace />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters */}
            <div className="lg:col-span-1 space-y-6">
              <Panel variant="glass" className="space-y-6">
                <div className="space-y-3">
                  <h3 className="ds-text-label text-theme-muted">{t('templatesPage.synthesisModality')}</h3>
                  <div className="space-y-1.5">
                    {sectors.map((sector) => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => setSelectedSector(sector)}
                        title={t('templatesPage.selectModality', { sector })}
                        className={cn(
                          'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left ds-text-label transition-colors',
                          selectedSector === sector
                            ? 'bg-primary/10 text-primary'
                            : 'text-theme-secondary hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <span>{sector === 'all' ? t('templatesPage.systGlobal') : sector}</span>
                        {selectedSector === sector && <CheckCircle size={16} aria-hidden />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-[var(--border-subtle)]">
                  <h3 className="ds-text-label text-theme-muted">{t('templatesPage.knowledgeDomain')}</h3>
                  <div className="space-y-1.5">
                    {domains.map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setSelectedDomain(domain)}
                        title={t('templatesPage.selectDomain', { domain })}
                        className={cn(
                          'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left ds-text-label transition-colors',
                          selectedDomain === domain
                            ? 'bg-primary/10 text-primary'
                            : 'text-theme-secondary hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <span>{domain}</span>
                        {selectedDomain === domain && <CheckCircle size={16} aria-hidden />}
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Templates grid */}
            <div className="lg:col-span-3">
              <SectionHeader
                as="h2"
                title={t('templatesPage.telemetryMatrix')}
                description={t('templatesPage.schematicsOnline', { count: templates.length })}
                className="mb-5"
              />

              {templates.length === 0 ? (
                <EmptyState
                  icon={HardDrive}
                  title={t('templatesPage.voidTitle')}
                  description={t('templatesPage.voidBody')}
                  className="ds-surface-card"
                />
              ) : (
                <div className="ds-bento-grid">
                  {templates.map((template) => (
                    <Panel key={template._id} variant="bento" className="ds-bento-2x1 flex flex-col">
                      {template.preview?.thumbnail && (
                        <div className="relative mb-4 rounded-lg overflow-hidden aspect-video bg-accent">
                          <img
                            src={template.preview.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="ds-text-h3 text-theme-primary line-clamp-1">{template.name}</h3>
                        {template.isPublic && (
                          <Badge className="bg-primary/10 text-primary flex-shrink-0">{t('templatesPage.sovereign')}</Badge>
                        )}
                      </div>

                      <p className="ds-text-body text-theme-muted line-clamp-3 flex-1">{template.description}</p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-[var(--border-subtle)]">
                        <Badge className="ds-surface-subtle text-theme-muted">{template.category}</Badge>
                        <Badge className="ds-surface-subtle text-theme-muted">{template.niche}</Badge>
                        <span className="ds-text-caption ml-auto tabular-nums">
                          {t('templatesPage.syncedCount', { count: template.usageCount })}
                        </span>
                      </div>

                      {template.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {template.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="ds-text-caption">#{tag}</span>
                          ))}
                        </div>
                      )}

                      <Button
                        variant="primary"
                        size="md"
                        className="w-full mt-4"
                        onClick={() => handleUseTemplate(template._id)}
                        title={t('templatesPage.initializeLogicTitle')}
                        leftIcon={<Zap size={16} aria-hidden />}
                      >
                        {t('templatesPage.initializeLogicCta')}
                      </Button>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
