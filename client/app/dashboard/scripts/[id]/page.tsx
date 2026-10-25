'use client'

import { loginPathForCurrentPage } from '../../../../lib/authRedirect'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import { ArrowLeft, Edit3, Save, X, Download, FileText, Code, Clock, Hash, Key, Layout, Layers, RefreshCw } from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../components/ErrorAlert'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { API_URL } from '../../../../lib/api'
import { useDraftAutosave } from '../../../../hooks/useDraftAutosave'
import ClickAutosaveBadge from '../../../../components/click/ClickAutosaveBadge'
import { useTranslation } from '@/hooks/useTranslation'
import { PageShell, PageHeader, Panel, SectionHeader, Button, Textarea, EmptyState } from '../../../../components/ui'

interface Script {
  _id: string
  title: string
  type: string
  topic: string
  wordCount: number
  duration?: number
  script: string
  structure: {
    introduction: string
    mainPoints: Array<{ title: string; content: string; duration: number }>
    conclusion: string
    callToAction: string
  }
  metadata: {
    keywords: string[]
    hashtags: string[]
    timestamps: Array<{ time: string; section: string }>
  }
}

export default function ScriptDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedScript, setEditedScript] = useState('')
  const [saving, setSaving] = useState(false)
  const [draftRecovered, setDraftRecovered] = useState(false)

  // Autosave the in-progress edit to /api/drafts/script/:id while the user
  // is typing. Survives browser close, network blips, and server restarts.
  const autosave = useDraftAutosave<{ script: string }>({
    scope: 'script',
    scopeId: typeof params.id === 'string' ? params.id : null,
    state: { script: editedScript },
    enabled: editing,
  })

  const loadScript = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/scripts/${params.id}`, {
      })
      if (response.data.success) {
        setScript(response.data.data)
        setEditedScript(response.data.data.script)
      }
    } catch {
      showToast(t('scriptDetailPage.errorLoad'), 'error')
      router.push('/dashboard/scripts')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showToast, t])

  useEffect(() => {
    if (authLoading) return // user is null until /auth/me answers
    if (!user) {
      router.push(loginPathForCurrentPage())
      return
    }
    loadScript()
  }, [user, authLoading, router, loadScript])

  const handleSave = async () => {
    if (!script) return

    setSaving(true)
    try {
      // Flush any pending autosave so the canonical save lands on the
      // freshest text, then push the canonical save through the script API.
      await autosave.flush()
      const response = await axios.put(
        `${API_URL}/scripts/${script._id}`,
        { script: editedScript },
        {
        }
      )
      if (response.data.success) {
        setScript(response.data.data)
        setEditing(false)
        setDraftRecovered(false)
        // Canonical save succeeded — the draft is no longer needed.
        await autosave.clear()
        showToast(t('scriptDetailPage.saveSuccess'), 'success')
      }
    } catch (error: any) {
      showToast(t('scriptDetailPage.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // When the user enters edit mode, check if there's a newer in-progress
  // draft and offer to recover it. The hook does the lookup; we only apply
  // it if the draft text differs from what's already in the canonical
  // script — otherwise there's nothing to recover.
  const startEditing = async () => {
    setEditing(true)
    if (!script) return
    const snap = await autosave.hydrate()
    const draftText = (snap?.state as { script?: string } | undefined)?.script
    if (draftText && draftText !== editedScript && draftText !== script.script) {
      setEditedScript(draftText)
      setDraftRecovered(true)
      showToast(t('scriptDetailPage.draftRecoveredToast'), 'info')
    }
  }

  const handleExport = async (format: string) => {
    if (!script) return

    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/scripts/${script._id}/export?format=${format}`,
        {
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${script.title.replace(/\s+/g, '-')}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast(t('scriptDetailPage.exportSuccess'), 'success')
    } catch (error: any) {
      showToast(t('scriptDetailPage.exportFailed'), 'error')
    }
  }

  if (loading) {
    return (
      <PageShell width="default" aria-busy="true">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-theme-muted">
          <RefreshCw size={28} className="animate-spin text-indigo-500" aria-hidden />
          <p className="ds-text-label">{t('scriptDetailPage.loading')}</p>
        </div>
      </PageShell>
    )
  }

  if (!script) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={FileText}
          title={t('scriptDetailPage.notFoundTitle')}
          description={t('scriptDetailPage.notFoundDescription')}
          action={
            <Button variant="primary" onClick={() => router.push('/dashboard/scripts')} leftIcon={<ArrowLeft size={16} aria-hidden />}>
              {t('scriptDetailPage.backToScripts')}
            </Button>
          }
        />
      </PageShell>
    )
  }

  const hasStructure = !!(script.structure?.mainPoints && script.structure.mainPoints.length > 0)
  const meta = script.metadata || ({} as Script['metadata'])

  return (
    <PageShell width="default">
      <ToastContainer />

      <PageHeader
        as="h2"
        breadcrumbs={[
          { label: t('scriptDetailPage.breadcrumbScripts'), href: '/dashboard/scripts' },
          { label: script.title },
        ]}
        title={<span className="break-words">{script.title}</span>}
        meta={
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            {t('scriptDetailPage.typeBadge', { type: script.type.replace(/-/g, ' ') })}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><FileText size={14} aria-hidden /> {t('scriptDetailPage.wordCount', { count: script.wordCount })}</span>
            {script.duration ? <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden /> {t('scriptDetailPage.duration', { count: script.duration })}</span> : null}
          </span>
        }
        actions={
          !editing ? (
            <>
              <Button variant="ghost" size="md" onClick={() => router.push('/dashboard/scripts')} leftIcon={<ArrowLeft size={16} aria-hidden />}>
                {t('common.back')}
              </Button>
              <Button variant="secondary" size="md" onClick={() => handleExport('txt')} title={t('scriptDetailPage.exportTxt')} leftIcon={<Download size={16} aria-hidden />}>
                TXT
              </Button>
              <Button variant="secondary" size="md" onClick={() => handleExport('json')} title={t('scriptDetailPage.exportJson')} leftIcon={<Code size={16} aria-hidden />}>
                JSON
              </Button>
              <Button variant="primary" size="md" onClick={startEditing} title={t('scriptDetailPage.editTitle')} leftIcon={<Edit3 size={16} aria-hidden />}>
                {t('scriptDetailPage.editButton')}
              </Button>
            </>
          ) : (
            <>
              <ClickAutosaveBadge status={autosave.status} lastSavedAt={autosave.lastSavedAt} />
              {draftRecovered && (
                <span className="ds-text-caption text-indigo-500" title={t('scriptDetailPage.draftRecoveredTitle')}>
                  {t('scriptDetailPage.draftRecovered')}
                </span>
              )}
              <Button
                variant="ghost"
                size="md"
                onClick={() => { setEditing(false); setEditedScript(script.script) }}
                title={t('scriptDetailPage.cancelTitle')}
                leftIcon={<X size={16} aria-hidden />}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={saving} loading={saving} title={t('scriptDetailPage.saveTitle')} leftIcon={!saving ? <Save size={16} aria-hidden /> : undefined}>
                {t('scriptDetailPage.saveButton')}
              </Button>
            </>
          )
        }
      />

      {editing ? (
        <Panel>
          <Textarea
            value={editedScript}
            onChange={(e) => setEditedScript(e.target.value)}
            className="min-h-[480px] font-mono text-sm leading-relaxed"
            placeholder={t('scriptDetailPage.editPlaceholder')}
            aria-label={t('scriptDetailPage.editAria')}
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <SectionHeader as="h3" title={t('scriptDetailPage.rawScriptBadge')} className="mb-3" />
            <div className="rounded-xl border border-[var(--border-subtle)] bg-background/40 p-5 font-mono text-sm leading-relaxed text-theme-primary whitespace-pre-wrap">
              {script.script}
            </div>
          </Panel>

          {hasStructure && (
            <Panel>
              <SectionHeader as="h3" title={t('scriptDetailPage.structureHeading')} className="mb-4" />
              <ol className="space-y-3">
                {script.structure.introduction && (
                  <li className="ds-surface-subtle border-l-2 border-l-indigo-500 p-4">
                    <h4 className="ds-text-label text-indigo-500 mb-1">{t('scriptDetailPage.introduction')}</h4>
                    <p className="ds-text-body text-theme-primary">{script.structure.introduction}</p>
                  </li>
                )}
                {script.structure.mainPoints.map((point, index) => (
                  <li key={index} className="ds-surface-subtle p-4">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h4 className="ds-text-label text-theme-primary">{t('scriptDetailPage.mainPointLabel', { number: index + 1, title: point.title })}</h4>
                      {point.duration ? <span className="ds-text-caption text-theme-muted">{t('scriptDetailPage.minSegment', { count: point.duration })}</span> : null}
                    </div>
                    <p className="ds-text-body text-theme-secondary">{point.content}</p>
                  </li>
                ))}
                {script.structure.conclusion && (
                  <li className="ds-surface-subtle border-l-2 border-l-indigo-500 p-4">
                    <h4 className="ds-text-label text-indigo-500 mb-1">{t('scriptDetailPage.conclusion')}</h4>
                    <p className="ds-text-body text-theme-primary">{script.structure.conclusion}</p>
                  </li>
                )}
                {script.structure.callToAction && (
                  <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <h4 className="ds-text-label text-emerald-600 dark:text-emerald-400 mb-1">{t('scriptDetailPage.callToAction')}</h4>
                    <p className="ds-text-body text-theme-primary">{script.structure.callToAction}</p>
                  </li>
                )}
              </ol>
            </Panel>
          )}

          {((meta.timestamps?.length ?? 0) > 0 || (meta.keywords?.length ?? 0) > 0 || (meta.hashtags?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {meta.timestamps && meta.timestamps.length > 0 && (
                <Panel>
                  <SectionHeader as="h3" title={<span className="inline-flex items-center gap-2"><Clock size={16} className="text-indigo-500" aria-hidden />{t('scriptDetailPage.timestamps')}</span>} className="mb-3" />
                  <ul className="space-y-2">
                    {meta.timestamps.map((ts, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm">
                        <span className="font-mono font-semibold text-indigo-500">{ts.time}</span>
                        <span className="text-theme-secondary">{ts.section}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {meta.keywords && meta.keywords.length > 0 && (
                <Panel>
                  <SectionHeader as="h3" title={<span className="inline-flex items-center gap-2"><Key size={16} className="text-indigo-500" aria-hidden />{t('scriptDetailPage.keywords')}</span>} className="mb-3" />
                  <div className="flex flex-wrap gap-2">
                    {meta.keywords.map((keyword, index) => (
                      <span key={index} className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">{keyword}</span>
                    ))}
                  </div>
                </Panel>
              )}
              {meta.hashtags && meta.hashtags.length > 0 && (
                <Panel>
                  <SectionHeader as="h3" title={<span className="inline-flex items-center gap-2"><Hash size={16} className="text-indigo-500" aria-hidden />{t('scriptDetailPage.hashtags')}</span>} className="mb-3" />
                  <div className="flex flex-wrap gap-2">
                    {meta.hashtags.map((hashtag, index) => (
                      <span key={index} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-300">{hashtag.startsWith('#') ? hashtag : `#${hashtag}`}</span>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}
