'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Trash2, Pencil, CopyPlus, Plus, X, ChevronRight,
  Sparkles, Users, Tag, Shield, Zap, Cpu, Activity,
  Radio, Target, RefreshCw, Fingerprint, Compass, Boxes,
  Layout, Layers, Timer, Box, Monitor, ArrowLeft, Search,
  Settings2, Workflow as WorkflowIcon, CheckCircle2, ChevronDown, Check
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

interface Workflow {
  _id: string
  name: string
  description: string
  teamId?: string | null
  steps: Array<{ order: number; action: string; config: any }>
  frequency: number
  lastUsed: string | null
  isTemplate: boolean
  tags: string[]
}

interface Team {
  _id: string
  name: string
}

const ACTIONS = [
  { value: 'upload_video', label: 'Video Upload & Calibration' },
  { value: 'generate_content', label: 'AI Content Generation' },
  { value: 'generate_script', label: 'AI Script Composition' },
  { value: 'create_quote', label: 'Social Quote Extraction' },
  { value: 'schedule_post', label: 'Smart Scheduling' },
  { value: 'apply_effects', label: 'Visual Effects Layer' },
  { value: 'add_music', label: 'Background Audio' },
  { value: 'export', label: 'Production Export' },
]

const ACTION_ROUTES: Record<string, string> = {
  upload_video: '/dashboard/video',
  generate_content: '/dashboard/content',
  generate_script: '/dashboard/scripts',
  create_quote: '/dashboard/quotes',
  schedule_post: '/dashboard/scheduler',
}

