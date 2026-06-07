'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useSocket } from '../../../hooks/useSocket'
import { apiGet, apiPost, apiPut, apiDelete, clearApiCache } from '../../../lib/api'
import {
  LayoutList, LayoutGrid, BarChart3, Plus, GripVertical, ChevronDown,
  ChevronRight, Zap, Trash2, ClipboardList,
  MessageSquare, Clock, Target, RefreshCw, X, Inbox,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Textarea,
  Modal,
  StatCard,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../components/ui'

// ── Constants ───────────────────────────────────────────────────────

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done']
const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Completed'
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
}

type ViewMode = 'list' | 'kanban' | 'gantt'

interface Task {
  _id: string; title: string; description?: string; status: string; priority: string;
  urgencyScore?: number | null; dueDate?: string | null; startDate?: string | null;
  parentId?: string | null; order: number; tags?: string[]; subtasks?: Task[];
  createdAt: string; updatedAt: string;
}

interface TaskMessage {
  _id: string; taskId: string; userId: string; body: string; mentionUserIds?: string[]; createdAt: string;
}

export default function TasksPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id ?? null)
  const { showToast } = useToast()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('kanban')
  const [sortByUrgency, setSortByUrgency] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [addingForParent, setAddingForParent] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadTasks = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try {
      clearApiCache('/tasks')
      const params = new URLSearchParams()
      if (sortByUrgency) params.set('sortByUrgency', '1')
      const res: any = await apiGet('/tasks?' + params.toString())
      setTasks(Array.isArray(res?.data?.tasks || res) ? (res?.data?.tasks || res) : [])
    } catch { setTasks([]) }
    finally { setLoading(false); setRefreshing(false) }
  }, [user, sortByUrgency])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    if (!socket) return
    const h = () => loadTasks()
    on('tasks:update', h)
    return () => off('tasks:update', h)
  }, [socket, on, off, loadTasks])

  const createTask = async (parentId?: string | null) => {
    const title = newTitle.trim() || t('tasksPage.defaultTaskTitle')
    try {
      await apiPost('/tasks', { title, parentId: parentId || undefined, status: parentId ? undefined : 'todo' })
      setNewTitle(''); setAddingForParent(null); loadTasks()
    } catch {
      showToast(t('tasksPage.toastCreateFailed'), 'error')
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try { await apiPut(`/tasks/${taskId}`, updates); loadTasks() } catch {
      showToast(t('tasksPage.toastUpdateFailed'), 'error')
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm(t('tasksPage.deleteConfirm'))) return
    try { await apiDelete(`/tasks/${taskId}`); setSelectedTask(null); loadTasks() } catch {
      showToast(t('tasksPage.toastDeleteFailed'), 'error')
    }
  }

  if (loading) return (
     <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-6" aria-busy="true" aria-label={t('tasksPage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="space-y-3">
           {Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
     </div>
  )

  const rootNodes = tasks.filter(t => !t.parentId)
  const byStatus = (s: string) => rootNodes.filter(t => t.status === s)

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-36 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
        <SectionHeader
          as="h1"
          title={t('tasksPage.title')}
          className="mb-6"
          actions={
            <>
              <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
                {[
                  { id: 'list', icon: LayoutList, label: t('tasksPage.viewList') },
                  { id: 'kanban', icon: LayoutGrid, label: t('tasksPage.viewKanban') },
                  { id: 'gantt', icon: BarChart3, label: t('tasksPage.viewTimeline') }
                ].map(m => {
                  const MIcon = m.icon
                  return (
                    <button type="button" key={m.id} onClick={() => setView(m.id as ViewMode)}
                      title={m.label}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-medium transition-colors',
                        view === m.id ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                      )}
                    >
                      <MIcon size={14} aria-hidden /> <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <Button
                variant={sortByUrgency ? 'primary' : 'secondary'}
                size="md"
                leftIcon={<Zap size={16} aria-hidden />}
                onClick={() => setSortByUrgency(!sortByUrgency)}
              >
                {t('tasksPage.urgencySort')}
              </Button>
              <IconButton variant="secondary" size="md" onClick={loadTasks} title={t('tasksPage.refreshTasks')} aria-label={t('tasksPage.refreshTasks')}>
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />
              </IconButton>
            </>
          }
        />

        {/* ── Stats (real counts per status) ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {STATUSES.map((s) => (
            <StatCard
              key={s}
              label={t(`tasksPage.statusLabels.${s}`)}
              value={byStatus(s).length}
              icon={Target}
            />
          ))}
        </section>

        {/* ── Main Workspace ── */}
        <main className="min-h-[60vh]">
          {view === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {STATUSES.map((s) => (
                <div key={s}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(s) }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) updateTask(id, { status: s }); setDragOverStatus(null) }}
                  className={cn(
                    'flex flex-col rounded-2xl border transition-colors min-h-[500px]',
                    dragOverStatus === s ? 'border-primary bg-primary/5' : 'border-[var(--border-subtle)] ds-surface-subtle'
                  )}
                >
                  <header className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', s === 'done' ? 'bg-emerald-500' : 'bg-primary')} />
                      <h3 className="ds-text-label text-theme-primary">{t(`tasksPage.statusLabels.${s}`)}</h3>
                    </div>
                    <Badge variant="secondary" className="tabular-nums">{byStatus(s).length}</Badge>
                  </header>
                  <div className="p-3 flex-1 space-y-3 overflow-y-auto">
                    {byStatus(s).map(task => (
                      <TaskCard key={task._id} task={task} onSelect={() => setSelectedTask(task)} onDragStart={() => setDraggedTaskId(task._id)} reduceMotion={reduceMotion} />
                    ))}
                    {byStatus(s).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-16 text-theme-muted opacity-50">
                        <Inbox size={28} className="mb-2" aria-hidden />
                        <p className="ds-text-caption">{t('tasksPage.emptyNode')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'list' && (
            <Panel variant="bento">
              <header className="hidden md:flex items-center gap-6 px-4 py-3 mb-3 border-b border-[var(--border-subtle)] ds-text-label text-theme-muted">
                <div className="w-10" />
                <div className="flex-1">{t('tasksPage.colTaskMatrix')}</div>
                <div className="w-48">{t('tasksPage.colTemporalLimit')}</div>
                <div className="w-48 text-right">{t('tasksPage.colActions')}</div>
              </header>
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                {rootNodes.map(task => (
                  <TaskRow key={task._id} task={task} expanded={expandedTasks.has(task._id)} expandedTasks={expandedTasks} expandToggle={(id: string) => setExpandedTasks(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })} onSelect={setSelectedTask} onAddSub={(p: string) => setAddingForParent(p)} onDelete={deleteTask} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} depth={0} />
                ))}
                {rootNodes.length === 0 && (
                  <EmptyState icon={Inbox} title={t('tasksPage.nullArchive')} />
                )}
              </div>
            </Panel>
          )}

          {view === 'gantt' && (
            <Panel variant="bento" className="overflow-x-auto">
              <div className="min-w-[900px] space-y-6">
                <header className="flex items-center gap-6 mb-4 border-b border-[var(--border-subtle)] pb-4 px-2">
                  <div className="w-72 ds-text-label text-theme-muted">{t('tasksPage.latticeAnchorNode')}</div>
                  <div className="flex-1 flex justify-between ds-text-caption px-8">
                    <span>{t('tasksPage.pastStrata')}</span>
                    <span className="text-primary font-semibold">{t('tasksPage.presentPulse')}</span>
                    <span>{t('tasksPage.futureTrajectory')}</span>
                  </div>
                </header>
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-3">
                  {rootNodes.slice(0, 50).map((task) => {
                    const now = new Date(), min = new Date(now.getFullYear(), now.getMonth(), -20), max = new Date(now.getFullYear(), now.getMonth() + 2, 20)
                    const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt), end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 7 * 86400000)
                    const left = ((start.getTime() - min.getTime()) / (max.getTime() - min.getTime())) * 100
                    const width = Math.max(2, ((end.getTime() - start.getTime()) / (max.getTime() - min.getTime())) * 100)
                    return (
                      <div key={task._id} className="flex items-center gap-6 group h-12 hover:ds-surface-subtle rounded-lg transition-colors px-2">
                        <div className="w-72 truncate text-sm font-medium text-theme-primary flex items-center gap-2.5">
                          <span className={cn('h-2.5 w-2.5 rounded-full', task.priority === 'urgent' ? 'bg-rose-500' : 'bg-primary')} />
                          {task.title}
                        </div>
                        <div className="flex-1 h-8 ds-surface-subtle rounded-lg relative overflow-hidden">
                          <div
                            className={cn('absolute h-3 top-2.5 rounded-full', task.status === 'done' ? 'bg-emerald-500' : 'bg-primary')}
                            style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - left)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Panel>
          )}
        </main>

        {/* ── Floating Quick-Add ── */}
        <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[90]">
          <div className="ds-surface-elevated flex items-center gap-3 p-2.5">
            <IconButton variant="primary" size="md" onClick={() => createTask(addingForParent)} aria-label={t('tasksPage.initialize')}>
              <Plus size={18} aria-hidden />
            </IconButton>
            <Input
              type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTask(addingForParent)}
              placeholder={addingForParent ? t('tasksPage.placeholderSubParticle') : t('tasksPage.placeholderNewParticle')}
              className="flex-1 border-none bg-transparent focus-visible:ring-0"
            />
            <Button variant="primary" size="md" onClick={() => createTask(addingForParent)}>{t('tasksPage.initialize')}</Button>
            {addingForParent && (
              <IconButton variant="ghost" size="md" onClick={() => setAddingForParent(null)} aria-label={t('tasksPage.cancelNewTask')} title={t('tasksPage.cancelNewTask')} className="text-rose-500">
                <X size={18} aria-hidden />
              </IconButton>
            )}
          </div>
        </footer>

        {/* ── Task Modal ── */}
        {selectedTask && (
          <TaskModal task={selectedTask} onClose={() => { setSelectedTask(null); setAddingForParent(null) }} onUpdate={(u: any) => updateTask(selectedTask._id, u)} onDelete={() => deleteTask(selectedTask._id)} onAddSub={() => { setAddingForParent(selectedTask._id); setSelectedTask(null) }} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} socket={socket} userId={user?.id} />
        )}
      </div>
    </ErrorBoundary>
  )
}

