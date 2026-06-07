'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Boxes, Plus, Crown, Users, Check, Layers, Database, Globe, Sparkles,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '@/hooks/useTranslation'
import { apiGet, apiPost } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  Input,
  Modal,
  StatCard,
  SectionHeader,
  Badge,
} from '../../../components/ui'

interface Workspace {
  id: string
  name: string
  handle: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  members: number
  plan: string
  niche: string
  color: string
  active: boolean
}

const STORAGE_KEY = 'click:active-workspace'

const WS_COLORS = [
  'from-indigo-500 to-violet-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-rose-600',
  'from-sky-500 to-indigo-700',
  'from-rose-500 to-fuchsia-700',
  'from-cyan-500 to-blue-700',
]

// Map a raw workspace document from GET /enterprise/workspaces into the
// shape this page renders. No fabricated values — counts/role come straight
// from the server record.
function mapWorkspace(raw: any, idx: number): Workspace {
  const name: string = raw?.name || 'Workspace'
  const role = (raw?.userRole || raw?.role || 'viewer') as Workspace['role']
  const memberCount = Array.isArray(raw?.members)
    ? raw.members.length
    : (typeof raw?.members === 'number' ? raw.members : 0)
  return {
    id: String(raw?._id || raw?.id || `ws-${idx}`),
    name,
    handle: raw?.handle || `@${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    role,
    members: memberCount,
    plan: raw?.plan || raw?.type || 'Free',
    niche: raw?.niche || raw?.type || 'General',
    color: WS_COLORS[idx % WS_COLORS.length],
    active: false,
  }
}

const ROLE_CFG: Record<string, string> = {
  owner:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  admin:  'bg-primary/10 text-primary',
  editor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  viewer: 'ds-surface-subtle text-theme-muted',
}

export default function WorkspacesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNiche, setNewNiche] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    let cancelled = false
    const loadWorkspaces = async () => {
      setLoadingWorkspaces(true)
      let activeId: string | null = null
      try { activeId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null } catch { activeId = null }
      try {
        const res = await apiGet<any>('/enterprise/workspaces')
        const list: any[] = res?.workspaces || res?.data?.workspaces || []
        const mapped = list.map(mapWorkspace)
        if (cancelled) return
        // Honor the persisted active selection; otherwise default to the first.
        setWorkspaces(mapped.map((w, i) => ({ ...w, active: activeId ? w.id === activeId : i === 0 })))
      } catch {
        // On failure show an honest empty state rather than fabricated demos.
        if (!cancelled) setWorkspaces([])
      } finally {
        if (!cancelled) setLoadingWorkspaces(false)
      }
    }
    loadWorkspaces()
    return () => { cancelled = true }
  }, [user, authLoading, router])

  const activeWs = useMemo(() => workspaces.find(w => w.active) || workspaces[0], [workspaces])

  const handleSwitch = (id: string) => {
    setWorkspaces(prev => prev.map(w => ({ ...w, active: w.id === id })))
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch {}
    const target = workspaces.find(w => w.id === id)
    showToast(t('workspacesPage.toastSwitched', { name: (target?.name || t('workspacesPage.workspaceFallback')).toUpperCase() }), 'success')
  }

  const handleCreate = async () => {
    if (!newName.trim()) { showToast(t('workspacesPage.toastNameRequired'), 'error'); return }
    setCreating(true)
    try {
      const res = await apiPost<any>('/enterprise/workspaces', {
        name: newName.trim(),
        niche: newNiche.trim() || 'General',
      })
      const created = res?.data || res?.workspace || res
      setWorkspaces(prev => [...prev, mapWorkspace(created, prev.length)])
      setShowCreate(false); setNewName(''); setNewNiche('')
      showToast(t('workspacesPage.toastInitialized', { name: newName.trim().toUpperCase() }), 'success')
    } catch (err: any) {
      showToast(t('workspacesPage.toastNameRequired'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const roleBadge = (role: Workspace['role']) => (
    <Badge className={cn('gap-1', ROLE_CFG[role] || ROLE_CFG.viewer)}>{t(`workspacesPage.roleLabel_${role}`)}</Badge>
  )

  if (authLoading || !user) return null

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('workspacesPage.title')}
          description={t('workspacesPage.subtitle')}
          actions={
            <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => setShowCreate(true)}>
              {t('workspacesPage.spawnWorkspace')}
            </Button>
          }
        />

        {/* Active Workspace Banner */}
        {activeWs && (
          <Panel variant="elevated" className="relative overflow-hidden">
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-[0.06] pointer-events-none', activeWs.color)} aria-hidden />
            <div className="relative flex flex-col sm:flex-row items-center gap-5">
              <div className={cn('h-16 w-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-3xl shrink-0', activeWs.color)}>
                {activeWs.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="ds-text-caption text-primary mb-1">{t('workspacesPage.activeInstance')}</p>
                <h2 className="ds-text-h2 text-theme-primary truncate">{activeWs.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                  <span className="ds-text-caption">{activeWs.handle}</span>
                  {roleBadge(activeWs.role)}
                  <Badge variant="secondary" className="gap-1"><Users size={11} aria-hidden /> {activeWs.members}</Badge>
                  <Badge className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Crown size={11} aria-hidden /> {activeWs.plan}</Badge>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* Stats (real metrics) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('workspacesPage.statTotalWorkspaces')} value={workspaces.length} icon={Layers} />
          <StatCard label={t('workspacesPage.statOwned')} value={workspaces.filter(w => w.role === 'owner').length} icon={Crown} />
          <StatCard label={t('workspacesPage.statJoined')} value={workspaces.filter(w => w.role !== 'owner').length} icon={Users} />
          <StatCard label={t('workspacesPage.statTotalMembers')} value={workspaces.reduce((s, w) => s + w.members, 0)} icon={Database} />
        </section>

        {/* Workspace Grid */}
        <div className="space-y-4">
          <SectionHeader as="h2" title={t('workspacesPage.allInstances')} description={t('workspacesPage.clickToSwitch')} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {loadingWorkspaces && Array.from({ length: 3 }).map((_, i) => (
              <div key={`ws-skeleton-${i}`} className="ds-surface-card p-6 min-h-[240px] animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-accent mb-5" />
                <div className="h-5 w-2/3 bg-accent rounded-full mb-3" />
                <div className="h-3 w-1/2 bg-accent rounded-full" />
              </div>
            ))}
            {!loadingWorkspaces && workspaces.map(ws => (
              <motion.button
                key={ws.id}
                type="button"
                whileHover={reduceMotion ? undefined : { y: -4 }}
                onClick={() => handleSwitch(ws.id)}
                className={cn(
                  'ds-surface-card ds-hover-lift p-6 flex flex-col gap-4 text-left relative overflow-hidden min-h-[240px]',
                  ws.active && 'ring-2 ring-primary/40'
                )}
              >
                <div className={cn('absolute top-0 right-0 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.08] blur-2xl pointer-events-none', ws.color)} aria-hidden />
                <div className="flex items-start justify-between relative">
                  <div className={cn('h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-xl', ws.color)}>
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  {ws.active && <Badge className="gap-1"><Check size={11} aria-hidden /> {t('workspacesPage.activeBadge')}</Badge>}
                </div>
                <div className="flex-1 min-w-0 relative">
                  <p className="ds-text-h3 text-theme-primary truncate">{ws.name}</p>
                  <p className="ds-text-caption truncate mb-2">{ws.handle}</p>
                  <p className="ds-text-body text-theme-muted">{ws.niche}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap relative">
                  {roleBadge(ws.role)}
                  <Badge variant="secondary" className="gap-1"><Users size={11} aria-hidden /> {ws.members}</Badge>
                  <Badge variant="secondary">{ws.plan}</Badge>
                </div>
              </motion.button>
            ))}
            {!loadingWorkspaces && (
              <button type="button" onClick={() => setShowCreate(true)} className="ds-surface-subtle ds-hover-lift rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center border border-dashed border-[var(--border-subtle)] hover:border-primary/40 min-h-[240px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary">
                  <Plus size={26} aria-hidden />
                </div>
                <p className="ds-text-h3 text-theme-primary">{t('workspacesPage.spawnInstance')}</p>
                <p className="ds-text-body text-theme-muted max-w-[220px]">{t('workspacesPage.spawnInstanceDesc')}</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { if (!creating) { setShowCreate(false); setNewName(''); setNewNiche('') } }} title={t('workspacesPage.modalTitle')} description={t('workspacesPage.spawnProtocol')} className="max-w-lg">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="ws-name" className="ds-text-label text-theme-secondary">{t('workspacesPage.brandDesignation')}</label>
            <Input id="ws-name" autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('workspacesPage.namePlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ws-niche" className="ds-text-label text-theme-secondary">{t('workspacesPage.nicheLabel')}</label>
            <Input id="ws-niche" value={newNiche} onChange={e => setNewNiche(e.target.value)} placeholder={t('workspacesPage.nichePlaceholder')} />
          </div>
          <footer className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" disabled={creating} onClick={() => { setShowCreate(false); setNewName(''); setNewNiche('') }}>{t('workspacesPage.cancel')}</Button>
            <Button variant="primary" size="md" disabled={creating || !newName.trim()} loading={creating} onClick={handleCreate} leftIcon={!creating ? <Sparkles size={16} aria-hidden /> : undefined}>
              {creating ? t('workspacesPage.spawning') : t('workspacesPage.initialize')}
            </Button>
          </footer>
        </div>
      </Modal>
    </ErrorBoundary>
  )
}