export default function WorkflowsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [executionStep, setExecutionStep] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    teamId: '',
    steps: [] as Array<{ action: string; config: any }>,
    isTemplate: false,
    tags: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [wfRes, sugRes, teamsRes] = await Promise.all([
        apiGet('/workflows'),
        apiGet('/workflows/suggestions'),
        apiGet('/teams').catch(() => ({ data: [] })),
      ])
      const wf = extractApiData<Workflow[]>(wfRes as any) ?? (wfRes as any)?.data
      const sug = extractApiData<any[]>(sugRes as any) ?? (sugRes as any)?.data
      const t = extractApiData<Team[]>(teamsRes as any) ?? (teamsRes as any)?.data
      setWorkflows(Array.isArray(wf) ? wf : [])
      setSuggestions(Array.isArray(sug) ? sug : [])
      setTeams(Array.isArray(t) ? t : [])
    } catch {
      showToast('Could not load: WORKFLOW_unavailable', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, loadData])

  const handleExecute = async (workflowId: string) => {
    const workflow = workflows.find(w => w._id === workflowId)
    setExecutingId(workflowId)
    setExecutionStep(0)
    
    try {
      if (workflow) {
        for (let i = 0; i < workflow.steps.length; i++) {
          setExecutionStep(i + 1)
          await new Promise(r => setTimeout(r, 800))
        }
      }

      const res = await apiPost<{ data?: { workflow?: Workflow } }>(`/workflows/${workflowId}/execute`, { data: {} })
      const updatedWorkflow = (res as any)?.data?.workflow
      showToast('✓ SEQUENCE_DEPLOYED: EXECUTION_STABLE', 'success')
      
      if (updatedWorkflow?.steps?.length) {
        const route = ACTION_ROUTES[updatedWorkflow.steps[0].action]
        if (route) {
          await new Promise(r => setTimeout(r, 500))
          router.push(route)
        }
      }
      loadData()
    } catch {
      showToast('SEQUENCE_ABORTED: EXECUTION_FAILURE', 'error')
    } finally {
      setExecutingId(null)
      setExecutionStep(0)
    }
  }

  const handleSave = async () => {
    const validSteps = form.steps.filter(s => s.action)
    if (!form.name.trim() || validSteps.length === 0) {
      showToast('PARAM_ERR: NAME_&_STEPS_REQUIRED', 'error')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      teamId: form.teamId || undefined,
      steps: validSteps.map(s => ({ action: s.action, config: s.config })),
      isTemplate: form.isTemplate,
      tags: form.tags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean),
    }

    try {
      if (editingWorkflow) await apiPut(`/workflows/${editingWorkflow._id}`, payload)
      else await apiPost('/workflows', payload)
      showToast('✓ LEDGER_UPDATED: WORKFLOW_SAVED', 'success')
      setEditingWorkflow(null); setShowCreateModal(false); loadData()
    } catch {
      showToast('WRITE_ERR: FAILED_TO_SAVE', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to purge this sequence DNA?')) return
    try {
      await apiDelete(`/workflows/${id}`)
      showToast('✓ SEQUENCE_PURGED', 'success')
      loadData()
    } catch {
      showToast('DELETE_ERR: FAILED_TO_REMOVE', 'error')
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
        <WorkflowIcon size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">Syncing Automation Hub...</p>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-10 lg:px-12 pt-10 max-w-[1900px] mx-auto space-y-16 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        <ToastContainer />

        {/* Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-12 border-b border-surface-100 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-8 w-full lg:w-auto">
              <button type="button" onClick={() => router.push('/dashboard')} 
                title="Back to Dashboard" aria-label="Back to Dashboard"
                className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90 group">
                <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Layers size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] border-2 border-primary-500/20 italic leading-none">
                      Automation Hub
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {workflows.length} ACTIVE_SEQUENCES
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">Workflows</h1>
              </div>
           </div>

           <button type="button" onClick={() => { setEditingWorkflow(null); setForm({ name: '', description: '', teamId: '', steps: [{ action: '', config: {} }], isTemplate: false, tags: '' }); setShowCreateModal(true) }}
             className="px-12 py-6 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2rem] text-[12px] font-black uppercase tracking-[0.6em] italic shadow-[0_30px_80px_rgba(0,0,0,0.4)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all flex items-center gap-6 active:scale-95 border-none"
           >
             <Plus size={24} /> Initialize Sequence
           </button>
        </header>

        {/* Suggestions HUD */}
        <AnimatePresence>
           {suggestions.length > 0 && (
             <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-primary-500/10 rounded-[4rem] p-12 sm:p-20 shadow-2xl relative overflow-hidden group transition-all duration-700 hover:shadow-[0_100px_200px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 p-24 opacity-[0.01] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
                   <Sparkles size={600} className="text-primary-500" />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-10 mb-20 relative z-10">
                   <div className="w-20 h-20 bg-primary-500/10 rounded-[2rem] flex items-center justify-center border-2 border-primary-500/20 shadow-2xl group-hover:rotate-12 transition-transform duration-700">
                      <Cpu size={40} className="text-primary-500" />
                   </div>
                   <div className="text-center sm:text-left">
                      <h2 className="text-4xl sm:text-5xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-4">Neural Recommendations</h2>
                      <p className="text-[12px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.6em] italic leading-none">AI-DRIVEN_AUTOMATION_LATTICE</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                   {suggestions.map((s, i) => (
                      <div key={i} className="p-12 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 hover:bg-surface-card transition-all duration-700 group/card shadow-inner relative overflow-hidden">
                         <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center mb-10 shadow-xl group-hover/card:rotate-12 transition-transform duration-700">
                            <Zap size={32} className="text-primary-500" />
                         </div>
                         <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter mb-6 group-hover/card:text-primary-500 transition-colors duration-500 italic uppercase leading-none">{s.title}</h3>
                         <p className="text-[13px] font-bold text-surface-400 dark:text-slate-500 mb-12 leading-relaxed italic uppercase tracking-tight line-clamp-3">{s.description}</p>
                         {s.workflowId && (
                           <button type="button" onClick={() => handleExecute(s.workflowId)} disabled={!!executingId} 
                             className="flex items-center gap-6 text-[12px] font-black text-primary-500 dark:text-primary-400 uppercase tracking-[0.6em] hover:text-primary-700 dark:hover:text-primary-300 transition-all border-none bg-transparent italic group-hover/card:translate-x-4"
                           >
                                INITIALIZE_STRAND <ChevronRight size={20} />
                           </button>
                         )}
                      </div>
                   ))}
                </div>
             </motion.section>
           )}
        </AnimatePresence>

        {/* Workflow Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
           {workflows.map((w, idx) => (
             <motion.div layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={w._id}
               className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] p-10 sm:p-14 flex flex-col hover:border-primary-500/30 transition-all duration-700 group shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-16 opacity-[0.01] pointer-events-none group-hover/item:opacity-[0.05] transition-opacity duration-1000"><WorkflowIcon size={300} /></div>
                
                <div className="flex justify-between items-start mb-14 relative z-10">
                   <div className="space-y-4 flex-1 pr-10">
                      <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter group-hover:text-primary-500 transition-colors duration-500 italic uppercase leading-none">{w.name}</h3>
                      <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 leading-relaxed italic uppercase tracking-tight line-clamp-2">{w.description || "NO_MISSION_DESCRIPTION_FOUND"}</p>
                   </div>
                   {w.isTemplate && <span className="px-5 py-2 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-black uppercase tracking-[0.4em] border-2 border-primary-500/20 italic leading-none shadow-xl">TEMPLATE_DNA</span>}
                </div>

                <div className="space-y-4 mb-14 relative z-10">
                   <div className="flex items-center gap-6 mb-8">
                      <div className="h-1 bg-surface-page dark:bg-surface-800 flex-1 rounded-full shadow-inner" />
                      <span className="text-[10px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-[0.8em] italic leading-none">PROTOCOL_CHAIN</span>
                      <div className="h-1 bg-surface-page dark:bg-surface-800 flex-1 rounded-full shadow-inner" />
                   </div>
                   <div className="space-y-4">
                      {w.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-8 p-6 rounded-[2.5rem] bg-surface-page/50 dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 group/step transition-all duration-500 hover:border-primary-500/20 shadow-inner backdrop-blur-3xl">
                           <div className="w-12 h-12 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 text-surface-400 dark:text-slate-700 flex items-center justify-center text-[11px] font-black shadow-xl italic group-hover/step:text-primary-500 group-hover/step:border-primary-500/40 transition-all duration-500">{step.order}</div>
                           <span className="text-[14px] font-black text-surface-900 dark:text-white uppercase tracking-tighter flex-1 truncate italic group-hover/step:text-primary-500 transition-colors duration-500">{step.action.replace(/_/g, ' ')}</span>
                           {i < w.steps.length - 1 && <ChevronDown size={18} className="text-surface-200 dark:text-slate-900" />}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-14 relative z-10">
                   {w.tags?.map(t => <span key={t} className="px-5 py-2.5 rounded-2xl bg-surface-page dark:bg-surface-900/50 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-[0.4em] italic shadow-inner">#{t.toUpperCase()}</span>)}
                </div>

                <div className="mt-auto pt-12 border-t-2 border-surface-100 dark:border-surface-800 flex items-center justify-between mb-12 relative z-10">
                   <div className="flex items-center gap-14">
                      <div className="group/stat">
                         <p className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic mb-4 leading-none group-hover/stat:text-primary-500 transition-colors duration-500">YIELD_CYCLES</p>
                         <p className="text-4xl font-black text-surface-900 dark:text-white tabular-nums leading-none italic group-hover/stat:scale-110 transition-transform duration-700">{w.frequency}</p>
                      </div>
                      {w.lastUsed && (
                        <div className="group/stat">
                           <p className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic mb-4 leading-none group-hover/stat:text-primary-500 transition-colors duration-500">LAST_UPLINK</p>
                           <p className="text-4xl font-black text-surface-900 dark:text-white leading-none italic uppercase tracking-tighter group-hover/stat:scale-110 transition-transform duration-700">{new Date(w.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="flex gap-6 relative z-10">
                   <button type="button" onClick={() => handleExecute(w._id)} disabled={!!executingId} 
                     className="flex-1 py-7 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] text-[14px] font-black uppercase tracking-[1em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white disabled:opacity-10 transition-all duration-700 flex items-center justify-center gap-6 shadow-[0_40px_100px_rgba(0,0,0,0.5)] group/btn border-none active:scale-95 hover:-translate-y-2"
                   >
                      {executingId === w._id ? <RefreshCw className="animate-spin" size={28} /> : <Play size={28} className="group-hover/btn:scale-125 group-hover/btn:rotate-12 transition-all duration-700" />} INITIALIZE
                   </button>
                   <div className="flex flex-col gap-4">
                      <button type="button" onClick={() => { setEditingWorkflow(w); setForm({ name: w.name, description: w.description || '', teamId: (w as any).teamId || '', steps: w.steps.map(s => ({ action: s.action, config: s.config || {} })), isTemplate: w.isTemplate, tags: w.tags.join(', ') }); setShowCreateModal(true) }} 
                        title="Edit Sequence" aria-label="Edit Sequence"
                        className="w-16 h-16 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500/30 transition-all shadow-xl active:scale-95 group/edit border-none"
                      >
                        <Pencil size={28} className="group-hover/edit:rotate-12 transition-transform duration-700" />
                      </button>
                      <button type="button" onClick={() => handleDelete(w._id)} 
                        title="Purge Sequence" aria-label="Purge Sequence"
                        className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-xl active:scale-95 group/del border-none"
                      >
                        <Trash2 size={28} className="group-hover/del:scale-110 transition-transform duration-700" />
                      </button>
                   </div>
                </div>
             </motion.div>
           ))}
        </section>

        {/* Execution Overlay */}
        <AnimatePresence>
          {executingId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-surface-950/98 backdrop-blur-[120px] flex items-center justify-center p-8">
              <div className="max-w-3xl w-full space-y-20 text-center">
                 <div className="w-56 h-56 rounded-[5rem] bg-primary-600/10 border-2 border-primary-500/20 flex items-center justify-center mx-auto shadow-[0_0_200px_rgba(99,102,241,0.5)] relative group">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute inset-[-15px] rounded-[6rem] border-4 border-dashed border-primary-500/30" />
                    <Zap size={80} className="text-primary-500 animate-pulse relative z-10" />
                 </div>
                 <div className="space-y-8">
                   <h2 className="text-6xl sm:text-8xl font-black text-white tracking-tighter italic uppercase leading-none">Protocol Active</h2>
                   <p className="text-[16px] font-black text-primary-400 uppercase tracking-[1.5em] animate-pulse italic leading-none ml-4">SEQUENTIAL_ENGINE_SYNC</p>
                 </div>
                 <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar px-6">
                   {workflows.find(w => w._id === executingId)?.steps.map((step, i) => (
                     <motion.div key={i} animate={{ opacity: executionStep > i ? 1 : 0.05, scale: executionStep === i + 1 ? 1.05 : 1, x: executionStep === i + 1 ? 30 : 0 }}
                       className={`flex items-center gap-10 p-10 rounded-[3.5rem] border-2 transition-all duration-1000 ${executionStep === i + 1 ? 'bg-primary-600/20 border-primary-500/60 shadow-[0_40px_100px_rgba(0,0,0,0.6)]' : 'bg-white/[0.02] border-white/5 shadow-inner'}`}
                     >
                       <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black italic shadow-2xl transition-all duration-700 ${executionStep > i + 1 ? 'bg-emerald-500 text-white' : executionStep === i + 1 ? 'bg-primary-600 text-white animate-bounce' : 'bg-surface-800 text-slate-800'}`}>
                         {executionStep > i + 1 ? <Check size={36} strokeWidth={4} /> : step.order}
                       </div>
                       <span className={`text-3xl font-black uppercase tracking-tighter flex-1 text-left italic transition-colors duration-700 ${executionStep > i ? 'text-white' : 'text-slate-900'}`}>{step.action.replace(/_/g, ' ')}</span>
                       {executionStep === i + 1 && <RefreshCw size={36} className="text-primary-400 animate-spin" />}
                     </motion.div>
                   ))}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Modal */}
        <AnimatePresence>
           {showCreateModal && (
             <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-16 bg-surface-950/95 backdrop-blur-[80px]" onClick={() => setShowCreateModal(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 150 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 150 }} transition={{ duration: 0.8, type: 'spring', damping: 25 }}
                  className="bg-surface-card rounded-[5rem] p-12 sm:p-24 max-w-7xl w-full border-2 border-white/5 shadow-[0_150px_400px_rgba(0,0,0,1)] max-h-[94vh] overflow-y-auto custom-scrollbar relative group/modal" 
                  onClick={e => e.stopPropagation()}
                >
                   <header className="flex flex-col md:flex-row justify-between items-center mb-24 border-b-2 border-surface-100 dark:border-surface-800 pb-16 gap-12">
                      <div className="flex items-center gap-12 text-center md:text-left">
                         <div className="w-28 h-28 rounded-[3rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-2xl group-hover/modal:rotate-12 transition-transform duration-700">
                            <WorkflowIcon size={64} className="text-primary-500" />
                         </div>
                         <div>
                            <h2 className="text-5xl sm:text-6xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-4">{editingWorkflow ? 'Update Protocol' : 'Sequence Origin'}</h2>
                            <p className="text-[14px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[1em] italic leading-none">MODULAR_PROTOCOL_ENGINE_V12.0</p>
                         </div>
                      </div>
                      <button type="button" onClick={() => setShowCreateModal(false)} title="Close Modal" aria-label="Close Modal" className="w-20 h-20 rounded-[2.2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 hover:text-rose-500 hover:border-rose-500/40 transition-all shadow-inner active:scale-90 border-none"><X size={40} /></button>
                   </header>

                   <div className="space-y-20">
                      <div className="space-y-8">
                         <label className="text-[14px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic pl-8 leading-none">PROTOCOL_IDENTIFIER</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                          className="w-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[3.5rem] px-16 py-10 text-4xl sm:text-5xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-3xl" 
                          placeholder="MISSION_OBJECTIVE_ALPHA..." 
                        />
                      </div>
                      
                      <div className="space-y-8">
                         <label className="text-[14px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic pl-8 leading-none">MISSION_INTELLIGENCE</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} 
                          className="w-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[4rem] px-16 py-12 text-2xl font-bold text-surface-600 dark:text-slate-400 focus:border-primary-500 outline-none transition-all shadow-inner resize-none italic uppercase tracking-tight backdrop-blur-3xl custom-scrollbar" 
                          placeholder="CORE_OBJECTIVES_MAPPING_DATA..." 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                         <div className="space-y-8">
                            <label className="text-[14px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic pl-8 leading-none">NODE_ANCHOR (TEAM)</label>
                            <div className="relative group/sel">
                              <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                                aria-label="Team anchor"
                                title="Team anchor"
                                className="w-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[3rem] px-16 py-10 text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-[0.4em] focus:border-primary-500 outline-none appearance-none cursor-pointer shadow-inner backdrop-blur-3xl group-hover/sel:bg-surface-card transition-all duration-500"
                              >
                                <option value="" className="bg-surface-card">PERSONAL_CORTEX</option>
                                {teams.map(t => <option key={t._id} value={t._id} className="bg-surface-card">{t.name.toUpperCase()}</option>)}
                              </select>
                              <ChevronDown size={36} className="absolute right-12 top-1/2 -translate-y-1/2 text-surface-200 dark:text-slate-900 group-hover/sel:text-primary-500 rotate-90 pointer-events-none transition-all duration-700" />
                            </div>
                         </div>
                         <div className="space-y-8">
                            <label className="text-[14px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic pl-8 leading-none">CLASSIFICATION_VECTORS</label>
                            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} 
                              className="w-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[3rem] px-16 py-10 text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-[0.4em] focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-3xl" 
                              placeholder="VIRAL_MATRIX, AI_SYNTHESIS..." 
                            />
                         </div>
                      </div>

                       <div className="space-y-12 pt-24 border-t-2 border-surface-100 dark:border-surface-800">
                          <div className="flex items-center justify-center gap-10">
                             <div className="h-1 bg-surface-page dark:bg-surface-800 flex-1 rounded-full shadow-inner" />
                             <label className="text-[14px] font-black text-surface-400 dark:text-slate-800 uppercase tracking-[1.5em] italic leading-none mx-8">SEQUENCE_ARCHITECTURE</label>
                             <div className="h-1 bg-surface-page dark:bg-surface-800 flex-1 rounded-full shadow-inner" />
                          </div>
                          <div className="space-y-10">
                             {form.steps.map((step, i) => (
                                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex items-center gap-12 p-10 bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/5 rounded-[4rem] group/step transition-all duration-700 hover:border-primary-500/50 shadow-inner backdrop-blur-3xl">
                                   <div className="w-20 h-20 rounded-[2rem] bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 flex items-center justify-center font-black text-4xl shadow-2xl italic leading-none">{i + 1}</div>
                                    <div className="flex-1 relative group/act">
                                       <select value={step.action}
                                          onChange={e => { const up = [...form.steps]; up[i].action = e.target.value; setForm(f => ({ ...f, steps: up })) }}
                                          aria-label={`Step ${i + 1} action`}
                                          title={`Step ${i + 1} action`}
                                          className="w-full bg-transparent text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter focus:outline-none appearance-none cursor-pointer group-hover/step:text-primary-500 transition-colors duration-700 italic"
                                       >
                                          <option value="" className="bg-surface-card">SELECT_MODULE_ACTION...</option>
                                          {ACTIONS.map(a => <option key={a.value} value={a.value} className="bg-surface-card">{a.label.toUpperCase()}</option>)}
                                       </select>
                                       <ChevronDown size={36} className="absolute right-0 top-1/2 -translate-y-1/2 text-surface-100 dark:text-slate-900 group-hover/act:text-primary-500 rotate-90 pointer-events-none transition-all duration-700" />
                                    </div>
                                   <button type="button" onClick={() => { const up = form.steps.filter((_, j) => j !== i); setForm(f => ({ ...f, steps: up.length ? up : [{ action: '', config: {} }] })) }} 
                                     title="Remove Step" aria-label="Remove Step"
                                     className="w-16 h-16 rounded-2xl border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-2xl flex items-center justify-center active:scale-90 border-none"
                                   >
                                     <X size={36} />
                                   </button>
                                </motion.div>
                             ))}
                              <button type="button" onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { action: '', config: {} }] }))} 
                                className="w-full py-14 border-4 border-dashed border-surface-100 dark:border-white/5 rounded-[5rem] text-[16px] font-black text-surface-200 dark:text-slate-900 uppercase tracking-[1.5em] hover:border-primary-500/40 hover:text-primary-500 transition-all duration-700 bg-surface-page/30 dark:bg-white/[0.01] italic shadow-inner active:scale-[0.99] group/add"
                              >
                                <span className="group-hover/add:scale-110 inline-block transition-transform duration-700">+ INJECT_MODULAR_STRATUM</span>
                              </button>
                          </div>
                       </div>

                       <footer className="flex flex-col sm:flex-row items-center justify-between gap-16 pt-24 border-t-2 border-surface-100 dark:border-surface-800">
                          <button type="button" onClick={() => setShowCreateModal(false)} className="text-[14px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-[1.2em] italic transition-all hover:scale-110 active:scale-90 border-none bg-transparent ml-8">ABORT_MISSION</button>
                          <button type="button" onClick={handleSave} className="px-32 py-10 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[5rem] text-[18px] font-black uppercase tracking-[1.5em] italic shadow-[0_50px_120px_rgba(0,0,0,0.8)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:-translate-y-6 transition-all duration-700 border-none active:scale-95">COMMIT_PROTOCOL_DNA</button>
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
