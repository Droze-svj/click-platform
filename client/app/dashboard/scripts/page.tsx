'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy, Download, Trash2, Check,
  FileText, Clock, Plus, ChevronDown,
  Globe, Radio, Sparkles, X,
  Zap,
  Type, MessageSquare, Feather, Search, type LucideIcon
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { apiGet, apiPost, apiDelete, api } from '../../../lib/api'
import ToastContainer from '../../../components/ToastContainer'
import { Button, IconButton, Panel, StatCard, SectionHeader, Badge, Input, Modal } from '../../../components/ui'
import { cn } from '../../../lib/utils'

interface Script {
  _id: string; title: string; type: string; topic: string
  wordCount: number; duration?: number; status: string
  createdAt: string; script?: string
}

const SAMPLE_PROMPTS = [
  'Grow from 0 to 10K followers',
  'My morning content routine',
  '3 beginner mistakes to avoid',
  'Behind the scenes of a launch',
  'My daily AI tool stack',
  'A strategic failure I learned from',
]

const DEPLOYMENT_PLATFORMS: Record<string, { label: string; icon: LucideIcon }> = {
  youtube:        { label: 'YouTube',      icon: Radio },
  podcast:        { label: 'Podcast',      icon: MessageSquare },
  'social-media': { label: 'Social Media', icon: Globe },
  blog:           { label: 'Blog',         icon: Feather },
  email:          { label: 'Email',        icon: Zap },
}

const TONE_OPTIONS = ['Authoritative','Inspiring','Educational','Visionary','Precise','Casual','Strategic']
const DOMAIN_MAP: Record<string, string> = { 'social-media': 'instagram', instagram: 'instagram', tiktok: 'tiktok', linkedin: 'linkedin', twitter: 'twitter' }

