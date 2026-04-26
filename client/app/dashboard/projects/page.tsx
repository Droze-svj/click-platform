'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderKanban, Plus, ChevronRight, Target, GitBranch, BarChart3, 
  RefreshCw, Activity, CheckCircle2, Circle, Shield, Zap, Box, 
  Layout, Layers, Search, Settings2, FileText, Pencil, Link2, 
  Clock, ArrowUpRight, ArrowLeft, Terminal, Cpu, Database, 
  Globe, Radio, Archive, Trash2, X, ChevronDown, ArrowRight, Fingerprint,
  Workflow, Binary, Orbit, Scan, Command, Wind, Ghost,
  Signal, ShieldCheck, ActivityIcon, CpuIcon, HardDrive,
  UserCheck, Key, Anchor, Sparkle
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Milestone {
  _id: string
  title: string
  description?: string
  dueDate?: string | null
  completedAt?: string | null
  dependencyMilestoneIds?: string[]
  estimatedDays?: number
  order?: number
  linkedTaskId?: string | null
  linkedContentId?: string | null
  linkedWorkflowId?: string | null
  automation?: { onComplete: string; config?: Record<string, unknown> }
  criticalPathInfo?: { earliestStart: number; earliestFinish: number; isOnCriticalPath: boolean }
}

interface PmProject {
  _id: string
  name: string
  description?: string
  status: string
  startDate?: string | null
  targetEndDate?: string | null
  progress: number
  milestones?: Milestone[]
  criticalPath?: Record<string, { earliestStart: number; earliestFinish: number; isOnCriticalPath: boolean }>
  criticalPathTotalDays?: number
  aiPredictedCompletionDate?: string | null
  aiPredictionConfidence?: number | null
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-300'

const statusColor: Record<string, string> = {
  planning: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.3)]',
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]',
  on_hold: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.3)]',
  completed: 'text-sky-400 bg-sky-500/10 border-sky-500/20 shadow-[0_0_30px_rgba(14,165,233,0.3)]',
  archived: 'text-slate-500 bg-white/5 border-white/10'
}

const statusLabel: Record<string, string> = {
  planning: 'STRAT_INIT',
  active: 'KINETIC_FLOW',
  on_hold: 'STATIC_STASIS',
  completed: 'COGNITIVE_DONE',
  archived: 'DATA_VAULT'
}

