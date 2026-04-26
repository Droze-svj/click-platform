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
  Orbit, GitBranch, CpuIcon, Lock
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

// ── Sovereign Constants ───────────────────────────────────────────────────────

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done']
const STATUS_LABELS: Record<string, string> = {
  backlog: 'DORMANT_OBJECTIVE',
  todo: 'ACTIVE_NODE',
  in_progress: 'KINETIC_EXECUTION',
  review: 'VALIDATION_PHASE',
  done: 'OBJECTIVE_SECURED'
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABELS: Record<string, string> = {
  low: 'MINIMAL_FLUX',
  medium: 'STANDARD_OPS',
  high: 'CRITICAL_NODE',
  urgent: 'IMMINENT_SURGE'
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

export default function KineticExecutionMatrixPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id ?? null)
  
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

  const loadLattice = useCallback(async () => {
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

  useEffect(() => { loadLattice() }, [loadLattice])

  useEffect(() => {
    if (!socket) return
    const h = () => loadLattice()
    on('tasks:update', h)
    return () => off('tasks:update', h)
  }, [socket, on, off, loadLattice])

  const createTaskNode = async (parentId?: string | null) => {
    const title = newTitle.trim() || 'UNTITLED_DIRECTIVE_NODE'
    try {
      await apiPost('/tasks', { title, parentId: parentId || undefined, status: parentId ? undefined : 'todo' })
      setNewTitle(''); setAddingForParent(null); loadLattice()
    } catch {}
  }

  const updateNode = async (taskId: string, updates: Partial<Task>) => {
    try { await apiPut(`/tasks/${taskId}`, updates); loadLattice() } catch {}
  }

  const purgeNode = async (taskId: string) => {
    if (!confirm('CRITICAL: TERMINATE_DIRECTIVE_NODE?_THIS_WILL_PURGE_ALL_LINKED_RESONANCE.')) return
    try { await apiDelete(`/tasks/${taskId}`); setSelectedTask(null); loadLattice() } catch {}
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <CpuIcon size={80} className="text-emerald-500 animate-spin mb-12 drop-shadow-[0_0_40px_rgba(16,185,129,0.5)]" />
        <span className="text-[16px] font-black text-slate-400 uppercase tracking-[1em] animate-pulse italic">Synchronizing Kinetic Directives...</span>
     </div>
  )

  const rootNodes = tasks.filter(t => !t.parentId)
  const byStatus = (s: string) => rootNodes.filter(t => t.status === s)

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1900px] mx-auto space-y-20">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Orbit size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Kinetic Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-100" />
                <Target size={48} className="text-emerald-400 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-emerald-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-emerald-400 italic leading-none">Kinetic Lattice v14.9.2</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]' : 'bg-rose-500 animate-ping'}`} />
                       <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic leading-none">{connected ? 'MESH_RESONANCE_STABLE' : 'SIGNAL_INTERRUPTED'}</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Kinetic Matrix</h1>
                 <p className="text-slate-400 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Mission-critical orchestration of sovereign objective nodes and kinetic execution lanes.</p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-8 p-3 rounded-[3.5rem] bg-white/[0.02] border-2 border-white/10 backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
              <nav className="flex items-center gap-4 p-2">
                 {[
                   { id: 'list', icon: LayoutList, label: 'NODAL_LATTICE' },
                   { id: 'kanban', icon: LayoutGrid, label: 'OPERATIONAL_CLUSTERS' },
                   { id: 'gantt', icon: BarChart3, label: 'CHRONOS_RESOLUTION' }
                 ].map(m => (
                   <button key={m.id} onClick={() => setView(m.id as ViewMode)}
                     className={`px-12 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] transition-all duration-700 italic flex items-center gap-6 ${view === m.id ? 'bg-white text-black shadow-2xl scale-110' : 'text-slate-400 hover:text-white hover:bg-white/5 shadow-inner'}`}
                   >
                     <m.icon size={20} /> {m.label}
                   </button>
                 ))}
              </nav>
              <div className="h-16 w-1 bg-white/5 mx-2 rounded-full" />
              <button onClick={() => setSortByUrgency(!sortByUrgency)} 
                className={`flex items-center gap-8 px-14 py-6 rounded-[2.8rem] border-2 transition-all duration-300 italic shadow-2xl hover:scale-105 active:scale-95 ${sortByUrgency ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.2)]' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'}`}
              >
                 <Zap size={24} className={sortByUrgency ? 'animate-pulse' : ''} />
                 <span className="text-[13px] font-black uppercase tracking-[0.5em]">URGENCY_FLUX_SORT</span>
              </button>
           </div>
        </header>

        {/* Global Cluster Status HUD */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-12 relative z-10">
           {STATUSES.map((s, i) => (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
               key={s} className={`${glassStyle} rounded-[4.5rem] p-12 relative overflow-hidden group border-white/5 hover:bg-white/[0.06] shadow-[0_60px_150px_rgba(0,0,0,0.8)] cursor-pointer bg-black/40`}
             >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-300 group-hover:rotate-12 group-hover:scale-150 transition-transform"><Layers size={200} className="text-white" /></div>
                <div className="flex items-center gap-4 mb-6">
                   <div className={`w-2 h-2 rounded-full ${i === 4 ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'} shadow-[0_0_10px_rgba(99,102,241,1)]`} />
                   <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] italic leading-none">{STATUS_LABELS[s]}</p>
                </div>
                <div className="flex items-end justify-between gap-8">
                   <p className="text-7xl font-black text-white italic tracking-tighter leading-none">{byStatus(s).length}</p>
                   <div className="w-16 h-16 rounded-[2.2rem] bg-white/[0.03] flex items-center justify-center border-2 border-white/10 group-hover:scale-125 transition-all duration-300 group-hover:bg-indigo-600/20 group-hover:border-indigo-500/50">
                      <Target size={32} className="text-white opacity-20 group-hover:opacity-100 transition-opacity" />
                   </div>
                </div>
                <div className="h-2 w-full bg-white/5 mt-10 rounded-full overflow-hidden shadow-inner">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${(byStatus(s).length / Math.max(tasks.length, 1)) * 100}%` }} transition={{ duration: 2, ease: "easeOut" }} className={`h-full ${i === 4 ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]' : 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)]'}`} />
                </div>
             </motion.div>
           ))}
        </section>

        {/* Main Directive Plane */}
        <main className="relative z-10">
           <AnimatePresence mode="wait">
              {view === 'kanban' && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-12">
                   {STATUSES.map((s, idx) => (
                     <div key={s} onDragOver={e => { e.preventDefault(); setDragOverStatus(s) }} onDragLeave={() => setDragOverStatus(null)} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) updateNode(id, { status: s }); setDragOverStatus(null) }}
                       className={`flex flex-col rounded-[5.5rem] border-2 transition-all duration-300 min-h-[900px] shadow-[0_80px_200px_rgba(0,0,0,0.8)] relative group/lane ${dragOverStatus === s ? 'bg-emerald-500/10 border-emerald-400/50 ring-[20px] ring-emerald-500/5' : 'bg-black/60 border-white/5 hover:border-white/10'}`}
                     >
                        <header className="p-12 border-b-2 border-white/5 relative overflow-hidden rounded-t-[5.5rem] bg-white/[0.02]">
                           <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover/lane:rotate-90 transition-transform duration-300"><Scan size={200} /></div>
                           <div className="flex items-center justify-between relative z-10">
                              <div className="flex items-center gap-6">
                                 <div className={`w-3 h-3 rounded-full ${s === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'} shadow-[0_0_15px_rgba(99,102,241,1)] animate-pulse`} />
                                 <h3 className="text-[14px] font-black text-white uppercase tracking-[0.6em] italic leading-none">{STATUS_LABELS[s]}</h3>
                              </div>
                              <span className="px-5 py-2 rounded-2xl bg-black/60 border-2 border-white/10 flex items-center justify-center text-[12px] font-black text-indigo-400 tabular-nums shadow-inner italic">L0{idx + 1}::{byStatus(s).length}</span>
                           </div>
                        </header>
                        <div className="p-10 flex-1 space-y-10 overflow-y-auto custom-scrollbar bg-black/20">
                           {byStatus(s).map(task => (
                             <DirectiveCard key={task._id} task={task} onSelect={() => setSelectedTask(task)} onDragStart={() => setDraggedTaskId(task._id)} />
                           ))}
                           {byStatus(s).length === 0 && <div className="h-full flex flex-col items-center justify-center py-32 opacity-[0.02] group-hover/lane:opacity-[0.08] transition-opacity"><Ghost size={120} className="mb-8" /><p className="text-[16px] font-black uppercase tracking-[1em] italic">CLUSTER_VOID</p></div>}
                        </div>
                     </div>
                   ))}
                </motion.div>
              )}

              {view === 'list' && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`${glassStyle} rounded-[7rem] p-24 shadow-[0_100px_300px_rgba(0,0,0,0.9)] relative bg-black/60 border-white/5`}>
                   <div className="absolute inset-0 opacity-[0.02] pointer-events-none p-32"><Workflow size={1000} className="text-white" /></div>
                   <header className="flex items-center gap-12 mb-12 border-b-2 border-white/5 pb-12 px-10">
                      <div className="w-[48px]" />
                      <div className="w-[48px]" />
                      <div className="flex-1 text-[13px] font-black text-slate-400 uppercase tracking-[1em] italic">DIRECTIVE_LATTICE_IDENTIFIER</div>
                      <div className="w-96 flex items-center justify-between px-10">
                         <span className="text-[13px] font-black text-slate-400 uppercase tracking-[1em] italic">CHRONOS_EXPIRY</span>
                         <span className="text-[13px] font-black text-slate-400 uppercase tracking-[1em] italic">OPERATIONS</span>
                      </div>
                   </header>
                   <div className="space-y-6 relative z-10 max-h-[1200px] overflow-y-auto pr-10 custom-scrollbar">
                      {rootNodes.map(task => (
                        <DirectiveRow key={task._id} task={task} expanded={expandedTasks.has(task._id)} expandedTasks={expandedTasks} expandToggle={(id: string) => setExpandedTasks(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })} onSelect={setSelectedTask} onAddSub={(p: string) => setAddingForParent(p)} onPurge={purgeNode} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} depth={0} />
                      ))}
                      {rootNodes.length === 0 && <div className="py-64 text-center opacity-10"><Wind size={120} className="mx-auto mb-10 text-white" /><h3 className="text-6xl font-black uppercase tracking-tighter italic">Lattice Empty</h3></div>}
                   </div>
                </motion.div>
              )}

              {view === 'gantt' && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`${glassStyle} rounded-[7rem] p-32 shadow-[0_120px_400px_rgba(0,0,0,1)] overflow-x-auto relative bg-black/60 border-none`}>
                   <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-300"><Timer size={1000} className="text-white" /></div>
                   <div className="min-w-[1600px] space-y-16 relative z-10">
                      <header className="flex items-center gap-16 mb-24 border-b-4 border-white/5 pb-16 px-12">
                         <div className="w-[500px] flex items-center gap-8">
                            <Anchor size={32} className="text-indigo-400" />
                            <div className="text-[16px] font-black text-white uppercase tracking-[1.5em] italic leading-none">OBJECTIVE_CHRONOS_ANCHOR</div>
                         </div>
                         <div className="flex-1 flex justify-between text-[14px] font-black text-slate-400 uppercase tracking-[1em] italic px-24">
                            <span>T_PAST_RESONANCE</span>
                            <div className="flex flex-col items-center">
                               <div className="w-1 h-12 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                               <span className="mt-4 text-indigo-400">NOW_SYNC</span>
                            </div>
                            <span>T_FUTURE_TRAJECTORY</span>
                         </div>
                      </header>
                      <div className="space-y-4 max-h-[1000px] overflow-y-auto pr-10 custom-scrollbar">
                         {rootNodes.slice(0, 50).map((task, idx) => {
                           const now = new Date(), min = new Date(now.getFullYear(), now.getMonth(), -20), max = new Date(now.getFullYear(), now.getMonth() + 2, 20)
                           const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt), end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 7 * 86400000)
                           const left = ((start.getTime() - min.getTime()) / (max.getTime() - min.getTime())) * 100
                           const width = Math.max(2, ((end.getTime() - start.getTime()) / (max.getTime() - min.getTime())) * 100)
                           return (
                             <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                               key={task._id} className="flex items-center gap-16 group h-24 hover:bg-white/[0.02] rounded-[3rem] transition-all px-12"
                             >
                                <div className="w-[450px] truncate text-[24px] font-black text-white italic uppercase tracking-tighter group-hover:text-emerald-400 transition-all duration-700 flex items-center gap-6">
                                   <div className={`w-4 h-4 rounded-full ${task.priority === 'urgent' ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'} shadow-[0_0_15px_rgba(99,102,241,0.5)]`} />
                                   {task.title}
                                </div>
                                <div className="flex-1 h-16 bg-black/60 border-2 border-white/5 rounded-[4rem] relative overflow-hidden group-hover:border-white/20 transition-all shadow-inner">
                                   <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(width, 100 - left)}%` }} transition={{ duration: 1.5, delay: 0.5 }}
                                     className={`absolute h-10 top-3 rounded-[3rem] shadow-[0_0_60px_rgba(16,185,129,0.3)] border-2 border-white/20 relative group/bar ${task.status === 'done' ? 'bg-emerald-600' : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500'}`} 
                                     style={{ left: `${Math.max(0, left)}%` }} 
                                   >
                                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                                   </motion.div>
                                </div>
                             </motion.div>
                           )
                         })}
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </main>

        {/* Nodal Injector HUD (Command Center) */}
        <footer className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-6xl px-12 z-[100]">
           <div className={`${glassStyle} rounded-[6rem] p-4 flex items-center gap-6 border-emerald-500/30 shadow-[0_100px_300px_rgba(0,0,0,1)] ring-[20px] ring-black/80 group hover:border-emerald-500/60 transition-all duration-300 backdrop-blur-3xl bg-black/40`}>
              <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-600 text-white flex items-center justify-center group-hover:rotate-180 transition-transform duration-300 shadow-[0_0_50px_rgba(16,185,129,0.4)] border-4 border-black/40"><Plus size={44} /></div>
              <div className="flex-1 relative">
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity"><Terminal size={28} className="text-emerald-400" /></div>
                 <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTaskNode(addingForParent)} 
                   placeholder={addingForParent ? `Inject child резонанс for [NODE_ID::${addingForParent.slice(-8).toUpperCase()}]...` : 'Initialize NEW sovereign directive node in the matrix...'} 
                   className="w-full bg-transparent border-none focus:ring-0 text-4xl font-black text-white uppercase tracking-tighter placeholder:text-slate-600 italic pl-16 py-8 h-20" autoComplete="off" title="Node Inject" 
                 />
              </div>
              <button onClick={() => createTaskNode(addingForParent)} 
                className="px-16 py-8 bg-white text-black rounded-[2.8rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-emerald-500 hover:text-white transition-all duration-300 italic active:scale-90 shadow-2xl border-none"
              >
                Sync_Inject_Node
              </button>
              {addingForParent && <button onClick={() => setAddingForParent(null)} className="w-16 h-16 rounded-[2rem] bg-rose-950/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-700 flex items-center justify-center border-none mr-4 active:scale-75"><X size={32}/></button>}
           </div>
        </footer>

        {/* Sovereign Detail Modal Overlay */}
        <AnimatePresence>
           {selectedTask && (
             <DirectiveModal task={selectedTask} onClose={() => { setSelectedTask(null); setAddingForParent(null) }} onUpdate={(u: any) => updateNode(selectedTask._id, u)} onPurge={() => purgeNode(selectedTask._id)} onAddSub={() => { setAddingForParent(selectedTask._id); setSelectedTask(null) }} getSubtasks={(pid: string) => tasks.filter(t => t.parentId === pid)} socket={socket} userId={user?.id} userDisplayName={user?.name || user?.email} />
           )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.4); }
          select { -webkit-appearance: none; appearance: none; cursor: pointer; }
          @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .glow-effect { animation: glow 3s infinite; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function DirectiveCard({ task, onSelect, onDragStart }: any) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
  const priorityStyle = task.priority === 'urgent' ? 'border-rose-500/30 bg-rose-500/5 text-rose-500 shadow-[0_0_40px_rgba(225,29,72,0.1)]' : task.priority === 'high' ? 'border-amber-500/30 bg-amber-500/5 text-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'border-white/5 bg-white/5 text-slate-400'
  
  return (
    <motion.div 
      layout draggable onDragStart={(e: any) => { e.dataTransfer?.setData('text/plain', task._id); onDragStart() }} onClick={onSelect}
      whileHover={{ scale: 1.05, y: -20, rotate: 1 }} 
      className="p-12 rounded-[5rem] border-2 border-white/5 bg-black/60 hover:border-emerald-500/50 hover:bg-white/[0.04] transition-all duration-300 cursor-grab active:cursor-grabbing group shadow-[0_60px_150px_rgba(0,0,0,0.8)] relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-300 pointer-events-none group-hover:scale-150 group-hover:-rotate-12 transition-transform"><ActivitySquare size={300} className="text-white" /></div>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="flex justify-between items-start mb-10 relative z-10">
         <div className="space-y-2 flex-1 mr-4">
            <h4 className="text-[28px] font-black italic uppercase tracking-tighter text-white group-hover:text-emerald-400 transition-colors duration-300 leading-[0.9]">{task.title}</h4>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic font-mono">ID::{task._id.slice(-8).toUpperCase()}</span>
         </div>
         {task.urgencyScore != null && (
           <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/80 border-2 border-amber-500/20 shadow-2xl">
              <Zap size={18} className="text-amber-500 animate-pulse" />
              <span className="text-[14px] font-black text-amber-500 italic tabular-nums leading-none">{task.urgencyScore}</span>
           </div>
         )}
      </div>

      <div className="space-y-8 relative z-10 border-t border-white/5 pt-8">
         <div className="flex flex-wrap items-center gap-6">
            <div className={`flex items-center gap-3 px-6 py-2 rounded-full border-2 text-[11px] font-black uppercase tracking-widest italic transition-all duration-700 ${isOverdue ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_30px_rgba(225,29,72,0.2)]' : 'bg-black/60 border-white/10 text-slate-500'}`}>
               <Timer size={16} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString().toUpperCase() : 'NO_TIME_LOCK'}
            </div>
            <div className={`flex items-center gap-3 px-6 py-2 rounded-full border-2 text-[11px] font-black uppercase tracking-widest italic transition-all duration-300 ${priorityStyle}`}>
               {PRIORITY_LABELS[task.priority]}
            </div>
         </div>
         <div className="flex items-center justify-between opacity-20 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex -space-x-4">
               {[1,2].map(i => <div key={i} className="w-10 h-10 rounded-full bg-slate-800 border-4 border-black group-hover:border-emerald-500/30 transition-colors" />)}
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
               <Share2 size={16} className="text-slate-500" /> {Math.floor(Math.random() * 5)} LINKS_ACTIVE
            </div>
         </div>
      </div>
      {!task.read && <div className="absolute top-8 right-8 w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,1)] animate-pulse" />}
    </motion.div>
  )
}