export default function ScriptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { state: workflow, completeStage } = useWorkflow()
  const { t } = useTranslation()

  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [synthesizing, setSynthesizing] = useState(false)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [latestScriptId, setLatestScriptId] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)

  const [seed, setSeed] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [duration, setDuration] = useState(10)
  const [tone, setTone] = useState('Authoritative')
  const [targetAudience, setTargetAudience] = useState('')
  const [keywords, setKeywords] = useState('')

  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadScripts = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await apiGet('/scripts')
      const data = res?.data ?? (Array.isArray(res) ? res : [])
      setScripts(data)
    } catch {
      showToast(t('scriptsPage.toastLoadFailed'), 'error')
    } finally { setLoading(false) }
  }, [showToast, t])

  useEffect(() => { if (!user) router.push('/login'); else loadScripts() }, [user, router, loadScripts])

  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seed.trim()) return
    setSynthesizing(true)
    try {
      const options: Record<string, any> = {
        duration: (platform === 'youtube' || platform === 'podcast') ? duration : undefined,
        tone: tone.toLowerCase(),
        targetAudience: targetAudience || workflow.niche || (user as any)?.niche || 'general audience',
        platform: workflow.platform || DOMAIN_MAP[platform] || 'instagram',
      }
      if (keywords.trim()) options.keywords = keywords.split(/[\s,]+/).filter(Boolean).slice(0, 10)

      const res: any = await apiPost('/scripts/generate', { topic: seed.trim(), type: platform, options })
      const data = res?.data || res
      if (data?._id) {
        showToast(t('scriptsPage.toastSynthesisComplete'), 'success')
        setLatestScriptId(data._id); await loadScripts(); setShowTerminal(false); setSeed('')
        completeStage('script')
      }
    } catch {
      showToast(t('scriptsPage.toastSynthesisFailed'), 'error')
    } finally { setSynthesizing(false) }
  }

  const handleExportScript = async (id: string) => {
    try {
      const res = await api.get(`/scripts/${id}/export?format=txt`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      Object.assign(document.createElement('a'), { href: url, download: `script-${id}.txt` }).click()
      URL.revokeObjectURL(url)
      showToast(t('scriptsPage.toastExported'), 'success')
    } catch { showToast(t('scriptsPage.toastExportFailed'), 'error') }
  }

  const handleCopyScript = async (s: Script) => {
    let text = s.script
    if (!text) {
      try {
        const res: any = await apiGet(`/scripts/${s._id}`)
        text = (res?.data || res)?.script
      } catch { return }
    }
    if (text) {
      await navigator.clipboard.writeText(text)
      setCopyId(s._id); showToast(t('scriptsPage.toastClipboardSynced'), 'success')
      setTimeout(() => setCopyId(null), 2000)
    }
  }

  const handleDeleteScript = async (id: string) => {
    setDeleting(true)
    try {
      await apiDelete(`/scripts/${id}`)
      showToast(t('scriptsPage.toastDeleted'), 'success')
      if (latestScriptId === id) setLatestScriptId(null)
      await loadScripts()
    } catch { showToast(t('scriptsPage.toastDeleteFailed'), 'error') }
    finally { setDeleting(false); setDeleteTargetId(null) }
  }

  const filteredScripts = scripts.filter(s => {
    if (filterPlatform !== 'all' && s.type !== filterPlatform) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (s.topic || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1750px] mx-auto space-y-6" aria-busy="true" aria-label={t('scriptsPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1750px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('scriptsPage.title')}
          className="mb-6"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowTerminal(!showTerminal)}
              leftIcon={showTerminal ? <X size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            >
              {showTerminal ? t('scriptsPage.abortSession') : t('scriptsPage.newSynthesis')}
            </Button>
          }
        />

        {/* Stats (real counts) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label={t('scriptsPage.statTotalScripts')} value={scripts.length} icon={FileText} />
          <StatCard label={t('scriptsPage.statYoutubeStrands')} value={scripts.filter(s => s.type === 'youtube').length} icon={Radio} />
          <StatCard label={t('scriptsPage.statSocialVectors')} value={scripts.filter(s => s.type === 'social-media').length} icon={Globe} />
          <StatCard label={t('scriptsPage.statGrowthCycles')} value={scripts.filter(s => s.wordCount > 1000).length} icon={Sparkles} />
        </section>

        {/* Generator Form */}
        {showTerminal && (
          <Panel variant="bento" className="ds-anim-rise mb-8 p-0 overflow-hidden">
            <header className="p-5 border-b border-[var(--border-subtle)] flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <Sparkles size={18} aria-hidden />
              </div>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('scriptsPage.neuralSynthesis')}</h2>
                <p className="text-sm text-theme-muted">{t('scriptsPage.neuralSynthesisSubtitle')}</p>
              </div>
            </header>

            <form onSubmit={handleGenerateScript} className="p-5 sm:p-6 space-y-6">
              <div className="space-y-2">
                <label className="ds-text-label text-theme-secondary">{t('scriptsPage.inspirationVectors')}</label>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROMPTS.map(p => (
                    <button type="button" key={p} onClick={() => setSeed(p)}
                      className={cn(
                        'rounded-lg px-3 h-8 text-xs font-medium border transition-colors',
                        seed === p ? 'bg-primary text-primary-foreground border-transparent' : 'ds-surface-subtle border-[var(--border-subtle)] text-theme-secondary hover:text-theme-primary'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="ds-text-label text-theme-secondary">{t('scriptsPage.coreThesis')}</label>
                <Input type="text" value={seed} onChange={e => setSeed(e.target.value)} required placeholder={t('scriptsPage.coreThesisPlaceholder')} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="ds-text-label text-theme-secondary">{t('scriptsPage.outputStrata')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(DEPLOYMENT_PLATFORMS).map(([id, cfg]) => {
                      const CIcon = cfg.icon
                      return (
                        <button type="button" key={id} onClick={() => setPlatform(id)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg px-3 h-10 text-xs font-medium border transition-colors',
                            platform === id ? 'bg-primary text-primary-foreground border-transparent' : 'ds-surface-subtle border-[var(--border-subtle)] text-theme-secondary hover:text-theme-primary'
                          )}
                        >
                          <CIcon size={15} aria-hidden /> {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="ds-text-label text-theme-secondary">{t('scriptsPage.vocalSignature')}</label>
                    <div className="relative">
                      <select value={tone} onChange={e => setTone(e.target.value)} aria-label={t('scriptsPage.vocalTone')} title={t('scriptsPage.vocalTone')}
                        className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
                        {TONE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
                    </div>
                  </div>
                  {(platform === 'youtube' || platform === 'podcast') && (
                    <div className="space-y-2">
                      <label className="ds-text-label text-theme-secondary">{t('scriptsPage.durationMins')}</label>
                      <Input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value, 10) || 1)} min={1} max={60}
                        aria-label={t('scriptsPage.durationInMinutes')} title={t('scriptsPage.durationInMinutes')} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-[var(--border-subtle)]">
                <Button type="submit" variant="primary" size="lg" loading={synthesizing} disabled={synthesizing} leftIcon={<Sparkles size={18} aria-hidden />}>
                  {synthesizing ? t('scriptsPage.initializingSynthesis') : t('scriptsPage.commenceSynthesis')}
                </Button>
              </div>
            </form>
          </Panel>
        )}

        {/* Scripts Archive */}
        <Panel variant="bento" className="p-0 overflow-hidden">
          <header className="p-4 border-b border-[var(--border-subtle)] flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden />
              <Input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('scriptsPage.searchArchivePlaceholder')} className="pl-9" />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle overflow-x-auto">
              {['all', ...Object.keys(DEPLOYMENT_PLATFORMS)].map(id => (
                <button key={id} type="button" onClick={() => setFilterPlatform(id)}
                  className={cn(
                    'rounded-md px-3 h-8 text-xs font-medium whitespace-nowrap transition-colors',
                    filterPlatform === id ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {id === 'all' ? t('scriptsPage.allNodes') : DEPLOYMENT_PLATFORMS[id].label}
                </button>
              ))}
            </div>
          </header>

          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredScripts.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-theme-muted opacity-60">
                <FileText size={40} className="mb-3" aria-hidden />
                <p className="ds-text-label">{t('scriptsPage.nullArchiveMatch')}</p>
              </div>
            ) : (
              filteredScripts.map((s) => {
                const cfg = DEPLOYMENT_PLATFORMS[s.type] || { label: s.type, icon: FileText }
                const CIcon = cfg.icon
                return (
                  <div key={s._id} className="p-4 sm:p-5 group flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-accent/40 transition-colors">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl ds-surface-subtle text-primary shrink-0">
                      <CIcon size={22} aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-base font-semibold text-theme-primary truncate">{s.topic || s.title || t('scriptsPage.nullIdentifier')}</h4>
                        <Badge variant="secondary">{cfg.label}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 ds-text-caption text-theme-muted">
                        <span className="inline-flex items-center gap-1.5"><Type size={13} className="text-primary" aria-hidden /> {t('scriptsPage.wordsCount', { count: s.wordCount })}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-primary" aria-hidden /> {new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton variant="ghost" size="md" onClick={() => handleCopyScript(s)} title={t('scriptsPage.copyScript')} aria-label={t('scriptsPage.copyScript')}>
                        {copyId === s._id ? <Check size={16} className="text-emerald-500" aria-hidden /> : <Copy size={16} aria-hidden />}
                      </IconButton>
                      <IconButton variant="ghost" size="md" onClick={() => handleExportScript(s._id)} title={t('scriptsPage.exportScript')} aria-label={t('scriptsPage.exportScript')}>
                        <Download size={16} aria-hidden />
                      </IconButton>
                      <IconButton variant="ghost" size="md" onClick={() => setDeleteTargetId(s._id)} title={t('scriptsPage.purgeScript')} aria-label={t('scriptsPage.purgeScript')} className="text-rose-500">
                        <Trash2 size={16} aria-hidden />
                      </IconButton>
                      <Link href={`/dashboard/scripts/${s._id}`}>
                        <Button variant="secondary" size="md">{t('scriptsPage.openNode')}</Button>
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Panel>

        {/* Delete confirmation */}
        <Modal open={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} title={t('scriptsPage.purgeNodeTitle')} description={t('scriptsPage.purgeNodeBody')}>
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button variant="ghost" size="md" onClick={() => setDeleteTargetId(null)}>{t('scriptsPage.abortPurge')}</Button>
            <Button variant="destructive" size="md" loading={deleting} disabled={deleting} onClick={() => deleteTargetId && handleDeleteScript(deleteTargetId)} leftIcon={<Trash2 size={16} aria-hidden />}>
              {t('scriptsPage.commitPurge')}
            </Button>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
