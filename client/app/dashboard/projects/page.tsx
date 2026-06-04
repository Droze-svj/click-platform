'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderKanban, Plus, ChevronRight, Target, BarChart3,
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
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import { useTranslation } from '../../../hooks/useTranslation'

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

const statusColor: Record<string, string> = {
  planning: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/50',
  active: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/50',
  on_hold: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/50',
  completed: 'text-primary-600 bg-primary-50 border-primary-200 dark:text-primary-400 dark:bg-primary-900/20 dark:border-primary-800/50',
  archived: 'text-surface-500 bg-surface-50 border-surface-200 dark:text-surface-400 dark:bg-surface-800/50 dark:border-surface-700/50'
}

const statusLabel: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived'
}

export default function ProjectsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
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

  const loadProjects = useCallback(async () => {
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
    loadProjects()
  }, [user, loadProjects])

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
      setShowCreate(false); setNewName(''); setNewDescription(''); await loadProjects()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastMissionInitialized'), type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastCreateFailed'), type: 'error' } }))
    } finally { setCreating(false) }
  }

  const completeMilestone = async (projectId: string, milestoneId: string) => {
    try {
      await apiPost(`/pm/projects/${projectId}/milestones/${milestoneId}/complete`, {})
      loadProjectDashboard(projectId); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastCompleteMilestoneFailed'), type: 'error' } }))
    }
  }

  const addMilestone = async () => {
    if (!selectedProject?._id || !newMilestoneTitle.trim()) return
    setAddingMilestone(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/milestones`, {
        title: newMilestoneTitle.trim(), estimatedDays: newMilestoneDays, dependencyMilestoneIds: []
      })
      setShowAddMilestone(false); setNewMilestoneTitle(''); setNewMilestoneDays(1); loadProjectDashboard(selectedProject._id); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastAddMilestoneFailed'), type: 'error' } }))
    } finally { setAddingMilestone(false) }
  }

  const saveMilestone = async () => {
    if (!dashboard?._id || !editingMilestone) return
    try {
      await apiPut(`/pm/projects/${dashboard._id}/milestones/${editingMilestone._id}`, {
        title: editTitle.trim(), dueDate: editDueDate ? new Date(editDueDate).toISOString() : null, estimatedDays: editEstimatedDays, dependencyMilestoneIds: []
      })
      setEditingMilestone(null); loadProjectDashboard(dashboard._id); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastSaveMilestoneFailed'), type: 'error' } }))
    }
  }

  const updateProjectStatus = async (status: string) => {
    if (!dashboard?._id) return
    setSavingProject(true)
    try {
      await apiPut(`/pm/projects/${dashboard._id}`, { status }); setProjectStatus(status); loadProjectDashboard(dashboard._id); await loadProjects()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastStatusUpdated'), type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastStatusUpdateFailed'), type: 'error' } }))
    } finally { setSavingProject(false) }
  }

  const runPredict = async () => {
    if (!selectedProject?._id) return
    setPredicting(true); setSwarmHUDTask(t('projectsPage.analyzingTrajectory')); setShowSwarmHUD(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/predict`, {})
      loadProjectDashboard(selectedProject._id)
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastPredictFailed'), type: 'error' } }))
    } finally { setPredicting(false) }
  }

  if (loading) return (
     <div className="min-h-screen bg-surface-page transition-colors duration-500 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1700px] mx-auto space-y-12" aria-busy="true" aria-label={t('projectsPage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="space-y-3">
           {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1700px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} aria-label={t('projectsPage.backToDashboard')} title={t('projectsPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <FolderKanban size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('projectsPage.campaignHub')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {t('projectsPage.activeCount', { count: projects.length })}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('projectsPage.title')}</h1>
              </div>
           </div>

           <button type="button" onClick={() => setShowCreate(true)}
             className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] italic shadow-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all flex items-center gap-4 active:scale-95 border-none"
           >
             <Plus size={22} /> {t('projectsPage.initializeMission')}
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
           {/* Sidebar - Project List */}
           <aside className="lg:col-span-3 space-y-8">
              <div className="flex items-center justify-between px-6">
                 <span className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.projectMatrix')}</span>
                 <Activity size={18} className="text-primary-500 animate-pulse" />
              </div>
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                 {projects.map((p) => (
                   <motion.button
                     key={p._id}
                     onClick={() => setSelectedProject(p)}
                     className={`w-full text-left rounded-[2.5rem] p-6 border-2 transition-all duration-500 group relative overflow-hidden shadow-xl ${
                       selectedProject?._id === p._id
                         ? 'bg-primary-500/5 border-primary-500 shadow-[0_20px_50px_rgba(99,102,241,0.1)]'
                         : 'bg-surface-card border-surface-100 dark:border-surface-800 hover:border-primary-500/40 hover:bg-surface-page'
                     }`}
                   >
                     <div className="flex justify-between items-start mb-6">
                        <span className="text-xl font-black tracking-tight truncate pr-4 text-surface-900 dark:text-white uppercase italic leading-none">{p.name}</span>
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border italic leading-none ${statusColor[p.status]}`}>
                           {(t(`projectsPage.status_${p.status}`) || statusLabel[p.status]).toUpperCase()}
                        </div>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-widest italic">
                           <Activity size={14} className={selectedProject?._id === p._id ? 'text-primary-500' : ''} /> {p.progress}%
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-widest italic">
                           <Layers size={14} /> {p.milestones?.length || 0}
                        </div>
                     </div>
                   </motion.button>
                 ))}
                 {projects.length === 0 && (
                   <div className="py-24 text-center border-2 border-dashed border-surface-100 dark:border-surface-800 rounded-[2.5rem] opacity-20">
                      <p className="text-[10px] font-black text-surface-400 uppercase tracking-[0.4em] italic">{t('projectsPage.noMissionsLogged')}</p>
                   </div>
                 )}
              </div>
           </aside>

           {/* Main Content - Project Dashboard */}
           <main className="lg:col-span-9">
              <AnimatePresence mode="wait">
                 {!selectedProject ? (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-16 text-center flex flex-col items-center justify-center min-h-[750px] shadow-2xl relative overflow-hidden group">
                       <div className="w-32 h-32 bg-surface-page dark:bg-surface-950 rounded-3xl flex items-center justify-center mb-10 shadow-inner border border-surface-100 dark:border-surface-800 transition-transform duration-700 group-hover:rotate-12">
                          <Terminal size={64} className="text-surface-300 dark:text-slate-800 group-hover:text-primary-500 transition-colors" />
                       </div>
                       <h3 className="text-5xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-6">{t('projectsPage.awaitingAssignment')}</h3>
                       <p className="text-surface-500 dark:text-slate-400 text-sm font-medium max-w-md italic uppercase tracking-tight leading-relaxed">{t('projectsPage.awaitingAssignmentDescription')}</p>
                    </motion.div>
                 ) : loadingDashboard ? (
                    <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-16 flex flex-col items-center justify-center gap-8 min-h-[750px] shadow-2xl">
                       <RefreshCw className="w-16 h-16 text-primary-500 animate-spin" />
                       <span className="text-[11px] font-black text-surface-400 uppercase tracking-[0.6em] animate-pulse italic">{t('projectsPage.syncingProjectNode')}</span>
                    </div>
                 ) : dashboard ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                       {/* Project Summary */}
                       <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
                          <div className="flex flex-col xl:flex-row justify-between items-start gap-12 relative z-10">
                             <div className="max-w-4xl space-y-8">
                                <div className="flex items-center gap-4">
                                   <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm italic leading-none ${statusColor[dashboard.status]}`}>
                                      {(t(`projectsPage.status_${dashboard.status}`) || statusLabel[dashboard.status]).toUpperCase()}
                                   </div>
                                   <div className="flex items-center gap-3 text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-surface-page dark:bg-surface-950 px-4 py-1.5 rounded-xl border border-surface-100 dark:border-surface-800 italic shadow-inner">
                                      {t('projectsPage.idLabel', { id: dashboard._id.slice(-8).toUpperCase() })}
                                   </div>
                                </div>
                                <h2 className="text-5xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none group-hover:text-primary-500 transition-colors duration-500">{dashboard.name}</h2>
                                <p className="text-lg font-bold text-surface-500 dark:text-slate-400 leading-relaxed italic uppercase tracking-tight max-w-3xl">{dashboard.description || t('projectsPage.missionParametersUndefined')}</p>
                             </div>

                             <div className="flex flex-col gap-4 w-full xl:w-80">
                                <label className="text-[11px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.operationalStatus')}</label>
                                <div className="relative group/select">
                                   <select aria-label={t('projectsPage.operationalStatus')}
                                     value={projectStatus || dashboard.status}
                                     onChange={(e) => updateProjectStatus(e.target.value)}
                                     disabled={savingProject}
                                     className="w-full px-8 py-5 bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none transition-all cursor-pointer appearance-none shadow-inner backdrop-blur-xl group-hover/select:bg-surface-card"
                                   >
                                     <option value="planning">{t('projectsPage.optionPlanning')}</option>
                                     <option value="active">{t('projectsPage.optionActive')}</option>
                                     <option value="on_hold">{t('projectsPage.optionOnHold')}</option>
                                     <option value="completed">{t('projectsPage.optionCompleted')}</option>
                                   </select>
                                   <ChevronDown size={22} className="absolute right-8 top-1/2 -translate-y-1/2 text-surface-400 group-hover/select:text-primary-500 pointer-events-none transition-colors" />
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                             <div className="bg-surface-page/50 dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] p-8 space-y-6 shadow-inner backdrop-blur-xl">
                                <div className="flex justify-between items-center">
                                   <p className="text-[10px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.neuralProgress')}</p>
                                   <Activity size={20} className="text-primary-500" />
                                </div>
                                <div className="flex items-end gap-3">
                                   <span className="text-5xl font-black text-surface-900 dark:text-white tabular-nums italic leading-none">{dashboard.progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-card dark:bg-surface-800 rounded-full overflow-hidden shadow-inner border border-surface-100 dark:border-surface-800">
                                   <motion.div initial={{ width: 0 }} animate={{ width: `${dashboard.progress}%` }} transition={{ duration: 2, type: 'spring' }} className="h-full bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                                </div>
                             </div>

                             <div className="bg-surface-page/50 dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] p-8 space-y-6 shadow-inner backdrop-blur-xl">
                                <div className="flex justify-between items-center">
                                   <p className="text-[10px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.aiForecast')}</p>
                                   <RefreshCw size={20} className="text-emerald-500" />
                                </div>
                                {dashboard.aiPredictedCompletionDate ? (
                                  <div className="space-y-3">
                                     <span className="text-3xl font-black text-emerald-500 dark:text-emerald-400 uppercase italic tracking-tighter leading-none block">{new Date(dashboard.aiPredictedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                                     <span className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] italic leading-none">{t('projectsPage.confidenceStability', { percent: Math.round((dashboard.aiPredictionConfidence ?? 0) * 100) })}</span>
                                  </div>
                                ) : (
                                  <div className="py-4 text-center opacity-20">
                                     <p className="text-[11px] font-black uppercase tracking-[0.4em] italic">{t('projectsPage.nullPrediction')}</p>
                                  </div>
                                )}
                             </div>

                             <button
                               onClick={runPredict}
                               disabled={predicting}
                               className="bg-primary-600 dark:bg-white text-white dark:text-black p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:bg-primary-500 dark:hover:bg-primary-100 hover:text-white dark:hover:text-primary-600 active:scale-95 border-none group/predict"
                             >
                                <Zap size={40} className={`transition-all duration-500 ${predicting ? 'animate-pulse' : 'group-hover:scale-125'}`} />
                                <span className="text-[11px] font-black uppercase tracking-[0.5em] italic leading-none">{predicting ? t('projectsPage.calibrating') : t('projectsPage.runForecast')}</span>
                             </button>
                          </div>
                       </section>

                       {/* Milestones / Objectives */}
                       <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 shadow-2xl">
                          <header className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-8 pb-10 border-b border-surface-100 dark:border-surface-800">
                             <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-primary-500/10 border-2 border-primary-500/20 rounded-[1.8rem] flex items-center justify-center shadow-lg">
                                   <Target size={32} className="text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                   <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-2">{t('projectsPage.objectivesMatrix')}</h3>
                                   <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.objectivesMatrixSubtitle')}</p>
                                </div>
                             </div>

                             <div className="flex items-center p-2 bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[1.8rem] shadow-inner backdrop-blur-xl">
                                <button type="button" onClick={() => setViewMode('list')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] italic transition-all duration-500 ${viewMode === 'list' ? 'bg-surface-900 dark:bg-white text-white dark:text-black shadow-xl scale-110' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}>{t('projectsPage.viewMatrix')}</button>
                                <button type="button" onClick={() => setViewMode('gantt')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] italic transition-all duration-500 flex items-center gap-3 ${viewMode === 'gantt' ? 'bg-surface-900 dark:bg-white text-white dark:text-black shadow-xl scale-110' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}>{t('projectsPage.viewChronology')}</button>
                                <div className="w-[2px] h-6 bg-surface-100 dark:bg-surface-800 mx-3 rounded-full" />
                                <button type="button" onClick={() => setShowAddMilestone(true)} className="px-6 py-3 text-primary-500 hover:text-primary-600 text-[10px] font-black uppercase tracking-[0.3em] italic hover:scale-110 transition-all flex items-center gap-3 border-none bg-transparent active:scale-90"><Plus size={20} /> {t('projectsPage.append')}</button>
                             </div>
                          </header>

                          <div className="space-y-6 min-h-[450px]">
                             {!dashboard.milestones?.length ? (
                                <div className="py-32 text-center opacity-10">
                                   <Cpu size={80} className="mx-auto mb-8" />
                                   <p className="text-xl font-black uppercase tracking-[0.8em] italic">{t('projectsPage.nullObjectiveSet')}</p>
                                </div>
                             ) : viewMode === 'gantt' ? (
                                <div className="space-y-8 overflow-x-auto pb-8 custom-scrollbar pt-4">
                                   {dashboard.milestones.map((m) => {
                                     const totalDays = Math.max(1, dashboard.criticalPathTotalDays || 1)
                                     const startPct = ((m.criticalPathInfo?.earliestStart || 0) / totalDays) * 100
                                     const widthPct = Math.max(15, (((m.criticalPathInfo?.earliestFinish || 0) - (m.criticalPathInfo?.earliestStart || 0)) / totalDays) * 100)
                                     return (
                                       <div key={m._id} className="flex items-center gap-10 min-w-[900px] group/row">
                                         <div className="w-80 truncate flex items-center gap-4">
                                           <div className={`w-3 h-3 rounded-full shadow-lg ${m.completedAt ? 'bg-emerald-500' : m.criticalPathInfo?.isOnCriticalPath ? 'bg-primary-500' : 'bg-surface-200 dark:bg-slate-800'}`} />
                                           <span className={`text-base font-black italic uppercase tracking-tight ${m.completedAt ? 'text-surface-300 dark:text-slate-800 line-through' : 'text-surface-900 dark:text-white group-hover/row:text-primary-500 transition-colors'}`}>{m.title}</span>
                                         </div>
                                         <div className="flex-1 h-8 bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl relative overflow-hidden shadow-inner">
                                           <motion.div 
                                             initial={{ scaleX: 0 }} 
                                             animate={{ scaleX: 1 }}
                                             transition={{ duration: 1.5, type: 'spring' }}
                                             className={`absolute h-3 top-2.5 rounded-full ${m.criticalPathInfo?.isOnCriticalPath ? 'bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-surface-300 dark:bg-slate-800'} ${m.completedAt ? 'opacity-20' : ''}`}
                                             style={{ left: `${startPct}%`, width: `${Math.min(widthPct, 100 - startPct)}%`, originX: 0 }}
                                           />
                                         </div>
                                         <div className="w-24 text-right text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-widest italic">{t('projectsPage.dayGap', { days: m.estimatedDays || 0 })}</div>
                                       </div>
                                     )
                                   })}
                                </div>
                             ) : (
                                <div className="space-y-4">
                                   {dashboard.milestones.map((m) => (
                                     <motion.div
                                       layout
                                       key={m._id}
                                       className={`flex items-center gap-8 p-6 rounded-[2.5rem] border-2 transition-all duration-500 group shadow-xl ${
                                         m.criticalPathInfo?.isOnCriticalPath
                                           ? 'border-primary-500/30 bg-primary-500/[0.03] dark:bg-primary-500/[0.01]'
                                           : 'border-surface-100 bg-surface-page/50 dark:border-surface-800 dark:bg-surface-950/30'
                                       } ${m.completedAt ? 'opacity-40 grayscale scale-[0.98]' : 'hover:scale-[1.01] hover:border-primary-500/20'}`}
                                     >
                                        <button type="button" onClick={() => !m.completedAt && completeMilestone(dashboard._id, m._id)} className="shrink-0 active:scale-90 transition-transform outline-none border-none bg-transparent">
                                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${m.completedAt ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-surface-card dark:bg-surface-900 border-surface-200 dark:border-surface-800 text-surface-300 hover:text-primary-500 hover:border-primary-500 shadow-md group-hover:rotate-12'}`}>
                                              {m.completedAt ? <CheckCircle2 size={32} /> : <Circle size={32} />}
                                           </div>
                                        </button>

                                        <div className="flex-1 min-w-0">
                                           <div className="flex items-center gap-6 mb-3">
                                              <h4 className={`text-xl font-black italic uppercase tracking-tighter truncate ${m.completedAt ? 'text-surface-400 line-through' : 'text-surface-900 dark:text-white group-hover:text-primary-500 transition-colors duration-500'}`}>{m.title}</h4>
                                              {m.criticalPathInfo?.isOnCriticalPath && !m.completedAt && (
                                                <div className="px-3 py-1 bg-primary-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg italic animate-pulse">{t('projectsPage.criticalPath')}</div>
                                              )}
                                           </div>
                                           <div className="flex items-center gap-8">
                                              <div className="flex items-center gap-2.5 text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-widest italic"><Clock size={16} className="text-primary-500" /> {t('projectsPage.daysToTarget', { days: m.estimatedDays || 0 })}</div>
                                              {m.linkedTaskId && (
                                                <button type="button" onClick={() => router.push(`/dashboard/tasks?open=${m.linkedTaskId}`)} className="text-[10px] font-black text-primary-500 hover:text-primary-600 uppercase tracking-widest flex items-center gap-2 transition-all border-none bg-transparent italic hover:scale-110"><Link2 size={16} /> {t('projectsPage.viewTaskNode')}</button>
                                              )}
                                           </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                           <button type="button" 
                                             onClick={() => { setEditTitle(m.title); setEditDueDate(m.dueDate ? new Date(m.dueDate).toISOString().slice(0,10) : ''); setEditEstimatedDays(m.estimatedDays || 1); setEditingMilestone(m); }} 
                                             title={t('projectsPage.editObjective', { title: m.title })} aria-label={t('projectsPage.editObjective', { title: m.title })}
                                             className="w-12 h-12 bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 rounded-xl flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500 transition-all shadow-lg active:scale-90"
                                           >
                                              <Pencil size={20} />
                                           </button>
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
           </main>
        </div>

        {/* Create Project Modal */}
        <AnimatePresence>
           {showCreate && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 bg-surface-950/85 backdrop-blur-3xl" onClick={() => setShowCreate(false)}>
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} transition={{ duration: 0.5, type: 'spring' }}
                   className="bg-surface-card w-full max-w-3xl rounded-[3.5rem] p-10 sm:p-16 border-2 border-primary-500/20 shadow-[0_100px_300px_rgba(0,0,0,0.8)] relative overflow-hidden"
                   onClick={e => e.stopPropagation()}
                 >
                    <header className="flex justify-between items-center mb-16 border-b border-surface-100 dark:border-surface-800 pb-10">
                       <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-primary-500/10 border-2 border-primary-500/20 rounded-[2rem] flex items-center justify-center shadow-xl transition-transform duration-500 hover:rotate-12">
                             <Plus size={40} className="text-primary-600" />
                          </div>
                          <div>
                             <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-2">{t('projectsPage.initializeMission')}</h2>
                             <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.5em] italic leading-none">{t('projectsPage.createModalSubtitle')}</p>
                          </div>
                       </div>
                       <button type="button" onClick={() => setShowCreate(false)} title={t('projectsPage.closeModal')} aria-label={t('projectsPage.closeModal')} className="w-14 h-14 bg-surface-page dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl flex items-center justify-center text-surface-400 hover:text-rose-500 hover:border-rose-500/40 transition-all shadow-inner active:scale-90"><X size={28} /></button>
                    </header>
                    
                    <div className="space-y-12">
                       <div className="space-y-4">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.missionIdentifier')}</label>
                          <input
                            type="text"
                            placeholder={t('projectsPage.missionIdentifierPlaceholder')}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-3xl px-8 py-6 text-2xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                          />
                       </div>
                       <div className="space-y-4">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.operationalBrief')}</label>
                          <textarea
                            placeholder={t('projectsPage.operationalBriefPlaceholder')}
                            rows={4}
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] px-8 py-6 text-base font-extrabold text-surface-600 dark:text-slate-300 focus:border-primary-500 outline-none transition-all shadow-inner resize-none italic uppercase tracking-tight backdrop-blur-xl"
                          />
                       </div>

                       <footer className="flex flex-col sm:flex-row gap-6 pt-10 border-t-2 border-surface-100 dark:border-surface-800">
                          <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-6 rounded-[2rem] bg-surface-page dark:bg-surface-950 text-surface-400 dark:text-slate-600 font-black uppercase text-[11px] tracking-[0.6em] italic border-none active:scale-95 transition-all">{t('projectsPage.abortMission')}</button>
                          <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()} className="flex-1 py-6 rounded-[2rem] bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.8em] italic shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:-translate-y-2 transition-all duration-300 border-none active:scale-95 flex items-center justify-center gap-6">
                             {creating ? <RefreshCw className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                             {creating ? t('projectsPage.synchronizing') : t('projectsPage.commitMission')}
                          </button>
                       </footer>
                    </div>
                 </motion.div>
              </div>
           )}

           {/* Add Objective Modal */}
           {showAddMilestone && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-surface-950/85 backdrop-blur-3xl" onClick={() => setShowAddMilestone(false)}>
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }}
                   className="bg-surface-card w-full max-w-xl rounded-[3rem] p-12 border-2 border-primary-500/20 shadow-[0_100px_300px_rgba(0,0,0,0.8)] relative overflow-hidden"
                   onClick={e => e.stopPropagation()}
                 >
                    <header className="flex justify-between items-center mb-12 border-b border-surface-100 dark:border-surface-800 pb-8">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-primary-500/10 border-2 border-primary-500/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
                             <Target size={32} className="text-primary-600" />
                          </div>
                          <div>
                             <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-1">{t('projectsPage.appendObjective')}</h2>
                             <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.appendObjectiveSubtitle')}</p>
                          </div>
                       </div>
                       <button type="button" onClick={() => setShowAddMilestone(false)} title={t('projectsPage.closeModal')} aria-label={t('projectsPage.closeModal')} className="w-12 h-12 bg-surface-page dark:bg-surface-950 border border-surface-100 dark:border-surface-800 rounded-xl flex items-center justify-center text-surface-400 hover:text-rose-500 transition-all shadow-inner active:scale-90"><X size={24} /></button>
                    </header>

                    <div className="space-y-10">
                       <div className="space-y-4">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.objectiveIdentifier')}</label>
                          <input
                             type="text"
                             title={t('projectsPage.nodeIdentifier')}
                             aria-label={t('projectsPage.nodeIdentifier')}
                             value={editTitle}
                             onChange={(e) => setEditTitle(e.target.value)}
                             className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                           />
                       </div>

                       <div className="space-y-4">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.temporalGap')}</label>
                          <input
                             type="number"
                             min={1}
                             title={t('projectsPage.estimatedDays')}
                             aria-label={t('projectsPage.estimatedDays')}
                             value={newMilestoneDays}
                             onChange={(e) => setNewMilestoneDays(Number(e.target.value) || 1)}
                             className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-lg font-black text-surface-900 dark:text-white italic focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                           />
                       </div>

                       <footer className="flex gap-6 pt-8 border-t border-surface-100 dark:border-surface-800">
                          <button type="button" onClick={() => setShowAddMilestone(false)} className="flex-1 py-5 rounded-2xl bg-surface-page dark:bg-surface-950 text-surface-400 dark:text-slate-600 font-black uppercase text-[10px] tracking-[0.6em] italic border-none active:scale-95 transition-all">{t('projectsPage.abort')}</button>
                          <button type="button" onClick={addMilestone} disabled={addingMilestone || !newMilestoneTitle.trim()} className="flex-1 py-5 rounded-2xl bg-primary-600 text-white font-black uppercase text-[10px] tracking-[0.8em] italic shadow-[0_15px_40px_rgba(99,102,241,0.4)] hover:bg-primary-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 border-none">
                             {addingMilestone ? <RefreshCw className="animate-spin" size={20} /> : <Target size={20} />}
                             {addingMilestone ? t('projectsPage.injecting') : t('projectsPage.commitTarget')}
                          </button>
                       </footer>
                    </div>
                 </motion.div>
              </div>
           )}

           {/* Edit Objective Modal */}
           {editingMilestone && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-surface-950/85 backdrop-blur-3xl" onClick={() => setEditingMilestone(null)}>
                 <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }}
                   className="bg-surface-card w-full max-w-xl rounded-[3rem] p-12 border-2 border-primary-500/20 shadow-[0_100px_300px_rgba(0,0,0,0.8)] relative overflow-hidden"
                   onClick={e => e.stopPropagation()}
                 >
                    <header className="flex justify-between items-center mb-12 border-b border-surface-100 dark:border-surface-800 pb-8">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-primary-500/10 border-2 border-primary-500/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
                             <Pencil size={32} className="text-primary-600" />
                          </div>
                          <div>
                             <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-1">{t('projectsPage.calibrateTarget')}</h2>
                             <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('projectsPage.calibrateTargetSubtitle')}</p>
                          </div>
                       </div>
                       <button type="button" onClick={() => setEditingMilestone(null)} title={t('projectsPage.closeModal')} aria-label={t('projectsPage.closeModal')} className="w-12 h-12 bg-surface-page dark:bg-surface-950 border border-surface-100 dark:border-surface-800 rounded-xl flex items-center justify-center text-surface-400 hover:text-rose-500 transition-all shadow-inner active:scale-90"><X size={24} /></button>
                    </header>

                    <div className="space-y-10">
                       <div className="space-y-4">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.nodeIdentifier')}</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            aria-label={t('projectsPage.projectTitle')}
                            title={t('projectsPage.projectTitle')}
                            placeholder={t('projectsPage.projectTitle')}
                            className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                             <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.targetDate')}</label>
                             <input
                               type="date"
                               title={t('projectsPage.targetDate')}
                               aria-label={t('projectsPage.targetDate')}
                               value={editDueDate}
                               onChange={(e) => setEditDueDate(e.target.value)}
                               className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-[10px] font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none transition-all shadow-inner [color-scheme:dark]"
                             />
                          </div>
                          <div className="space-y-4">
                             <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">{t('projectsPage.gapDays')}</label>
                             <input
                               type="number"
                               value={editEstimatedDays}
                               onChange={(e) => setEditEstimatedDays(Number(e.target.value) || 1)}
                               aria-label={t('projectsPage.estimatedDaysLower')}
                               title={t('projectsPage.estimatedDaysLower')}
                               placeholder={t('projectsPage.daysPlaceholder')}
                               className="w-full bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-lg font-black text-surface-900 dark:text-white italic focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                             />
                          </div>
                       </div>

                       <footer className="flex gap-6 pt-8 border-t border-surface-100 dark:border-surface-800">
                          <button type="button" onClick={() => setEditingMilestone(null)} className="flex-1 py-5 rounded-2xl bg-surface-page dark:bg-surface-950 text-surface-400 dark:text-slate-600 font-black uppercase text-[10px] tracking-[0.6em] italic border-none active:scale-95 transition-all">{t('projectsPage.abort')}</button>
                          <button type="button" onClick={saveMilestone} className="flex-1 py-5 rounded-2xl bg-primary-600 text-white font-black uppercase text-[10px] tracking-[0.8em] italic shadow-[0_15px_40px_rgba(99,102,241,0.4)] hover:bg-primary-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 border-none">
                             <CheckCircle2 size={20} /> {t('projectsPage.commitChanges')}
                          </button>
                       </footer>
                    </div>
                 </motion.div>
              </div>
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