function TaskCard({ task, onSelect, onDragStart, reduceMotion }: any) {
  const { t } = useTranslation()
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
  const priorityColors: Record<string, string> = {
    urgent: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    medium: 'bg-primary/10 text-primary',
    low: 'ds-surface-subtle text-theme-muted'
  }

  return (
    <motion.div
      layout draggable
      onDragStart={(e: any) => { e.dataTransfer?.setData('text/plain', task._id); onDragStart() }}
      onClick={onSelect}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="ds-surface-card ds-hover-lift cursor-grab active:cursor-grabbing p-4"
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="ds-text-label text-theme-primary leading-snug">{task.title}</h4>
          <span className="ds-text-caption">{t('tasksPage.taskIdLabel', { id: task._id.slice(-6).toUpperCase() })}</span>
        </div>
        {task.urgencyScore != null && (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 tabular-nums">
            <Zap size={11} aria-hidden /> {task.urgencyScore}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[var(--border-subtle)]">
        <Badge className={cn('gap-1', isOverdue ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'ds-surface-subtle text-theme-muted')}>
          <Clock size={11} aria-hidden /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : t('tasksPage.noDeadline')}
        </Badge>
        <Badge className={priorityColors[task.priority]}>{t(`tasksPage.priorityLabels.${task.priority}`)}</Badge>
      </div>
    </motion.div>
  )
}

function TaskRow({ task, expanded, expandedTasks, expandToggle, onSelect, onAddSub, onDelete, getSubtasks, depth }: any) {
  const { t } = useTranslation()
  const sub = getSubtasks(task._id), hasSub = sub.length > 0
  return (
    <section>
      <div
        className="flex items-center gap-3 py-3 px-3 rounded-lg ds-surface-subtle hover:bg-accent transition-colors group mb-1.5"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <IconButton variant="ghost" size="sm" onClick={() => expandToggle(task._id)} aria-label={hasSub ? (expanded ? t('tasksPage.colTaskMatrix') : t('tasksPage.colTaskMatrix')) : t('tasksPage.colTaskMatrix')}>
          {hasSub ? (expanded ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />) : <span className="h-1.5 w-1.5 rounded-full bg-theme-muted" />}
        </IconButton>
        <GripVertical className="text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-ns-resize" size={16} aria-hidden />

        <button type="button" onClick={() => onSelect(task)} className={cn('flex-1 text-sm font-medium text-left truncate transition-colors', task.status === 'done' ? 'text-theme-muted line-through' : 'text-theme-primary')}>
          {task.title}
        </button>

        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.dueDate && <span className="ds-text-caption inline-flex items-center gap-1.5"><Clock size={13} className="text-primary" aria-hidden /> {new Date(task.dueDate).toLocaleDateString()}</span>}
          <IconButton variant="ghost" size="sm" onClick={() => onAddSub(task._id)} aria-label={t('tasksPage.addSubtask')} title={t('tasksPage.addSubtask')}><Plus size={16} aria-hidden /></IconButton>
          <IconButton variant="ghost" size="sm" onClick={() => onDelete(task._id)} aria-label={t('tasksPage.deleteTask')} title={t('tasksPage.deleteTask')} className="text-rose-500"><Trash2 size={16} aria-hidden /></IconButton>
        </div>
      </div>
      {expanded && hasSub && (
        <div>
          {sub.map((s: any) => <TaskRow key={s._id} task={s} expanded={expandedTasks.has(s._id)} expandedTasks={expandedTasks} expandToggle={expandToggle} onSelect={onSelect} onAddSub={onAddSub} onDelete={onDelete} getSubtasks={getSubtasks} depth={depth + 1} />)}
        </div>
      )}
    </section>
  )
}