export default function KineticWorkspaceHubPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [projects, setProjects] = useState<PmProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<PmProject | null>(null)
  const [dashboard, setDashboard] = useState<PmProject | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneDays, setNewMilestoneDays] = useState(1)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editEstimatedDays, setEditEstimatedDays] = useState(1)
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list')
  const [projectStatus, setProjectStatus] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const loadLattice = useCallback(async () => {
    try {
      const res: any = await apiGet('/pm/projects')
      setProjects(res?.data?.projects ?? res?.projects ?? [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadLattice()
  }, [user, loadLattice])

  const loadProjectDashboard = useCallback(async (id: string) => {
    setLoadingDashboard(true)
    try {
      const res: any = await apiGet(`/pm/projects/${id}/dashboard`)
      const d = res?.data ?? res
      setDashboard(d)
      if (d?.status) setProjectStatus(d.status)
    } catch {
      setDashboard(null)
    } finally {
      setLoadingDashboard(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProject?._id) loadProjectDashboard(selectedProject._id)
    else setDashboard(null)
  }, [selectedProject?._id, loadProjectDashboard])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await apiPost('/pm/projects', { name: newName.trim(), description: newDescription.trim(), status: 'planning' })
      setShowCreate(false); setNewName(''); setNewDescription(''); await loadLattice()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: '✓ CLUSTERS_INITIATED', type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'INIT_FAIL: NODE_REJECTION', type: 'error' } }))
    } finally { setCreating(false) }
  }

  const completeMilestone = async (projectId: string, milestoneId: string) => {
    try {
      await apiPost(`/pm/projects/${projectId}/milestones/${milestoneId}/complete`, {})
      loadProjectDashboard(projectId); await loadLattice()
    } catch {}
  }

  const addMilestone = async () => {
    if (!selectedProject?._id || !newMilestoneTitle.trim()) return
    setAddingMilestone(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/milestones`, {
        title: newMilestoneTitle.trim(), estimatedDays: newMilestoneDays, dependencyMilestoneIds: []
      })
      setShowAddMilestone(false); setNewMilestoneTitle(''); setNewMilestoneDays(1); loadProjectDashboard(selectedProject._id); await loadLattice()
    } catch {} finally { setAddingMilestone(false) }
  }

  const saveMilestone = async () => {
    if (!dashboard?._id || !editingMilestone) return
    try {
      await apiPut(`/pm/projects/${dashboard._id}/milestones/${editingMilestone._id}`, {
        title: editTitle.trim(), dueDate: editDueDate ? new Date(editDueDate).toISOString() : null, estimatedDays: editEstimatedDays, dependencyMilestoneIds: []
      })
      setEditingMilestone(null); loadProjectDashboard(dashboard._id); await loadLattice()
    } catch {}
  }

  const updateProjectStatus = async (status: string) => {
    if (!dashboard?._id) return
    setSavingProject(true)
    try {
      await apiPut(`/pm/projects/${dashboard._id}`, { status }); setProjectStatus(status); loadProjectDashboard(dashboard._id); await loadLattice()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: '✓ PHASE_SHIFT_SYNCHRONIZED', type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'SYNC_FAIL: STATUS_STASIS', type: 'error' } }))
    } finally { setSavingProject(false) }
  }

  const runPredict = async () => {
    if (!selectedProject?._id) return
    setPredicting(true); setSwarmHUDTask('Quantum Trajectory Forecasting'); setShowSwarmHUD(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/predict`, {})
      loadProjectDashboard(selectedProject._id)
    } catch {} finally { setPredicting(false) }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen font-inter">
        <GitBranch size={64} className="text-indigo-500 animate-spin mb-8" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Synchronizing Cluster Matrix...</span>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <GitBranch size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Shield size={1000} className="text-white absolute -top-80 -right-60 rotate-[32deg] blur-[2px]" />
        </div>

        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* Cluster Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Shield size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Nexus Engine v24.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <Radio size={14} className="text-indigo-400 animate-pulse" />
                       <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic leading-none">{projects.length} ACTIVE_CLUSTERS</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Clusters</h1>
                 <p className="text-slate-400 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Stratified mission nexus for coordinate cluster management and temporal trajectory mapping.</p>
              </div>
           </div>

           <button onClick={() => setShowCreate(true)}
             className="px-16 py-8 bg-white text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center gap-8 italic active:scale-95 group relative overflow-hidden outline-none border-none"
           >
             <div className="absolute inset-x-0 bottom-0 h-2 bg-indigo-300 scale-x-0 group-hover:scale-x-100 transition-transform" />
             <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" /> INITIATE_CLUSTER
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
           {/* Cluster Directory Matrix */}
           <div className="lg:col-span-3 space-y-12">
              <div className="flex items-center justify-between px-8 border-l-4 border-indigo-500/30 ml-2">
                 <span className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.6em] italic leading-none">Operational_Nodes</span>
                 <Activity size={20} className="text-slate-500 animate-pulse" />
              </div>
              <div className="space-y-8 max-h-[1200px] overflow-y-auto pr-6 custom-scrollbar">
                 {projects.map((p) => (
                   <motion.button
                     whileHover={{ x: 15, scale: 1.02 }}
                     key={p._id}
                     onClick={() => setSelectedProject(p)}
                     className={`w-full text-left rounded-[4.5rem] p-12 border-2 transition-all duration-300 group relative overflow-hidden shadow-3xl ${
                       selectedProject?._id === p._id
                         ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_60px_150px_rgba(99,102,241,0.2)]'
                         : 'bg-black/40 border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04]'
                     }`}
                   >
                     <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-300 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><Target size={150} className="text-white" /></div>
                     <div className="flex justify-between items-start mb-8 relative z-10">
                        <span className={`text-[24px] font-black tracking-tighter uppercase italic truncate pr-4 transition-colors duration-300 ${selectedProject?._id === p._id ? 'text-white underline decoration-indigo-500 decoration-4 underline-offset-8' : 'text-slate-700 group-hover:text-white'}`}>{p.name}</span>
                        <div className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 shadow-inner ${statusColor[p.status]}`}>
                           {statusLabel[p.status]}
                        </div>
                     </div>
                     <div className="flex items-center gap-10 relative z-10">
                        <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase italic bg-black/40 px-6 py-2 rounded-full border border-white/5 shadow-inner">
                           <Activity size={16} className={selectedProject?._id === p._id ? 'text-indigo-400 animate-pulse' : ''} /> {p.progress}% SAT
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase italic">
                           <Layers size={16} /> {(p.milestones?.length ?? 0)} NODES
                        </div>
                     </div>
                   </motion.button>
                 ))}
                 {projects.length === 0 && (
                   <div className="py-24 text-center border-4 border-dashed border-white/5 rounded-[4.5rem] opacity-20">
                      <p className="text-[14px] font-black text-white uppercase tracking-[0.4em] italic">NO_CLUSTERS_MAPPED</p>
                   </div>
                 )}
              </div>
           </div>

           {/* Nexus Area */}
           <div className="lg:col-span-9">
              <AnimatePresence mode="wait">
                 {!selectedProject ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${glassStyle} rounded-[6.5rem] p-32 text-center flex flex-col items-center justify-center min-h-[850px] border-2 border-white/5 shadow-[0_80px_200px_rgba(0,0,0,0.8)] relative group overflow-hidden`}>
                       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                       <div className="w-48 h-48 bg-black/60 border-2 border-white/10 rounded-[5.5rem] flex items-center justify-center mb-16 shadow-3xl relative overflow-hidden group-hover:border-indigo-500/50 transition-all duration-700">
                          <Terminal size={80} className="text-slate-500 group-hover:text-indigo-400 transition-all duration-300 group-hover:scale-125 group-hover:rotate-12" />
                       </div>
                       <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-10 leading-none drop-shadow-2xl">Nexus Standby</h3>
                       <p className="text-[18px] text-slate-700 font-black uppercase tracking-[0.8em] max-w-2xl leading-relaxed italic border-t-2 border-white/5 pt-12">Synchronize with an operational cluster node to begin mission coordination and temporal trajectory mapping.</p>
                    </motion.div>
                 ) : loadingDashboard ? (
                    <div className={`${glassStyle} rounded-[6.5rem] p-32 flex flex-col items-center justify-center gap-16 min-h-[850px] border-2 border-white/5`}>
                       <div className="relative w-40 h-40">
                          <div className="absolute inset-0 border-[12px] border-indigo-500/10 rounded-full" />
                          <div className="absolute inset-0 border-[12px] border-t-indigo-500 rounded-full animate-spin shadow-[0_0_100px_rgba(99,102,241,0.6)]" />
                       </div>
                       <span className="text-[16px] font-black uppercase tracking-[1.2em] text-indigo-400 animate-pulse italic">MAPPING_NEURAL_MATRIX...</span>
                    </div>
                 ) : dashboard ? (
                    <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} className="space-y-20">
                       {/* Mission Profile HUD */}
                       <div className={`${glassStyle} rounded-[7rem] p-24 border-2 border-white/10 relative overflow-hidden shadow-[0_100px_250px_rgba(0,0,0,1)] group/hud`}>
                          <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none group-hover/hud:opacity-[0.1] transition-opacity duration-300"><Activity size={600} className="text-indigo-400" /></div>
                          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 blur-[150px] rounded-full opacity-50" />
                          
                          <div className="flex flex-col xl:flex-row justify-between items-start gap-20 relative z-10">
                             <div className="max-w-4xl space-y-12">
                                <div className="flex items-center gap-10">
                                   <div className={`px-10 py-4 rounded-3xl text-[12px] font-black uppercase tracking-[0.4em] border-2 shadow-2xl backdrop-blur-3xl ${statusColor[dashboard.status]}`}>
                                      PHASE: {statusLabel[dashboard.status]}
                                   </div>
                                   <div className="flex items-center gap-5 text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic bg-black/60 px-10 py-4 rounded-3xl border-2 border-white/5 shadow-inner backdrop-blur-3xl">
                                      <Database size={18} className="text-indigo-500" /> NODE_ID: {dashboard._id.slice(-16).toUpperCase()}
                                   </div>
                                </div>
                                <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none pr-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover/hud:text-indigo-400 transition-colors duration-300">{dashboard.name}</h2>
                                <p className="text-[24px] text-slate-500 font-bold uppercase tracking-tight italic leading-relaxed max-w-3xl border-l-8 border-indigo-500/40 pl-12 py-4">{dashboard.description || 'MISSION_BRIEF_UNDEFINED'}</p>
                             </div>

                             <div className="flex flex-col gap-12 w-full xl:w-auto">
                                <div className="space-y-6">
                                   <label className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic leading-none ml-10">CLUSTER_CALIBRATION</label>
                                   <div className="relative group/select">
                                      <select
                                        value={projectStatus || dashboard.status}
                                        onChange={(e) => updateProjectStatus(e.target.value)}
                                        disabled={savingProject}
                                        className="w-full xl:w-[450px] px-14 py-10 bg-black/80 border-2 border-indigo-500/40 rounded-[3.5rem] text-[15px] font-black text-indigo-400 uppercase tracking-[0.4em] focus:outline-none hover:bg-black/95 transition-all cursor-pointer appearance-none italic shadow-[0_0_50px_rgba(99,102,241,0.1)] hover:border-indigo-500 backdrop-blur-3xl"
                                      >
                                        <option value="planning" className="bg-slate-700">PHASE: STRAT_INIT</option>
                                        <option value="active" className="bg-slate-700">PHASE: KINETIC_FLOW</option>
                                        <option value="on_hold" className="bg-slate-700">PHASE: STATIC_STASIS</option>
                                        <option value="completed" className="bg-slate-700">PHASE: COGNITIVE_DONE</option>
                                      </select>
                                      <ChevronDown size={32} className="absolute right-12 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none group-hover/select:translate-y-2 transition-transform duration-700" />
                                   </div>
                                </div>
                                <div className="grid grid-cols-2 gap-10">
                                   <button title="Project Settings" className="p-10 rounded-[3rem] bg-white/[0.03] border-2 border-white/5 text-slate-400 hover:text-white transition-all duration-700 shadow-3xl active:scale-95 hover:border-white/20 backdrop-blur-3xl group"><Settings2 size={40} className="group-hover:rotate-90 transition-transform duration-300" /></button>
                                   <button title="Cluster Archive" className="p-10 rounded-[3rem] bg-rose-500/5 border-2 border-rose-500/10 text-rose-950 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-700 shadow-3xl active:scale-95 hover:border-rose-500 backdrop-blur-3xl"><Trash2 size={40}/></button>
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mt-32 relative z-10">
                             <div className="bg-black/60 border-2 border-white/5 rounded-[5rem] p-16 space-y-12 group/stat hover:border-indigo-500/50 transition-all duration-300 shadow-inner backdrop-blur-3xl">
                                <div className="flex justify-between items-center px-4">
                                   <p className="text-[15px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">Cluster_Saturation</p>
                                   <Activity size={28} className="text-slate-500 group-hover/stat:text-indigo-400 transition-colors duration-300 animate-pulse" />
                                </div>
                                <div className="flex items-end gap-8 px-4">
                                   <span className="text-6xl font-black text-white italic tabular-nums leading-none tracking-tighter drop-shadow-2xl">{dashboard.progress}%</span>
                                   <span className="text-[13px] font-black text-slate-500 uppercase mb-4 tracking-[0.4em] italic">NEURAL_SAT</span>
                                </div>
                                <div className="h-4 w-full bg-black/60 rounded-full overflow-hidden shadow-inner border-2 border-white/5 mx-auto">
                                   <motion.div initial={{ width: 0 }} animate={{ width: `${dashboard.progress}%` }} transition={{ duration: 2, ease: "easeOut" }} className="h-full bg-gradient-to-r from-indigo-700 via-indigo-500 to-indigo-400 shadow-[0_0_40px_rgba(99,102,241,1)]" />
                                </div>
                             </div>

                             <div className="bg-black/60 border-2 border-white/5 rounded-[5rem] p-16 space-y-12 group/stat hover:border-emerald-500/50 transition-all duration-300 shadow-inner backdrop-blur-3xl">
                                <div className="flex justify-between items-center px-4">
                                   <p className="text-[15px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">Quantum_Forecast</p>
                                   <Radio size={28} className="text-slate-500 group-hover/stat:text-emerald-400 transition-colors animate-pulse duration-300" />
                                </div>
                                {dashboard.aiPredictedCompletionDate ? (
                                  <div className="space-y-10 px-4">
                                     <span className="text-6xl font-black text-emerald-400 italic tabular-nums leading-none tracking-tighter uppercase block drop-shadow-2xl">{new Date(dashboard.aiPredictedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                                     <div className="flex items-center gap-8">
                                        <div className="flex-1 h-3 bg-black/60 rounded-full overflow-hidden border-2 border-white/5">
                                           <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.7)]" style={{ width: `${(dashboard.aiPredictionConfidence ?? 0) * 100}%` }} />
                                        </div>
                                        <span className="text-[13px] font-black text-emerald-500 uppercase italic whitespace-nowrap tabular-nums tracking-widest leading-none">{Math.round((dashboard.aiPredictionConfidence ?? 0) * 100)}% CONSENSUS</span>
                                     </div>
                                  </div>
                                ) : (
                                  <div className="h-40 flex items-center justify-center border-4 border-dashed border-white/5 rounded-[4rem]">
                                     <p className="text-[18px] font-black text-slate-500 uppercase tracking-[0.8em] italic">SIGNAL_OFFLINE</p>
                                  </div>
                                )}
                             </div>

                             <motion.button
                               whileHover={{ scale: 1.05, y: -15 }}
                               whileTap={{ scale: 0.95 }}
                               onClick={runPredict}
                               disabled={predicting}
                               className="rounded-[5rem] bg-white border-8 border-transparent hover:border-indigo-500/30 text-black p-16 flex flex-col items-center justify-center gap-10 shadow-[0_80px_200px_rgba(255,255,255,0.1)] hover:shadow-indigo-500/50 transition-all duration-300 disabled:opacity-30 group/btn relative overflow-hidden"
                             >
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                                <div className="w-24 h-24 rounded-[3rem] bg-black border-2 border-white/20 flex items-center justify-center shadow-3xl group-hover/btn:rotate-[360deg] transition-transform duration-500 relative z-10">
                                   <Zap size={48} className={`text-white ${predicting ? 'animate-pulse' : ''}`} />
                                </div>
                                <span className="text-[22px] font-black uppercase tracking-[0.6em] italic leading-none underline decoration-indigo-500 decoration-8 underline-offset-[12px] relative z-10">{predicting ? 'CALIBRATING...' : 'RUN_FORECAST'}</span>
                             </motion.button>
                          </div>
                       </div>

                       {/* Objective Mapping Terminal */}
                       <section className={`${glassStyle} rounded-[7rem] p-24 border-2 border-white/5 shadow-[0_80px_200px_rgba(0,0,0,0.8)] relative overflow-hidden group/terminal`}>
                          <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none group-hover/terminal:opacity-[0.08] transition-opacity duration-300"><Terminal size={500} className="text-white" /></div>
                          <div className="flex flex-col xl:flex-row justify-between items-center mb-24 gap-12 relative z-10">
                             <div className="flex items-center gap-12">
                                <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl group-hover/terminal:scale-110 transition-transform duration-300"><Target size={48} className="text-indigo-400" /></div>
                                <div>
                                   <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Objective Terminal</h3>
                                   <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">Stratified mission nodes and temporal trajectory lattices.</p>
                                </div>
                             </div>

                             <div className="flex items-center gap-8 p-5 bg-black/60 rounded-[4.5rem] border-2 border-white/10 shadow-inner backdrop-blur-3xl">
                                <button onClick={() => setViewMode('list')} className={`px-14 py-8 rounded-[3.5rem] text-[13px] font-black uppercase tracking-[0.6em] transition-all duration-300 italic border-none outline-none ${viewMode === 'list' ? 'bg-white text-black shadow-3xl scale-110' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>LATTICE_VIEW</button>
                                <button onClick={() => setViewMode('gantt')} className={`px-14 py-8 rounded-[3.5rem] text-[13px] font-black uppercase tracking-[0.6em] transition-all duration-300 italic border-none outline-none flex items-center gap-8 ${viewMode === 'gantt' ? 'bg-white text-black shadow-3xl scale-110' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><BarChart3 size={28} /> TEMPORAL_MESH</button>
                                <div className="w-[2px] h-10 bg-white/5 mx-2" />
                                <button onClick={() => setShowAddMilestone(true)} className="px-14 py-8 text-indigo-400 text-[13px] font-black uppercase tracking-[0.6em] italic hover:text-white transition-all group/add border-none outline-none bg-transparent flex items-center gap-6"><Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" /> NODE_INJECT</button>
                             </div>
                          </div>

                          <div className="relative z-10 min-h-[500px]">
                             {!dashboard.milestones?.length ? (
                                <div className="py-72 text-center flex flex-col items-center justify-center opacity-[0.05] gap-20">
                                   <div className="w-64 h-64 rounded-[7rem] bg-white/5 border-2 border-white/10 flex items-center justify-center shadow-inner"><Cpu size={150} className="text-white animate-pulse" /></div>
                                   <div className="space-y-8">
                                      <h4 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Objective Void</h4>
                                      <p className="text-[22px] font-black text-slate-600 uppercase tracking-[1.2em] italic leading-none">No directive nodes mapped to this cluster cycle.</p>
                                   </div>
                                </div>
                             ) : viewMode === 'gantt' ? (
                                <div className="space-y-16 pr-12 overflow-x-auto custom-scrollbar pb-16 pt-8">
                                   {dashboard.milestones.map((m) => {
                                     const totalDays = Math.max(1, dashboard.criticalPathTotalDays ?? 1)
                                     const startPct = ((m.criticalPathInfo?.earliestStart ?? 0) / totalDays) * 100
                                     const widthPct = Math.max(5, (((m.criticalPathInfo?.earliestFinish ?? 0) - (m.criticalPathInfo?.earliestStart ?? 0)) / totalDays) * 100)
                                     return (
                                       <div key={m._id} className="flex items-center gap-24 group min-w-[1400px]">
                                         <div className="w-96 truncate flex items-center gap-10">
                                           <div className={`w-5 h-5 rounded-full shadow-3xl ${m.completedAt ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]' : m.criticalPathInfo?.isOnCriticalPath ? 'bg-indigo-500 animate-pulse shadow-[0_0_25px_rgba(99,102,241,1)]' : 'bg-slate-700 border-2 border-white/5 shadow-inner'}`} />
                                           <span className={`text-[26px] font-black italic uppercase tracking-tighter transition-colors duration-300 group-hover:text-indigo-400 ${m.completedAt ? 'text-slate-400' : 'text-white'}`}>{m.title}</span>
                                         </div>
                                         <div className="flex-1 h-20 bg-black/60 border-2 border-white/5 rounded-[3rem] relative overflow-hidden group-hover:bg-black/95 transition-all duration-700 shadow-inner backdrop-blur-3xl">
                                           <motion.div 
                                             initial={{ scaleX: 0 }} 
                                             animate={{ scaleX: 1 }}
                                             transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
                                             className={`absolute h-12 top-4 rounded-3xl ${m.criticalPathInfo?.isOnCriticalPath ? 'bg-indigo-600 shadow-[0_0_60px_rgba(99,102,241,0.8)]' : 'bg-slate-800 border-2 border-white/5'} ${m.completedAt ? 'opacity-20 blur-[2px]' : ''}`}
                                             style={{ left: `${startPct}%`, width: `${Math.min(widthPct, 100 - startPct)}%`, originX: 0 }}
                                           />
                                         </div>
                                         <div className="w-40 text-right">
                                            <span className="text-[16px] font-black text-slate-500 uppercase tracking-[0.4em] tabular-nums italic">{m.estimatedDays || 0} CYC</span>
                                         </div>
                                       </div>
                                     )
                                   })}
                                </div>
                             ) : (
                                <div className="space-y-10">
                                   {dashboard.milestones.map((m) => (
                                     <motion.div
                                       layout
                                       key={m._id}
                                       className={`flex items-center gap-16 p-14 rounded-[6rem] border-2 transition-all duration-300 relative overflow-hidden group shadow-3xl backdrop-blur-3xl ${
                                         m.criticalPathInfo?.isOnCriticalPath
                                           ? 'border-indigo-500/50 bg-indigo-500/[0.05] shadow-[0_0_100px_rgba(99,102,241,0.1)]'
                                           : 'border-white/5 bg-black/60 hover:bg-white/[0.05] hover:border-indigo-500/30'
                                       } ${m.completedAt ? 'opacity-40 grayscale-[0.8] hover:grayscale-0' : ''}`}
                                     >
                                        <div className="absolute top-0 right-0 p-24 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500 pointer-events-none -rot-12 scale-150"><Target size={300} className="text-white" /></div>
                                        
                                        <button onClick={() => !m.completedAt && completeMilestone(dashboard._id, m._id)} className="shrink-0 relative outline-none border-none bg-transparent">
                                           <div className={`w-28 h-28 rounded-[3.5rem] flex items-center justify-center border-4 transition-all duration-[1.5s] shadow-3xl ${m.completedAt ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-black/90 border-white/10 text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/70 group-hover:scale-110 group-hover:rotate-12'}`}>
                                              {m.completedAt ? <CheckCircle2 size={56} className="drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" /> : <Circle size={56} />}
                                           </div>
                                        </button>

                                        <div className="flex-1 min-w-0">
                                           <div className="flex items-center gap-10 mb-6">
                                              <h4 className={`text-[36px] font-black italic uppercase tracking-tighter truncate leading-none transition-colors duration-300 ${m.completedAt ? 'text-slate-400' : 'text-white group-hover:text-indigo-400'}`}>{m.title}</h4>
                                              {m.criticalPathInfo?.isOnCriticalPath && !m.completedAt && (
                                                <div className="px-6 py-2 bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.4em] rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-pulse border-none italic">CRITICAL_TRAJECTORY</div>
                                              )}
                                           </div>
                                           <div className="flex items-center gap-16">
                                              <div className="flex items-center gap-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.4em] italic group-hover:text-slate-600 transition-colors bg-black/40 px-6 py-2 rounded-full border border-white/5 shadow-inner backdrop-blur-3xl"><Clock size={18} className="text-indigo-500" /> {m.estimatedDays || 0} Cycles</div>
                                              {m.automation?.onComplete && m.automation.onComplete !== 'none' && (
                                                <div className="flex items-center gap-5 text-[13px] font-black text-purple-600 uppercase tracking-[0.4em] italic animate-pulse bg-purple-500/5 px-6 py-2 rounded-full border border-purple-500/20"><Cpu size={18} className="text-purple-500" /> AUTO: {m.automation.onComplete.toUpperCase()}</div>
                                              )}
                                              {m.linkedTaskId && (
                                                <button onClick={() => router.push(`/dashboard/tasks?open=${m.linkedTaskId}`)} className="text-[13px] font-black text-indigo-400 hover:text-white uppercase tracking-[0.4em] italic flex items-center gap-5 transition-all border-none bg-transparent underline underline-offset-8 decoration-indigo-500/30 hover:decoration-white"><Link2 size={18} /> VIEW_TARGET_NODE</button>
                                              )}
                                           </div>
                                        </div>

                                        <div className="flex items-center gap-16 shrink-0 pr-8">
                                           {m.dueDate && (
                                             <div className="flex flex-col items-end">
                                                <span className="text-[13px] font-black text-slate-500 uppercase tracking-[0.6em] italic mb-3">THRESHOLD</span>
                                                <span className="text-[20px] font-black text-slate-700 uppercase italic leading-none tabular-nums opacity-60 group-hover:opacity-100 transition-all duration-300">{new Date(m.dueDate).toLocaleDateString().toUpperCase()}</span>
                                             </div>
                                           )}
                                           <div className="h-24 w-[2px] bg-white/5" />
                                           <button onClick={() => setEditingMilestone(m)} className="w-20 h-20 bg-white/[0.03] border-2 border-white/10 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-700 shadow-3xl active:scale-90 hover:border-indigo-500/50 backdrop-blur-3xl group/edit"><Pencil size={32} className="group-hover/edit:rotate-12 transition-transform" /></button>
                                        </div>
                                     </motion.div>
                                   ))}
                                </div>
                             )}
                          </div>
                       </section>
                    </motion.div>
                 ) : null}
              </AnimatePresence>
           </div>
        </div>

        {/* Modal Overlays */}
        <AnimatePresence>
           {showCreate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-3xl">
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} className={`${glassStyle} w-full max-w-4xl rounded-[7rem] p-24 border-2 border-white/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-300 shadow-inner"><Zap size={400} className="text-white" /></div>
                    <div className="flex justify-between items-center mb-24 relative z-10">
                       <div>
                          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Cluster Initiation</h2>
                          <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">NODE_MATRIX_UPLINK_INITIALIZATION</p>
                       </div>
                       <button onClick={() => setShowCreate(false)} title="Close Modal" className="w-20 h-20 bg-white/5 border-2 border-white/5 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-3xl active:scale-90 hover:border-white/20 hover:rotate-90 duration-700 backdrop-blur-3xl"><X size={40} /></button>
                    </div>
                    
                    <div className="space-y-16 relative z-10">
                       <div className="space-y-8">
                          <label htmlFor="cluster-id" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">CLUSTER_IDENTIFIER</label>
                          <input
                            id="cluster-id"
                            type="text"
                            placeholder="INPUT_NODE_DESIGNATION..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-16 py-10 text-[24px] font-black text-white uppercase tracking-tighter italic placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-3xl"
                          />
                       </div>
                       <div className="space-y-8">
                          <label htmlFor="mission-params" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">MISSION_PARAMETERS</label>
                          <textarea
                            id="mission-params"
                            placeholder="DESCRIBE_OPERATIONAL_OBJECTIVES..."
                            rows={4}
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="w-full bg-black/80 border-2 border-white/5 rounded-[5rem] px-16 py-10 text-[18px] font-black text-indigo-400 uppercase tracking-widest italic placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner resize-none backdrop-blur-3xl"
                          />
                       </div>

                       <div className="flex gap-10 pt-10">
                          <button onClick={() => setShowCreate(false)} className="flex-1 py-10 rounded-[4rem] bg-white/5 border-2 border-white/5 text-slate-400 text-[18px] font-black uppercase tracking-[0.8em] italic hover:text-white hover:bg-white/10 transition-all shadow-3xl backdrop-blur-3xl">ABORT_SYNCH</button>
                          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="flex-1 py-10 rounded-[4rem] bg-white border-8 border-transparent hover:border-indigo-500/30 text-black text-[18px] font-black uppercase tracking-[0.8em] italic shadow-2xl hover:shadow-indigo-500/50 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-10">
                             {creating ? <RefreshCw className="animate-spin" size={32} /> : <Zap size={32} className="fill-current" />}
                             {creating ? 'SYNCHRONIZING...' : 'INSTANTIATE_CLUSTER'}
                          </button>
                       </div>
                    </div>
                 </motion.div>
              </div>
           )}

           {showAddMilestone && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-3xl">
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} className={`${glassStyle} w-full max-w-4xl rounded-[7rem] p-24 border-2 border-white/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-300 shadow-inner"><Target size={400} className="text-white" /></div>
                    <div className="flex justify-between items-center mb-20 relative z-10">
                       <div>
                          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Node Injection</h2>
                          <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">APPENDING_MISSION_CRITICAL_ANCHOR</p>
                       </div>
                       <button onClick={() => setShowAddMilestone(false)} title="Close Modal" className="w-20 h-20 bg-white/5 border-2 border-white/5 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-3xl active:scale-90 hover:border-white/20 hover:rotate-90 duration-700 backdrop-blur-3xl"><X size={40} /></button>
                    </div>

                    <div className="space-y-12 relative z-10">
                       <div className="space-y-6">
                          <label htmlFor="node-id-new" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">NODE_IDENTIFIER</label>
                          <input
                            id="node-id-new"
                            type="text"
                            placeholder="OBJECTIVE_TITLE..."
                            value={newMilestoneTitle}
                            onChange={(e) => setNewMilestoneTitle(e.target.value)}
                            className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-16 py-8 text-[22px] font-black text-white uppercase tracking-tighter italic placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-3xl"
                          />
                       </div>

                       <div className="space-y-6">
                          <label htmlFor="cycle-new" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">CYCLE_ESTIMATION [DAYS]</label>
                          <input
                            id="cycle-new"
                            type="number"
                            min={1}
                            value={newMilestoneDays}
                            onChange={(e) => setNewMilestoneDays(Number(e.target.value) || 1)}
                            className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-14 py-8 text-[18px] font-black text-indigo-400 uppercase tracking-widest italic focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-3xl"
                          />
                       </div>

                       <div className="flex gap-10 pt-8">
                          <button onClick={() => setShowAddMilestone(false)} className="flex-1 py-8 rounded-[4rem] bg-white/5 border-2 border-white/5 text-slate-400 text-[18px] font-black uppercase tracking-[0.8em] italic hover:text-white hover:bg-white/10 transition-all shadow-3xl backdrop-blur-3xl">CANCEL_OPS</button>
                          <button onClick={addMilestone} disabled={addingMilestone || !newMilestoneTitle.trim()} className="flex-1 py-8 rounded-[4rem] bg-white border-8 border-transparent hover:border-indigo-500/30 text-black text-[18px] font-black uppercase tracking-[0.8em] italic shadow-2xl hover:shadow-indigo-500/50 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-10">
                             {addingMilestone ? <RefreshCw className="animate-spin" size={28} /> : <Target size={28} className="fill-current" />}
                             {addingMilestone ? 'INJECTING...' : 'INJECT_NODE'}
                          </button>
                       </div>
                    </div>
                 </motion.div>
              </div>
           )}

           {editingMilestone && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-3xl">
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} className={`${glassStyle} w-full max-w-4xl rounded-[7rem] p-24 border-2 border-white/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden`} onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-500 shadow-inner"><Pencil size={400} className="text-white" /></div>
                    <div className="flex justify-between items-center mb-20 relative z-10">
                       <div>
                          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Calibrate Node</h2>
                          <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.6em] italic leading-none">MODIFYING_OBJECTIVE_VECTOR</p>
                       </div>
                       <button onClick={() => setEditingMilestone(null)} title="Close Modal" className="w-20 h-20 bg-white/5 border-2 border-white/5 rounded-3xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-3xl active:scale-90 hover:border-white/20 hover:rotate-90 duration-700 backdrop-blur-3xl"><X size={40} /></button>
                    </div>

                    <div className="space-y-12 relative z-10">
                       <div className="space-y-6">
                          <label htmlFor="node-id-edit" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">NODE_IDENTIFIER</label>
                          <input
                            id="node-id-edit"
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-16 py-8 text-[22px] font-black text-white uppercase tracking-tighter italic placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-3xl"
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-10">
                          <div className="space-y-6">
                             <label htmlFor="threshold-edit" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">TEMPORAL_THRESHOLD</label>
                             <input
                               id="threshold-edit"
                               type="date"
                               value={editDueDate}
                               onChange={(e) => setEditDueDate(e.target.value)}
                               className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-14 py-8 text-[18px] font-black text-indigo-400 uppercase tracking-widest italic focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner [color-scheme:dark] backdrop-blur-3xl"
                             />
                          </div>
                          <div className="space-y-6">
                             <label htmlFor="cycle-edit" className="text-[14px] font-black text-slate-500 uppercase tracking-[0.8em] italic ml-10">CYCLE_ESTIMATION</label>
                             <input
                               id="cycle-edit"
                               type="number"
                               value={editEstimatedDays}
                               onChange={(e) => setEditEstimatedDays(Number(e.target.value) || 1)}
                               className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-14 py-8 text-[18px] font-black text-indigo-400 uppercase tracking-widest italic focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner backdrop-blur-3xl"
                             />
                          </div>
                       </div>

                       <div className="flex gap-10 pt-8">
                          <button onClick={() => setEditingMilestone(null)} className="flex-1 py-8 rounded-[4rem] bg-white/5 border-2 border-white/5 text-slate-400 text-[18px] font-black uppercase tracking-[0.8em] italic hover:text-white hover:bg-white/10 transition-all shadow-3xl backdrop-blur-3xl">ABORT_CALIBRATION</button>
                          <button onClick={saveMilestone} className="flex-1 py-8 rounded-[4rem] bg-white border-8 border-transparent hover:border-indigo-500/30 text-black text-[18px] font-black uppercase tracking-[0.8em] italic shadow-2xl hover:shadow-indigo-500/50 transition-all active:scale-95 flex items-center justify-center gap-10">
                             <CheckCircle2 size={32} /> SAVE_CALIBRATION
                          </button>
                       </div>
                    </div>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>
        
        <ToastContainer />

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
          select { -webkit-appearance: none; appearance: none; cursor: pointer; }
          input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
          .shadow-22xl { shadow-sm: 0 40px 100px rgba(0,0,0,0.8); }
        `}</style>
     </div>
    </ErrorBoundary>
  )
}
