'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useSocket } from '../../../hooks/useSocket'
import { apiGet, apiPost, apiPut, apiDelete, clearApiCache } from '../../../lib/api'
import {
  LayoutList, LayoutGrid, BarChart3, Plus, GripVertical, ChevronDown, 
  ChevronRight, Calendar, Zap, Trash2, CheckCircle2, ClipboardList, 
  MessageSquare, Video, PhoneOff, Copy, Shield, Activity, Target, 
  Cpu, Radio, Clock, Terminal, Network, Globe, Database, ArrowRight,
  RefreshCw, X, Eye, Check, AlertTriangle, Info, ArrowLeft,
  Fingerprint, Compass, Boxes, Layout, Layers, Timer, Monitor,
  Accessibility, Box, Workflow, Share2, Scan, Link2, ZapOff, Anchor,
  Wind, Ghost, ShieldCheck, ShieldAlert, ActivitySquare, Binary,
  Orbit, GitBranch, CpuIcon, Lock, Search
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useTheme } from '../../../components/ThemeProvider'
import { useToast } from '../../../contexts/ToastContext'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id ?? null)
  const { resolvedTheme } = useTheme()
  const { showToast } = useToast()

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
    const title = newTitle.trim() || 'New Task'
    try {
      await apiPost('/tasks', { title, parentId: parentId || undefined, status: parentId ? undefined : 'todo' })
      setNewTitle(''); setAddingForParent(null); loadTasks()
    } catch {
      showToast('Failed to create task — please try again.', 'error')
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try { await apiPut(`/tasks/${taskId}`, updates); loadTasks() } catch {
      showToast('Failed to update task — change was not saved.', 'error')
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return
    try { await apiDelete(`/tasks/${taskId}`); setSelectedTask(null); loadTasks() } catch {
      showToast('Failed to delete task — please try again.', 'error')
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
        <CpuIcon size={80} className="text-primary-500 animate-spin mb-12" />
        <span className="text-sm font-bold text-surface-500 uppercase tracking-widest animate-pulse">Syncing Tasks...</span>
     </div>
  )

  const rootNodes = tasks.filter(t => !t.parentId)
  const byStatus = (s: string) => rootNodes.filter(t => t.status === s)

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-5 w-full md:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard" className="w-12 h-12 rounded-xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center shadow-sm flex-shrink-0">
                <Target size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                      Workflow Hub
                    </span>
                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                        {connected ? 'STABLE' : 'DISCONNECTED'}
                    </div>
                 </div>
                 <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mt-2 truncate text-surface-900 dark:text-white uppercase italic">Tasks</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center p-1.5 rounded-xl bg-surface-card border border-surface-200 dark:border-surface-800 shadow-sm">
                 {[
                   { id: 'list', icon: LayoutList, label: 'List' },
                   { id: 'kanban', icon: LayoutGrid, label: 'Kanban' },
                   { id: 'gantt', icon: BarChart3, label: 'Timeline' }
                 ].map(m => (
                   <button type="button" key={m.id} onClick={() => setView(m.id as ViewMode)}
                     className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${view === m.id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 shadow-md scale-105' : 'text-surface-500 hover:text-surface-900 dark:hover:text-surface-100'}`}
                   >
                     <m.icon size={14} /> <span className="hidden sm:inline">{m.label}</span>
                   </button>
                 ))}
              </div>
              
              <button type="button" onClick={() => setSortByUrgency(!sortByUrgency)} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${sortByUrgency ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50 scale-105' : 'bg-surface-card border-surface-200 dark:border-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
              >
                 <Zap size={16} className={sortByUrgency ? 'animate-pulse' : ''} />
                 <span>Urgency Sort</span>
              </button>

              <button type="button" onClick={loadTasks} title="Refresh Tasks" aria-label="Refresh Tasks" className="w-12 h-12 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 flex items-center justify-center hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-lg active:scale-90 border-none">
                <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              </button>
           </div>
        </header>

        {/* Stats HUD */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
           {STATUSES.map((s, i) => (
             <div key={s} className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group hover:border-primary-500/40 transition-all duration-500">
                <div className="flex items-center gap-3 mb-4">
                   <div className={`w-2 h-2 rounded-full ${s === 'done' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} />
                   <p className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em] italic">{STATUS_LABELS[s]}</p>
                </div>
                <div className="flex items-end justify-between">
                   <h4 className="text-4xl font-black text-surface-900 dark:text-white tracking-tight italic">{byStatus(s).length}</h4>
                   <div className="w-12 h-12 rounded-2xl bg-surface-page dark:bg-surface-950 border border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <Target size={20} className="text-surface-400 group-hover:text-primary-500 transition-colors" />
                   </div>
                </div>
                <div className="h-1.5 w-full bg-surface-page dark:bg-surface-800 mt-6 rounded-full overflow-hidden shadow-inner">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${(byStatus(s).length / Math.max(tasks.length, 1)) * 100}%` }} transition={{ duration: 1 }} className={`h-full ${s === 'done' ? 'bg-emerald-500' : 'bg-primary-500'}`} />
                </div>
             </div>
           ))}
        </section>

        {/* Main Workspace */}
        <main className="relative z-10 min-h-[60vh]">
           <AnimatePresence mode="wait">
              {view === 'kanban' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                   {STATUSES.map((s, idx) => (
                     <div key={s} onDragOver={e => { e.preventDefault(); setDragOverStatus(s) }} onDragLeave={() => setDragOverStatus(null)} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) updateTask(id, { status: s }); setDragOverStatus(null) }}
                       className={`flex flex-col rounded-[2.5rem] border transition-all duration-500 min-h-[700px] shadow-xl relative group/lane ${dragOverStatus === s ? 'bg-primary-500/5 border-primary-500/30' : 'bg-surface-card/40 border-surface-200 dark:border-surface-800'}`}
                     >
                        <header className="p-8 border-b border-surface-200 dark:border-surface-800 bg-surface-card/60 rounded-t-[2.5rem] backdrop-blur-3xl shadow-sm">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <div className={`w-3 h-3 rounded-full ${s === 'done' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} />
                                 <h3 className="text-xs font-black text-surface-900 dark:text-white uppercase tracking-[0.2em] italic">{STATUS_LABELS[s]}</h3>
                              </div>
                              <span className="px-3 py-1 rounded-lg bg-surface-page dark:bg-surface-900 border border-surface-100 dark:border-surface-800 text-[11px] font-black text-surface-500 dark:text-surface-400 tabular-nums shadow-inner">{byStatus(s).length}</span>
                           </div>
                        </header>
                        <div className="p-6 flex-1 space-y-6 overflow-y-auto custom-scrollbar bg-surface-page/5">
                           {byStatus(s).map(task => (
                             <TaskCard key={task._id} task={task} onSelect={() => setSelectedTask(task)} onDragStart={() => setDraggedTaskId(task._id)} />
                           ))}
                           {byStatus(s).length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center py-32 opacity-10">
                               <Ghost size={64} className="mb-6" />
                               <p className="text-xs font-black uppercase tracking-[0.4em] italic">Empty Node</p>
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                </motion.div>
              )}

              {view === 'list' && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-8 shadow-2xl transition-all duration-500">
                   <header className="hidden md:flex items-center gap-8 px-6 py-4 mb-6 border-b border-surface-100 dark:border-surface-800 text-[10px] font-black text-surface-400 uppercase tracking-[0.4em] italic">
                      <div className="w-10" />
                      <div className="flex-1">Task Matrix Mapping</div>
                      <div className="w-48">Temporal Limit</div>
                      <div className="w-48 text-right">Operational Actions</div>
                   </header>
                   <div className="space-y-3 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                      {rootNodes.map(task => (
                        <TaskRow key={task._id} task={task} expanded={expandedTasks.has(task._id)} expandedTasks={expandedTasks} expandToggle={(id: string) => setExpandedTasks(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })} onSelect={setSelectedTask} onAddSub={(p: string) => setAddingForParent(p)} onDelete={deleteTask} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} depth={0} />
                      ))}
                      {rootNodes.length === 0 && (
                        <div className="py-48 text-center opacity-10 flex flex-col items-center gap-8">
                          <Wind size={80} />
                          <h3 className="text-4xl font-black uppercase italic tracking-[0.2em]">Null Archive</h3>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}

              {view === 'gantt' && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-10 shadow-2xl overflow-x-auto transition-all duration-500">
                   <div className="min-w-[1400px] space-y-10">
                      <header className="flex items-center gap-10 mb-10 border-b border-surface-100 dark:border-surface-800 pb-8 px-6">
                         <div className="w-96 text-xs font-black text-surface-400 uppercase tracking-[0.4em] italic">Lattice Anchor Node</div>
                         <div className="flex-1 flex justify-between text-[11px] font-black text-surface-300 dark:text-surface-500 uppercase tracking-[0.6em] italic px-16 relative">
                            <span>PAST_STRATA</span>
                            <div className="flex flex-col items-center relative z-10">
                               <div className="w-0.5 h-10 bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,1)]" />
                               <span className="mt-2 text-primary-500 font-black tracking-widest scale-110">PRESENT_PULSE</span>
                            </div>
                            <span>FUTURE_TRAJECTORY</span>
                            <div className="absolute top-5 left-0 right-0 h-px bg-surface-100 dark:bg-surface-800/50 -z-0" />
                         </div>
                      </header>
                      <div className="space-y-4 max-h-[800px] overflow-y-auto pr-6 custom-scrollbar">
                         {rootNodes.slice(0, 50).map((task, idx) => {
                           const now = new Date(), min = new Date(now.getFullYear(), now.getMonth(), -20), max = new Date(now.getFullYear(), now.getMonth() + 2, 20)
                           const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt), end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 7 * 86400000)
                           const left = ((start.getTime() - min.getTime()) / (max.getTime() - min.getTime())) * 100
                           const width = Math.max(2, ((end.getTime() - start.getTime()) / (max.getTime() - min.getTime())) * 100)
                           return (
                             <div key={task._id} className="flex items-center gap-10 group h-14 hover:bg-surface-page dark:hover:bg-primary-500/5 rounded-2xl transition-all duration-500 px-6 border border-transparent hover:border-surface-100 dark:hover:border-primary-500/10">
                                <div className="w-96 truncate text-[13px] font-black text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all flex items-center gap-4 italic uppercase tracking-tight">
                                   <div className={`w-3 h-3 rounded-full ${task.priority === 'urgent' ? 'bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} />
                                   {task.title}
                                </div>
                                <div className="flex-1 h-10 bg-surface-page dark:bg-surface-950/50 rounded-full relative overflow-hidden border border-surface-100 dark:border-surface-800 shadow-inner group-hover:bg-surface-card transition-colors">
                                   <div 
                                     className={`absolute h-4 top-3 rounded-full shadow-lg border border-white/10 group/bar transition-all duration-500 hover:h-6 hover:top-2 hover:brightness-110 ${task.status === 'done' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'}`} 
                                     style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - left)}%` }} 
                                   />
                                </div>
                             </div>
                           )
                         })}
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </main>

        {/* Floating Action HUD */}
        <footer className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-[100]">
           <div className="bg-surface-card/70 backdrop-blur-3xl border-2 border-primary-500/20 p-4 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.4)] flex items-center gap-6 transition-all duration-500 hover:border-primary-500/40">
              <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-xl shadow-primary-500/30 group cursor-pointer hover:rotate-90 transition-transform duration-500" onClick={() => createTask(addingForParent)}>
                <Plus size={28} />
              </div>
              <div className="flex-1 relative">
                 <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTask(addingForParent)} 
                   placeholder={addingForParent ? `Inject sub-particle to lattice node...` : 'Initialize new task particle...'} 
                   className="w-full bg-transparent border-none focus:ring-0 text-xl font-black text-surface-900 dark:text-white placeholder:text-surface-400 italic uppercase tracking-tighter py-3" 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <button type="button" onClick={() => createTask(addingForParent)} 
                    className="px-8 py-4 bg-surface-900 dark:bg-white text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-lg active:scale-95 border-none"
                 >
                    INITIALIZE
                 </button>
                 {addingForParent && (
                    <button type="button" onClick={() => setAddingForParent(null)} aria-label="Cancel new task" title="Cancel new task" className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center border border-rose-500/20 active:scale-90">
                       <X size={20}/>
                    </button>
                 )}
              </div>
           </div>
        </footer>

        {/* Task Modal Overlay */}
        <AnimatePresence>
           {selectedTask && (
             <TaskModal task={selectedTask} onClose={() => { setSelectedTask(null); setAddingForParent(null) }} onUpdate={(u: any) => updateTask(selectedTask._id, u)} onDelete={() => deleteTask(selectedTask._id)} onAddSub={() => { setAddingForParent(selectedTask._id); setSelectedTask(null) }} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} socket={socket} userId={user?.id} />
           )}
        </AnimatePresence>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function TaskCard({ task, onSelect, onDragStart }: any) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
  const priorityColors: Record<string, string> = {
    urgent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50',
    high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50',
    medium: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800/50',
    low: 'bg-surface-100 text-surface-600 border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50'
  }
  
  return (
    <motion.div 
      layout draggable onDragStart={(e: any) => { e.dataTransfer?.setData('text/plain', task._id); onDragStart() }} onClick={onSelect}
      whileHover={{ y: -6, scale: 1.02 }} 
      className="p-6 rounded-[2rem] border border-surface-200 dark:border-surface-800 bg-surface-card hover:border-primary-500/50 transition-all duration-500 cursor-grab active:cursor-grabbing shadow-lg group overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-10 transition-opacity"><ClipboardList size={80} /></div>
      <div className="flex justify-between items-start mb-6 relative z-10">
         <div className="flex-1 mr-4">
            <h4 className="text-[15px] font-black text-surface-900 dark:text-white group-hover:text-primary-500 transition-all leading-tight mb-2 italic uppercase tracking-tight">{task.title}</h4>
            <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest bg-surface-page dark:bg-surface-950 px-2 py-0.5 rounded-md shadow-inner">ID: {task._id.slice(-6).toUpperCase()}</span>
         </div>
         {task.urgencyScore != null && (
           <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 shadow-sm">
              <Zap size={12} className="text-amber-500 animate-pulse" />
              <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 tabular-nums">{task.urgencyScore}</span>
           </div>
         )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-surface-100 dark:border-surface-800 relative z-10">
         <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center gap-2 shadow-inner transition-all ${isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50' : 'bg-surface-page text-surface-500 border-surface-200 dark:bg-surface-800/50 dark:border-surface-700/50'}`}>
            <Clock size={12} className={isOverdue ? 'animate-pulse' : ''} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'NO_DEADLINE'}
         </div>
         <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-inner transition-all ${priorityColors[task.priority]}`}>
            {PRIORITY_LABELS[task.priority]}
         </div>
      </div>
    </motion.div>
  )
}

function TaskRow({ task, expanded, expandedTasks, expandToggle, onSelect, onAddSub, onDelete, getSubtasks, depth }: any) {
  const sub = getSubtasks(task._id), hasSub = sub.length > 0
  return (
    <section>
      <motion.div layout 
        className="flex items-center gap-6 py-4 px-6 rounded-2xl bg-surface-page/30 hover:bg-surface-card border border-transparent hover:border-surface-200 dark:hover:border-primary-500/20 transition-all duration-500 group mb-2 shadow-sm" 
        style={{ '--task-depth': `${depth * 32}px`, marginLeft: 'var(--task-depth)' } as any}
      >
        <button type="button" onClick={() => expandToggle(task._id)} className="w-10 h-10 rounded-xl bg-surface-card dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:scale-110 transition-all shadow-sm">
          {hasSub ? (expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />) : <div className="w-2 h-2 rounded-full bg-surface-300 dark:bg-surface-700" />}
        </button>
        <GripVertical className="text-surface-300 dark:text-surface-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-ns-resize" size={18} />
        
        <button type="button" onClick={() => onSelect(task)} className={`flex-1 text-[15px] font-black text-left truncate transition-all italic uppercase tracking-tight ${task.status === 'done' ? 'text-surface-400 dark:text-surface-600 line-through opacity-50' : 'text-surface-900 dark:text-white'}`}>
          {task.title}
        </button>

        <div className="flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-all duration-500">
           {task.dueDate && <div className="flex items-center gap-2 text-[10px] font-black text-surface-400 uppercase tracking-widest italic leading-none"><Clock size={14} className="text-primary-500" /> {new Date(task.dueDate).toLocaleDateString()}</div>}
           <div className="flex items-center gap-3">
              <button type="button" onClick={() => onAddSub(task._id)} aria-label="Add subtask" title="Add subtask" className="w-10 h-10 rounded-xl bg-surface-card dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500/40 transition-all shadow-lg active:scale-90"><Plus size={18} /></button>
              <button type="button" onClick={() => onDelete(task._id)} aria-label="Delete task" title="Delete task" className="w-10 h-10 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-lg active:scale-90"><Trash2 size={18} /></button>
           </div>
        </div>
      </motion.div>
      <AnimatePresence>
         {expanded && hasSub && (
           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {sub.map((s: any) => <TaskRow key={s._id} task={s} expanded={expandedTasks.has(s._id)} expandedTasks={expandedTasks} expandToggle={expandToggle} onSelect={onSelect} onAddSub={onAddSub} onDelete={onDelete} getSubtasks={getSubtasks} depth={depth + 1} />)}
           </motion.div>
         )}
      </AnimatePresence>
    </section>
  )
}

function TaskModal({ task, onClose, onUpdate, onDelete, onAddSub, getSubtasks, socket, userId }: any) {
  const { showToast: modalToast } = useToast()
  const sub = getSubtasks(task._id), [msg, setMsg] = useState(''), [messages, setMessages] = useState<TaskMessage[]>([]), chatEndRef = useRef<any>(null), [busy, setBusy] = useState(false)

  const fetchMessages = useCallback(async () => { try { const res: any = await apiGet(`/tasks/${task._id}/messages`); setMessages(res?.data?.messages ?? []) } catch { /* silent — messages are non-critical */ } }, [task._id])
  useEffect(() => { fetchMessages(); if (socket) { socket.emit('join:task', { taskId: task._id }); socket.on('task:message', fetchMessages); return () => { socket.off('task:message'); socket.emit('leave:task', { taskId: task._id }) } } }, [task._id, socket, fetchMessages])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSendMessage = async () => {
    const b = msg.trim(); if (!b || busy) return;
    setBusy(true); setMsg('');
    try { await apiPost(`/tasks/${task._id}/messages`, { body: b }); fetchMessages() } catch {
      modalToast('Message failed to send — please try again.', 'error')
    }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-12 bg-surface-950/60 backdrop-blur-3xl" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} transition={{ duration: 0.5, type: 'spring' }}
        className="bg-surface-card rounded-[3.5rem] p-10 max-w-5xl w-full border-2 border-primary-500/20 max-h-[90vh] overflow-y-auto custom-scrollbar relative shadow-[0_100px_300px_rgba(0,0,0,0.8)]" 
        onClick={e => e.stopPropagation()}
      >
         <header className="flex items-center justify-between mb-12 pb-8 border-b border-surface-100 dark:border-surface-800">
            <div className="flex items-center gap-8">
               <div className="w-16 h-16 rounded-[1.8rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-xl">
                  <Target size={32} className="text-primary-500" />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-2">Task Protocol</h2>
                  <div className="flex items-center gap-3">
                     <span className="text-[11px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-3 py-1 rounded-xl border border-primary-500/20 shadow-inner">UID: {task._id.toUpperCase()}</span>
                  </div>
               </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close task modal" title="Close task modal" className="w-12 h-12 rounded-2xl bg-surface-page dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-rose-500 hover:border-rose-500/40 transition-all shadow-inner active:scale-90"><X size={24} /></button>
         </header>

         <main className="space-y-12">
            <div className="space-y-4">
               <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Operational Descriptor</label>
               <input type="text" defaultValue={task.title} onBlur={e => e.target.value !== task.title && onUpdate({ title: e.target.value })}
                 aria-label="Task title"
                 title="Task title"
                 placeholder="Task title"
                 className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-3xl px-8 py-5 text-2xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
               />
            </div>

            <div className="space-y-4">
               <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Intelligence Brief</label>
               <textarea defaultValue={task.description} onBlur={e => e.target.value !== task.description && onUpdate({ description: e.target.value })} rows={5} 
                 className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] px-8 py-6 text-[15px] font-extrabold text-surface-600 dark:text-slate-300 focus:border-primary-500 outline-none transition-all shadow-inner custom-scrollbar italic uppercase tracking-tight backdrop-blur-xl" 
                 placeholder="INITIALIZE_MISSION_PARAMETERS..." 
               />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-4">
                  <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">System Status</label>
                  <div className="relative group">
                     <select value={task.status} onChange={e => onUpdate({ status: e.target.value })}
                       aria-label="Task status"
                       title="Task status"
                       className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-3xl px-8 py-4 text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none appearance-none cursor-pointer shadow-inner backdrop-blur-xl group-hover:bg-surface-card transition-all"
                     >
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s].toUpperCase()}</option>)}
                     </select>
                     <ChevronDown size={20} className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400 group-hover:text-primary-500 transition-colors" />
                  </div>
               </div>
               <div className="space-y-4">
                  <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Operational Urgency</label>
                  <div className="relative group">
                     <select value={task.priority} onChange={e => onUpdate({ priority: e.target.value })}
                       aria-label="Task priority"
                       title="Task priority"
                       className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-3xl px-8 py-4 text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none appearance-none cursor-pointer shadow-inner backdrop-blur-xl group-hover:bg-surface-card transition-all"
                     >
                        {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p].toUpperCase()}</option>)}
                     </select>
                     <ChevronDown size={20} className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400 group-hover:text-primary-500 transition-colors" />
                  </div>
               </div>
            </div>

            {/* Chat/Messages */}
            <section className="space-y-6 pt-12 border-t-2 border-surface-100 dark:border-surface-800">
               <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-surface-page dark:bg-surface-950 border border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner"><MessageSquare size={22} className="text-surface-400" /></div>
                     <h3 className="text-sm font-black text-surface-900 dark:text-white uppercase tracking-[0.5em] italic">Team Uplink Matrix</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] bg-primary-500/10 px-4 py-2 rounded-full border border-primary-500/20 italic shadow-sm">
                     <Radio size={14} className="animate-pulse" /> FORGE_SYNC_ACTIVE
                  </div>
               </div>
               
               <div className="h-[400px] rounded-[3rem] bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-surface-800 overflow-y-auto p-8 space-y-8 custom-scrollbar shadow-inner relative backdrop-blur-xl">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 gap-8">
                       <Ghost size={100} />
                       <p className="text-xl font-black uppercase tracking-[1em] italic">Null Channel</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col gap-2 ${m.userId === userId ? 'items-end' : 'items-start'}`}>
                       <div className="flex items-center gap-4 px-4">
                          <span className={`text-[10px] font-black uppercase tracking-[0.4em] italic ${m.userId === userId ? 'text-primary-500' : 'text-surface-400'}`}>{m.userId === userId ? 'USER_PROXIMITY' : 'TEAM_UPLINK'}</span>
                          <span className="text-[9px] font-black text-surface-300 dark:text-slate-600 uppercase italic tabular-nums">{new Date(m.createdAt).toLocaleTimeString()}</span>
                       </div>
                       <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-[15px] font-extrabold italic uppercase tracking-tight shadow-xl ${m.userId === userId ? 'bg-primary-600 text-white rounded-tr-none border border-primary-500' : 'bg-surface-card border-2 border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white rounded-tl-none'}`}>
                          {m.body}
                       </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>

               <div className="flex gap-4 p-3 bg-surface-card border-2 border-surface-200 dark:border-surface-800 rounded-[2.5rem] focus-within:border-primary-500/50 shadow-2xl transition-all duration-500 group/chat">
                  <input type="text" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    placeholder="Infect the channel with logic..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 px-6 text-[15px] font-black text-surface-900 dark:text-white uppercase italic tracking-tighter h-14" 
                  />
                  <button type="button" onClick={handleSendMessage} disabled={busy}
                    className="px-10 py-4 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.4em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-lg active:scale-95 h-14 border-none"
                  >
                    {busy ? 'Refreshing…' : 'TRANSMIT'}
                  </button>
               </div>
            </section>

            <footer className="flex flex-col sm:flex-row items-center justify-between gap-8 pt-16 border-t-2 border-surface-100 dark:border-surface-800 pb-4">
               <button type="button" onClick={onDelete} className="text-xs font-black text-rose-500 hover:text-rose-600 uppercase tracking-[0.6em] italic transition-all hover:scale-110 active:scale-90 border-none bg-transparent">TERMINATE_PROTOCOL</button>
               <button type="button" onClick={onClose} className="px-16 py-6 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] text-xs font-black uppercase tracking-[0.8em] italic shadow-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:-translate-y-2 transition-all duration-300 border-none">
                  SECURE_&_LEAVE
               </button>
            </footer>
         </main>
      </motion.div>
    </div>
  )
}