function TaskModal({ task, onClose, onUpdate, onDelete, onAddSub, getSubtasks, socket, userId }: any) {
  const { showToast: modalToast } = useToast()
  const { t } = useTranslation()
  const [msg, setMsg] = useState(''), [messages, setMessages] = useState<TaskMessage[]>([]), chatEndRef = useRef<any>(null), [busy, setBusy] = useState(false)

  const fetchMessages = useCallback(async () => { try { const res: any = await apiGet(`/tasks/${task._id}/messages`); setMessages(res?.data?.messages ?? []) } catch { /* silent — messages are non-critical */ } }, [task._id])
  useEffect(() => { fetchMessages(); if (socket) { socket.emit('join:task', { taskId: task._id }); socket.on('task:message', fetchMessages); return () => { socket.off('task:message'); socket.emit('leave:task', { taskId: task._id }) } } }, [task._id, socket, fetchMessages])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSendMessage = async () => {
    const b = msg.trim(); if (!b || busy) return;
    setBusy(true); setMsg('');
    try { await apiPost(`/tasks/${task._id}/messages`, { body: b }); fetchMessages() } catch {
      modalToast(t('tasksPage.toastMessageFailed'), 'error')
    }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('tasksPage.taskProtocol')} className="max-w-3xl">
      <div className="space-y-6">
        <div className="space-y-1.5">
          <label className="ds-text-label text-theme-secondary">{t('tasksPage.operationalDescriptor')}</label>
          <Input
            type="text" defaultValue={task.title} onBlur={e => e.target.value !== task.title && onUpdate({ title: e.target.value })}
            aria-label={t('tasksPage.taskTitle')} title={t('tasksPage.taskTitle')} placeholder={t('tasksPage.taskTitle')}
          />
        </div>

        <div className="space-y-1.5">
          <label className="ds-text-label text-theme-secondary">{t('tasksPage.intelligenceBrief')}</label>
          <Textarea
            defaultValue={task.description} onBlur={e => e.target.value !== task.description && onUpdate({ description: e.target.value })} rows={4}
            placeholder={t('tasksPage.briefPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="ds-text-label text-theme-secondary">{t('tasksPage.systemStatus')}</label>
            <div className="relative">
              <select value={task.status} onChange={e => onUpdate({ status: e.target.value })}
                aria-label={t('tasksPage.taskStatus')} title={t('tasksPage.taskStatus')}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {STATUSES.map(s => <option key={s} value={s}>{t(`tasksPage.statusLabels.${s}`)}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="ds-text-label text-theme-secondary">{t('tasksPage.operationalUrgency')}</label>
            <div className="relative">
              <select value={task.priority} onChange={e => onUpdate({ priority: e.target.value })}
                aria-label={t('tasksPage.taskPriority')} title={t('tasksPage.taskPriority')}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{t(`tasksPage.priorityLabels.${p}`)}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
            </div>
          </div>
        </div>

        {/* Chat / Messages */}
        <section className="space-y-3 pt-5 border-t border-[var(--border-subtle)]">
          <h3 className="ds-text-label text-theme-secondary flex items-center gap-2">
            <MessageSquare size={15} aria-hidden /> {t('tasksPage.teamUplinkMatrix')}
          </h3>
          <div className="h-72 rounded-xl ds-surface-subtle overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-theme-muted opacity-50 gap-2">
                <MessageSquare size={28} aria-hidden />
                <p className="ds-text-caption">{t('tasksPage.nullChannel')}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex flex-col gap-1', m.userId === userId ? 'items-end' : 'items-start')}>
                <div className="flex items-center gap-2">
                  <span className={cn('ds-text-caption font-semibold', m.userId === userId ? 'text-primary' : 'text-theme-muted')}>{m.userId === userId ? t('tasksPage.userProximity') : t('tasksPage.teamUplink')}</span>
                  <span className="ds-text-caption tabular-nums">{new Date(m.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className={cn('max-w-[85%] p-3 rounded-xl text-sm', m.userId === userId ? 'bg-primary text-primary-foreground rounded-tr-none' : 'ds-surface-card rounded-tl-none')}>
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <Input
              type="text" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder={t('tasksPage.chatPlaceholder')}
              className="flex-1"
            />
            <Button variant="primary" size="md" onClick={handleSendMessage} loading={busy}>
              {busy ? t('tasksPage.transmitting') : t('tasksPage.transmit')}
            </Button>
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 pt-5 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" size="md" onClick={onDelete} className="text-rose-500" leftIcon={<Trash2 size={16} aria-hidden />}>{t('tasksPage.terminateProtocol')}</Button>
          <Button variant="primary" size="md" onClick={onClose}>{t('tasksPage.secureAndLeave')}</Button>
        </footer>
      </div>
    </Modal>
  )
}