function DirectiveRow({ task, expanded, expandedTasks, expandToggle, onSelect, onAddSub, onPurge, getSubtasks, depth }: any) {
  const sub = getSubtasks(task._id), hasSub = sub.length > 0
  return (
    <section>
      <motion.div layout initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-12 py-10 px-12 rounded-[5rem] bg-black/40 hover:bg-white/[0.04] border-2 border-transparent hover:border-white/10 transition-all duration-300 group relative mb-3 shadow-2xl" 
        style={{ marginLeft: `${depth * 64}px` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <button onClick={() => expandToggle(task._id)} className="w-14 h-14 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-700 shadow-2xl active:scale-75 relative z-10">{hasSub ? (expanded ? <ChevronDown size={28} /> : <ChevronRight size={28} />) : <div className="w-3 h-3 rounded-full bg-slate-700 group-hover:bg-emerald-500 transition-colors shadow-inner" />}</button>
        <GripVertical className="text-slate-500 opacity-0 group-hover:opacity-40 transition-opacity relative z-10 cursor-ns-resize" size={24} />
        
        <button onClick={() => onSelect(task)} className={`flex-1 text-[36px] font-black italic uppercase tracking-tighter text-left truncate transition-all duration-300 relative z-10 ${task.status === 'done' ? 'text-slate-500 line-through opacity-40' : 'text-slate-500 group-hover:text-white group-hover:translate-x-4'}`}>
          {task.title}
        </button>

        <div className="flex items-center gap-12 px-12 opacity-0 group-hover:opacity-100 transition-all duration-300 relative z-10 translate-x-12 group-hover:translate-x-0">
           {task.dueDate && <div className="flex items-center gap-4 text-[12px] font-black uppercase tracking-widest text-slate-400 italic px-8 py-3 rounded-[2.5rem] bg-black/60 border-2 border-white/5 shadow-inner"><Clock size={16} /> {new Date(task.dueDate).toLocaleDateString().toUpperCase()}</div>}
           <div className="flex items-center gap-6">
              <button onClick={() => onAddSub(task._id)} className="w-16 h-16 rounded-[2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-700 shadow-2xl active:scale-75"><Plus size={28} /></button>
              <button onClick={() => onPurge(task._id)} className="w-16 h-16 rounded-[2rem] bg-rose-950/20 border-2 border-rose-500/10 flex items-center justify-center text-rose-500/30 hover:text-rose-400 hover:bg-rose-500/20 transition-all duration-700 shadow-2xl active:scale-75"><Trash2 size={28} /></button>
           </div>
        </div>
      </motion.div>
      <AnimatePresence>
         {expanded && hasSub && (
           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {sub.map((s: any) => <DirectiveRow key={s._id} task={s} expanded={expandedTasks.has(s._id)} expandedTasks={expandedTasks} expandToggle={expandToggle} onSelect={onSelect} onAddSub={onAddSub} onPurge={onPurge} getSubtasks={getSubtasks} depth={depth + 1} />)}
           </motion.div>
         )}
      </AnimatePresence>
    </section>
  )
}

function DirectiveModal({ task, onClose, onUpdate, onPurge, onAddSub, getSubtasks, socket, userId, userDisplayName }: any) {
  const sub = getSubtasks(task._id), [msg, setMsg] = useState(''), [messages, setMessages] = useState<TaskMessage[]>([]), chatEndRef = useRef<any>(null), [busy, setBusy] = useState(false)
  
  const fetchMsg = useCallback(async () => { try { const res: any = await apiGet(`/tasks/${task._id}/messages`); setMessages(res?.data?.messages ?? []) } catch {} }, [task._id])
  useEffect(() => { fetchMsg(); if (socket) { socket.emit('join:task', { taskId: task._id }); socket.on('task:message', fetchMsg); return () => { socket.off('task:message'); socket.emit('leave:task', { taskId: task._id }) } } }, [task._id, socket, fetchMsg])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleInject = async () => {
    const b = msg.trim(); if (!b || busy) return;
    setBusy(true); setMsg('');
    try { await apiPost(`/tasks/${task._id}/messages`, { body: b }); fetchMsg() } catch {}
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/98 backdrop-blur-[60px]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.8, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 100 }} transition={{ type: "spring", damping: 30 }}
        className={`${glassStyle} rounded-[7rem] p-32 max-w-7xl w-full border-white/20 max-h-[92vh] overflow-y-auto custom-scrollbar relative shadow-[0_0_400px_rgba(0,0,0,1)] bg-black/20 ring-[40px] ring-black/40`} 
        onClick={e => e.stopPropagation()}
      >
         <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none rotate-12 scale-150"><Compass size={600} className="text-white" /></div>
         
         <header className="flex items-center justify-between mb-24 relative z-10 border-b-4 border-white/5 pb-16">
            <div className="flex items-center gap-16">
               <div className="w-28 h-28 rounded-[3.5rem] bg-emerald-500/10 border-4 border-emerald-500/30 flex items-center justify-center shadow-[0_40px_100px_rgba(16,185,129,0.3)] animate-pulse relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent" />
                  <Target size={56} className="text-emerald-400 relative z-10" />
               </div>
               <div>
                  <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Node_Diagnostic</h2>
                  <div className="flex items-center gap-6">
                     <span className="text-[14px] font-black text-emerald-400 uppercase tracking-[0.8em] italic leading-none bg-emerald-500/5 px-8 py-3 rounded-[2rem] border-2 border-emerald-500/20 shadow-inner">ID::{task._id.toUpperCase()}</span>
                     <div className="flex items-center gap-4 px-6 py-2 rounded-full border-2 border-white/5 shadow-inner">
                        <div className="w-4 h-4 rounded-full bg-indigo-500 glow-effect" />
                        <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest italic">RESONANCE_HEARTBEAT_STABLE</span>
                     </div>
                  </div>
               </div>
            </div>
            <button onClick={onClose} className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-4 border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all duration-300 hover:rotate-180 hover:bg-rose-500/20 active:scale-75 shadow-2xl"><X size={44} /></button>
         </header>

         <main className="space-y-20 relative z-10">
            <section className="space-y-10 group/field">
               <label className="text-[15px] font-black text-slate-400 uppercase tracking-[1em] italic leading-none ml-10 group-focus-within/field:text-emerald-400 transition-colors">DIRECTIVE_DESIGNATION_NODE</label>
               <input type="text" defaultValue={task.title} onBlur={e => e.target.value !== task.title && onUpdate({ title: e.target.value })} 
                 className="w-full bg-black/80 border-4 border-white/10 rounded-[4.5rem] px-16 py-12 text-7xl font-black text-white italic uppercase tracking-tighter focus:border-emerald-500/50 transition-all duration-300 shadow-2xl outline-none" 
               />
            </section>

            <section className="space-y-10 group/field">
               <label className="text-[15px] font-black text-slate-400 uppercase tracking-[1em] italic leading-none ml-10 group-focus-within/field:text-indigo-400 transition-colors">SOVEREIGN_PARAMETRIC_BRIEF</label>
               <textarea defaultValue={task.description} onBlur={e => e.target.value !== task.description && onUpdate({ description: e.target.value })} rows={6} 
                 className="w-full bg-black/80 border-4 border-white/10 rounded-[5.5rem] px-16 py-16 text-4xl font-black text-slate-500 italic uppercase tracking-tighter focus:border-indigo-500/50 transition-all duration-300 placeholder:text-slate-600 leading-relaxed shadow-2xl outline-none custom-scrollbar" 
                 placeholder="OUTLINE_CORE_MISSION_OBJECTIVES..." 
               />
            </section>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
               <section className="space-y-10 group/field">
                  <label className="text-[15px] font-black text-slate-400 uppercase tracking-[1em] italic leading-none ml-10 group-focus-within/field:text-indigo-400 transition-colors">RESONANCE_PHASE_STATE</label>
                  <div className="relative group/select">
                     <select value={task.status} onChange={e => onUpdate({ status: e.target.value })} 
                       className="w-full bg-black/80 border-4 border-white/10 rounded-[4rem] px-16 py-12 text-[20px] font-black text-white uppercase tracking-[0.8em] italic shadow-[0_40px_100px_rgba(0,0,0,0.4)] focus:border-indigo-500/50 outline-none appearance-none cursor-pointer"
                     >
                        {STATUSES.map(s => <option key={s} value={s} className="bg-[#050505] text-white">{STATUS_LABELS[s]}</option>)}
                     </select>
                     <ChevronDown size={40} className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-hover/select:opacity-100 transition-opacity" />
                  </div>
               </section>
               <section className="space-y-10 group/field">
                  <label className="text-[15px] font-black text-slate-400 uppercase tracking-[1em] italic leading-none ml-10 group-focus-within/field:text-amber-400 transition-colors">CRITICALITY_FLUX_THRESHOLD</label>
                  <div className="relative group/select">
                     <select value={task.priority} onChange={e => onUpdate({ priority: e.target.value })} 
                       className="w-full bg-black/80 border-4 border-white/10 rounded-[4rem] px-16 py-12 text-[20px] font-black text-white uppercase tracking-[0.8em] italic shadow-[0_40px_100px_rgba(0,0,0,0.4)] focus:border-amber-500/50 outline-none appearance-none cursor-pointer"
                     >
                        {PRIORITIES.map(p => <option key={p} value={p} className="bg-[#050505] text-white">{PRIORITY_LABELS[p]}</option>)}
                     </select>
                     <ChevronDown size={40} className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-hover/select:opacity-100 transition-opacity" />
                  </div>
               </section>
            </div>

            <section className="space-y-10 pt-20 border-t-4 border-white/5">
               <div className="flex items-center justify-between mb-8 px-10">
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center animate-bounce shadow-2xl"><Network size={28} className="text-indigo-400" /></div>
                     <h3 className="text-[16px] font-black text-white uppercase tracking-[1.2em] italic">SOVEREIGN_MESH_RESONANCE_CHANNEL</h3>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] font-black text-indigo-400 uppercase tracking-[0.5em] italic bg-indigo-500/5 px-6 py-2 rounded-full border-2 border-white/5 group relative overflow-hidden">
                     <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />
                     <Radio size={16} /> SIGNAL_SYNCED_V12.0
                  </div>
               </div>
               
               <div className="h-[500px] rounded-[6rem] bg-black/90 border-4 border-white/5 overflow-y-auto p-16 space-y-12 custom-scrollbar shadow-inner relative group/chat">
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none z-10 opacity-60" />
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 gap-8">
                       <MessageSquare size={120} />
                       <p className="text-3xl font-black uppercase tracking-[1em] italic">Mesh Matrix Quiescent</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div initial={{ opacity: 0, x: m.userId === userId ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} key={i} className={`flex flex-col gap-4 ${m.userId === userId ? 'items-end' : 'items-start'}`}>
                       <div className="flex items-center gap-6 mb-3 px-6">
                          <span className={`text-[12px] font-black uppercase tracking-[0.8em] italic ${m.userId === userId ? 'text-indigo-400' : 'text-slate-400'}`}>{m.userId === userId ? 'CONTROLLER_NODE' : 'EXTERNAL_PHANTOM'}</span>
                          <span className="text-[10px] font-black text-slate-500 uppercase italic font-mono">{new Date(m.createdAt).toLocaleTimeString()}</span>
                       </div>
                       <div className={`max-w-[85%] p-12 rounded-[4.5rem] italic text-[24px] font-black uppercase tracking-tighter shadow-2xl leading-tight border-2 ${m.userId === userId ? 'bg-indigo-600 text-white border-white/20 rounded-tr-none shadow-indigo-600/40 translate-x-4' : 'bg-black/80 border-white/10 text-slate-400 rounded-tl-none -translate-x-4'}`}>
                          {m.body}
                       </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-10 opacity-60" />
               </div>

               <div className="flex gap-6 p-4 bg-black/80 border-4 border-white/10 rounded-[6.5rem] group/input focus-within:border-emerald-500/50 shadow-[0_60px_150px_rgba(0,0,0,0.8)] transition-all duration-300 mt-10">
                  <div className="w-16 flex items-center justify-center border-r-2 border-white/5 h-20"><Binary size={28} className="text-slate-500 group-focus-within/input:text-emerald-500 transition-colors" /></div>
                  <input type="text" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInject()} 
                    placeholder="ENTER_SYNC_BURST_FOR_MESH_TRANSMISSION..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 px-10 text-[24px] font-black text-white uppercase tracking-tighter placeholder:text-slate-600 italic h-20" 
                  />
                  <button onClick={handleInject} disabled={busy}
                    className="px-20 py-8 bg-white text-black rounded-[4rem] text-[20px] font-black uppercase tracking-[0.8em] hover:bg-emerald-500 hover:text-white transition-all duration-300 italic active:scale-90 shadow-2xl border-none h-20"
                  >
                    {busy ? 'SYNC...' : 'INJECT_BURST'}
                  </button>
               </div>
            </section>

            <footer className="flex flex-col sm:flex-row items-center justify-between gap-16 pt-24 border-t-4 border-white/10 pb-10">
               <button onClick={onPurge} className="text-[20px] font-black text-rose-500/10 hover:text-rose-600 uppercase tracking-[1em] transition-all duration-300 italic hover:scale-110 active:scale-75">TERMINATE_RESONANCE_DATA</button>
               <button onClick={onClose} className="px-32 py-10 bg-white text-black rounded-[5.5rem] text-[24px] font-black uppercase tracking-[1em] shadow-[0_0_150px_rgba(255,255,255,0.2)] hover:bg-indigo-600 hover:text-white transition-all duration-300 italic active:scale-95 group/seal">
                  <div className="flex items-center gap-8"><Lock size={32} className="group-hover/seal:animate-pulse" /> SEAL_DIRECTIVE_PARAMETERS</div>
               </button>
            </footer>
         </main>
      </motion.div>
    </div>
  )
}
