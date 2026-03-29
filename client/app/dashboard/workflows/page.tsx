'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Trash2,
  Pencil,
  CopyPlus,
  Plus,
  X,
  ChevronRight,
  Sparkles,
  Users,
  Tag,
  Shield,
  Zap,
  Cpu,
  Activity,
  Radio,
  Target,
  RefreshCw,
  Fingerprint,
  Compass,
  Boxes,
  Layout,
  Layers,
  Timer,
  Box,
  Monitor
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

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
  { value: 'upload_video', label: 'Payload Injection (KINETIC)' },
  { value: 'generate_content', label: 'Synthesis: Kinetic Manifest' },
  { value: 'generate_script', label: 'Logic Matrix: Narrative Induction' },
  { value: 'create_quote', label: 'Kinetic Extraction: Signal' },
  { value: 'schedule_post', label: 'Temporal Synchronicity' },
  { value: 'apply_effects', label: 'Neural Saturation Layer' },
  { value: 'add_music', label: 'Harmonic Resonator' },
  { value: 'export', label: 'Sovereign Manifest Export' },
]

const ACTION_ROUTES: Record<string, string> = {
  upload_video: '/dashboard/video',
  generate_content: '/dashboard/content',
  generate_script: '/dashboard/scripts',
  create_quote: '/dashboard/quotes',
  schedule_post: '/dashboard/scheduler',
}

export default function OperationalSequenceHubPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [executingId, setExecutingId] = useState<string | null>(null)
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

  const loadLattice = useCallback(async () => {
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
      showToast('SIGNAL_INTERRUPT: LATTICE_DESYNC', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) return
    loadLattice()
  }, [user, loadLattice])

  const handleExecute = async (workflowId: string) => {
    setExecutingId(workflowId)
    try {
      const res = await apiPost<{ data?: { workflow?: Workflow } }>(`/workflows/${workflowId}/execute`, { data: {} })
      const workflow = (res as any)?.data?.workflow
      showToast('SIGNAL_LOCKED: SWARM_FLOW_INITIATED', 'success')
      if (workflow?.steps?.length) {
        const route = ACTION_ROUTES[workflow.steps[0].action]
        if (route) router.push(route)
      }
      loadLattice()
    } catch {
      showToast('EXECUTION_VOID: FLOW_DIFFRACTED', 'error')
    } finally {
      setExecutingId(null)
    }
  }

  const handleSave = async () => {
    const validSteps = form.steps.filter(s => s.action)
    if (!form.name.trim() || validSteps.length === 0) {
      showToast('NODE_PARAMETERS_INCOMPLETE', 'error')
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
      showToast('SWARM_NODE_PARAMETERS_SEALED', 'success')
      setEditingWorkflow(null); setShowCreateModal(false); loadLattice()
    } catch {
      showToast('SYNTHESIS_FAIL: FLOW_REJECTED', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('TERMINATE_SWARM_FLOW_NODE?')) return
    try {
      await apiDelete(`/workflows/${id}`)
      showToast('SIGNAL_PURGED: NODE_TERMINATED', 'success')
      loadLattice()
    } catch {
      showToast('PURGE_FAIL: SYSTEM_STASIS', 'error')
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
           <RefreshCw size={80} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <div className="space-y-4 text-center">
           <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Synchronizing Operational Sequences...</p>
           <p className="text-[10px] font-black text-slate-1000 uppercase tracking-[0.4em] leading-none">PROTOCOL_SYNC_ACTIVE</p>
        </div>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Layers size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Sequence Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button 
                onClick={() => router.push('/dashboard')} 
                title="Abort Sequence Session"
                className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center text-slate-1000 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl">
                <Target size={40} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Layers size={48} className="text-indigo-400 relative z-10 group-hover:rotate-180 transition-transform duration-1000" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Operational Lattice v14.2</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-ping" />
                       <span className="text-[10px] font-black text-slate-1000 tracking-[0.3em] uppercase italic leading-none">SEQUENCE_READY</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">OPERATIONAL_SEQUENCE_HUB</h1>
                 <p className="text-slate-1000 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Autonomous cascading operations for sovereign content clusters and kinetic execution lanes.</p>
              </div>
           </div>

           <button 
             onClick={() => { setEditingWorkflow(null); setForm({ name: '', description: '', teamId: '', steps: [{ action: '', config: {} }], isTemplate: false, tags: '' }); setShowCreateModal(true) }}
             title="Initiate New Sequence Protocol"
             className="px-16 py-8 bg-white text-black rounded-[3rem] text-[15px] font-black uppercase tracking-[0.5em] shadow-[0_50px_150px_rgba(255,255,255,0.15)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center gap-8 italic active:scale-95 group"
           >
             <Plus size={32} className="group-hover:rotate-180 transition-transform duration-1000" /> 
             INITIATE_SEQUENCE
           </button>
        </div>

        {/* Sequence Induction HUD */}
        <AnimatePresence>
           {suggestions.length > 0 && (
             <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} className={`${glassStyle} rounded-[6rem] p-20 shadow-[0_100px_300px_rgba(0,0,0,0.6)] relative overflow-hidden z-20 group`}>
                <div className="absolute top-0 right-0 p-20 opacity-[0.03] pointer-events-none group-hover:rotate-180 transition-transform duration-[4s]"><Sparkles size={600} className="text-indigo-400" /></div>
                <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter flex items-center gap-8 mb-16">
                   <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center animate-pulse shadow-3xl"><Cpu size={40} className="text-indigo-400" /></div>
                   Autonomous Sequence Induction
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                   {suggestions.map((s, i) => (
                      <div key={i} className="p-12 rounded-[4.5rem] bg-white/[0.02] border-2 border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.05] transition-all duration-1000 group/card shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover/card:opacity-[0.12] transition-opacity duration-1000"><Radio size={180} /></div>
                         <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-6 group-hover/card:text-indigo-400 transition-colors duration-1000">{s.title}</h3>
                         <p className="text-[13px] font-black text-slate-1000 uppercase tracking-widest leading-tight mb-12 italic opacity-60 group-hover/card:opacity-100 transition-opacity duration-1000">{s.description}</p>
                         {s.workflowId && (
                           <button 
                             onClick={() => handleExecute(s.workflowId)} 
                             disabled={!!executingId} 
                             title="Deploy Sequence Logic"
                             className="flex items-center gap-6 text-[14px] font-black text-indigo-400 uppercase tracking-[0.5em] hover:text-white transition-all duration-700 italic group/btn"
                           >
                               DEPLOY_SEQUENCE <ChevronRight size={20} className="group-hover/btn:translate-x-4 transition-transform duration-700" />
                           </button>
                         )}
                      </div>
                   ))}
                </div>
             </motion.div>
           )}
        </AnimatePresence>

        {/* Sequence Lattice */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-16 relative z-10">
           {workflows.map((w) => (
             <motion.div 
               layout 
               key={w._id} 
               whileHover={{ scale: 1.02, y: -10 }}
               className={`${glassStyle} rounded-[5rem] p-16 flex flex-col hover:border-indigo-500/50 hover:bg-white/[0.05] transition-all duration-1000 group shadow-[0_100px_300px_rgba(0,0,0,0.8)] relative overflow-hidden`}
             >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.15] transition-opacity duration-1000 pointer-events-none group-hover:rotate-180"><Layout size={320} className="text-white" /></div>
                <div className="flex justify-between items-start mb-12 relative z-10">
                   <div className="space-y-4">
                      <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-400 transition-colors duration-1000">{w.name}</h3>
                      <p className="text-[13px] font-black text-slate-1000 uppercase tracking-[0.4em] font-mono leading-none italic opacity-60 group-hover:opacity-100 transition-opacity duration-1000">{w.description || "NULL_DESCRIPTOR"}</p>
                   </div>
                   {w.isTemplate && <span className="px-6 py-2 rounded-2xl bg-indigo-500/10 text-indigo-400 border-2 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest italic shadow-3xl">TEMPLATE</span>}
                </div>

                <div className="mb-12 relative z-10">
                   <div className="flex items-center gap-6 mb-8"><div className="h-px bg-white/10 flex-1" /><span className="text-[12px] font-black text-slate-1000 uppercase tracking-[0.6em] italic opacity-40">OPERATIONAL_CHAIN</span><div className="h-px bg-white/10 flex-1" /></div>
                   <div className="space-y-6">
                      {w.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-8 p-6 rounded-[2rem] bg-black/40 border border-white/5 group/step transition-all duration-1000 hover:border-indigo-500/30">
                           <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-[14px] font-black italic shadow-inner">{step.order}</div>
                           <span className="text-[14px] font-black text-white uppercase tracking-widest italic flex-1">{step.action.replace(/_/g, ' ')}</span>
                           {i < w.steps.length - 1 && <ChevronRight size={24} className="text-slate-1000 animate-pulse" />}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-16 relative z-10">
                   {w.tags?.map(t => <span key={t} className="px-6 py-2 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-1000 uppercase italic tracking-widest hover:text-indigo-400 hover:border-indigo-500/50 transition-all cursor-default">#{t}</span>)}
                </div>

                <div className="mt-auto pt-10 border-t-2 border-white/5 flex items-center justify-between mb-12 relative z-10">
                   <div className="flex items-center gap-12">
                      <div className="space-y-2">
                         <p className="text-[11px] font-black text-slate-1000 uppercase tracking-widest italic leading-none opacity-40">EXECUTIONS</p>
                         <p className="text-[18px] font-black text-white italic tabular-nums leading-none group-hover:text-indigo-400 transition-colors duration-1000">{w.frequency}</p>
                      </div>
                      {w.lastUsed && (
                        <div className="space-y-2">
                           <p className="text-[11px] font-black text-slate-1000 uppercase tracking-widest italic leading-none opacity-40">LAST_PULSE</p>
                           <p className="text-[18px] font-black text-white italic leading-none group-hover:text-emerald-400 transition-colors duration-1000">{new Date(w.lastUsed).toLocaleDateString().toUpperCase()}</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="flex gap-6 relative z-10">
                   <button 
                     onClick={() => handleExecute(w._id)} 
                     disabled={!!executingId} 
                     title="Engage Sequence Protocol"
                     className="flex-1 py-6 bg-white text-black rounded-[2.5rem] text-[15px] font-black uppercase tracking-[0.5em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center justify-center gap-6 shadow-3xl active:scale-95 disabled:opacity-20 italic group/btn"
                   >
                      {executingId === w._id ? <RefreshCw className="animate-spin" size={24} /> : <Play size={24} className="fill-current group-hover/btn:scale-125 transition-transform duration-700" />} ENGAGE_PROTOCOL
                   </button>
                   <button 
                     onClick={() => { setEditingWorkflow(w); setForm({ name: w.name, description: w.description || '', teamId: (w as any).teamId || '', steps: w.steps.map(s => ({ action: s.action, config: s.config || {} })), isTemplate: w.isTemplate, tags: w.tags.join(', ') }); setShowCreateModal(true) }} 
                     title="Modify Sequence Parameters"
                     className="w-20 h-20 rounded-[2.2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-1000 hover:text-white transition-all duration-1000 shadow-3xl active:scale-95 hover:border-indigo-500/50 hover:bg-white/[0.05] group"
                   >
                     <Pencil size={28} className="group-hover:rotate-12 transition-transform duration-700" />
                   </button>
                   <button 
                     onClick={() => handleDelete(w._id)} 
                     title="Terminate Sequence Node"
                     className="w-20 h-20 rounded-[2.2rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-1000 shadow-3xl active:scale-95 group"
                   >
                     <Trash2 size={28} className="group-hover:scale-110 transition-transform duration-700" />
                   </button>
                </div>
             </motion.div>
           ))}
        </div>

        {/* Modal Matrix Overlay */}
        <AnimatePresence>
           {showCreateModal && (
             <div className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/95 backdrop-blur-3xl" onClick={() => setShowCreateModal(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} className={`${glassStyle} rounded-[6rem] p-24 max-w-6xl w-full border-white/20 max-h-[95vh] overflow-y-auto custom-scrollbar relative shadow-[0_150px_400px_rgba(0,0,0,1)]`} onClick={e => e.stopPropagation()}>
                   <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none group-hover:rotate-180 transition-transform duration-[4s]"><Compass size={600} className="text-white" /></div>
                   <div className="flex justify-between items-center mb-20 relative z-10 border-b-2 border-white/10 pb-12">
                      <div className="flex items-center gap-12">
                        <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl animate-pulse"><Layers size={48} className="text-indigo-400" /></div>
                        <div>
                          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">{editingWorkflow ? 'Configure Sequence' : 'Initialize Sequence'}</h2>
                          <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.6em] italic leading-none">LOGIC_SEQUENCE_SYNTHESIS</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowCreateModal(false)} 
                        title="Close Modal"
                        className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-1000 hover:text-white transition-all hover:rotate-90 hover:border-rose-500/50"
                      >
                        <X size={40} />
                      </button>
                   </div>

                   <div className="space-y-20 relative z-10">
                      <div className="space-y-8">
                        <label className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none ml-8">SEQUENCE_DESIGNATION</label>
                        <input 
                          value={form.name} 
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                          className="w-full bg-black/60 border-2 border-white/10 rounded-[3.5rem] px-16 py-12 text-6xl font-black text-white italic uppercase focus:border-indigo-500/50 transition-all shadow-inner placeholder:text-slate-950" 
                          aria-label="Sequence Name" 
                          placeholder="SEQUENCE_ID_ALPHA..." 
                        />
                      </div>
                      
                      <div className="space-y-8">
                        <label className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none ml-8">OPERATIONAL_PARAMETERS</label>
                        <textarea 
                          value={form.description} 
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                          rows={4} 
                          className="w-full bg-black/60 border-2 border-white/10 rounded-[4.5rem] px-16 py-16 text-2xl font-black text-slate-400 italic uppercase focus:border-indigo-500/50 transition-all placeholder:text-slate-950 leading-relaxed shadow-inner" 
                          aria-label="Sequence Description" 
                          placeholder="OUTLINE_AUTONOMOUS_TRAJECTORY_CLUSTERS..." 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                         <div className="space-y-8">
                           <label className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none ml-8">SQUADRON_ASSIGNMENT</label>
                           <div className="relative">
                             <select 
                               value={form.teamId} 
                               title="Select Team Assignment"
                               onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} 
                               className="w-full bg-black/60 border-2 border-white/10 rounded-[3rem] px-12 py-10 text-[16px] font-black text-white uppercase tracking-[0.5em] italic shadow-3xl appearance-none focus:border-indigo-500/50 transition-all cursor-pointer"
                             >
                               <option value="">PERSONAL_CLUSTER_ONLY</option>
                               {teams.map(t => <option key={t._id} value={t._id} className="bg-[#050505]">{t.name}</option>)}
                             </select>
                             <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                               <ChevronRight size={32} className="rotate-90" />
                             </div>
                           </div>
                         </div>
                         <div className="space-y-8">
                           <label className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none ml-8">METADATA_LATTICE_TAGS</label>
                           <input 
                             value={form.tags} 
                             onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} 
                             className="w-full bg-black/60 border-2 border-white/10 rounded-[3rem] px-12 py-10 text-[16px] font-black text-white uppercase tracking-[0.5em] italic shadow-inner placeholder:text-slate-950" 
                             placeholder="KINETIC, STRATEGY, SYNC..." 
                           />
                         </div>
                      </div>

                      <div className="space-y-12 pt-16 border-t-2 border-white/10">
                         <label className="text-[18px] font-black text-white uppercase tracking-[1.2em] italic leading-none block mb-8 text-center">OPERATIONAL_FLOW_ARCHITECTURE</label>
                         <div className="space-y-8">
                            {form.steps.map((step, i) => (
                               <div key={i} className="flex items-center gap-10 p-8 bg-white/[0.02] border-2 border-white/10 rounded-[4rem] group/step transition-all duration-1000 hover:border-indigo-500/40 hover:bg-white/[0.05] shadow-2xl">
                                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-3xl italic shadow-inner">{i + 1}</div>
                                  <select 
                                    value={step.action} 
                                    title={`Select Step ${i + 1} Action`}
                                    onChange={e => { const up = [...form.steps]; up[i].action = e.target.value; setForm(f => ({ ...f, steps: up })) }} 
                                    className="flex-1 bg-transparent text-3xl font-black text-white uppercase italic tracking-tighter focus:outline-none appearance-none cursor-pointer group-hover/step:text-indigo-400 transition-colors"
                                  >
                                     <option value="">SELECT_MODULAR_NODE_ACTION...</option>
                                     {ACTIONS.map(a => <option key={a.value} value={a.value} className="bg-[#050505]">{a.label}</option>)}
                                  </select>
                                  <button 
                                    onClick={() => { const up = form.steps.filter((_, j) => j !== i); setForm(f => ({ ...f, steps: up.length ? up : [{ action: '', config: {} }] })) }} 
                                    title="Remove Sequence Step"
                                    className="w-16 h-16 rounded-2xl bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-700 shadow-3xl"
                                  >
                                    <X size={28} />
                                  </button>
                               </div>
                            ))}
                            <button 
                              onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { action: '', config: {} }] }))} 
                              className="w-full py-12 border-4 border-dashed border-white/10 rounded-[5rem] text-[20px] font-black text-slate-1000 uppercase tracking-[1em] hover:border-indigo-500/50 hover:text-indigo-400 transition-all duration-1000 italic bg-white/[0.01]"
                            >
                              + APPEND_SEQUENCE_STEP
                            </button>
                         </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-16 pt-20 border-t-2 border-white/10">
                         <button onClick={() => setShowCreateModal(false)} className="text-[16px] font-black text-rose-500/20 hover:text-rose-500 uppercase tracking-[0.8em] transition-all duration-1000 italic">ABORT_SYNTHESIS</button>
                         <button onClick={handleSave} className="px-32 py-12 bg-white text-black rounded-[4rem] text-[20px] font-black uppercase tracking-[0.8em] shadow-[0_50px_100px_rgba(255,255,255,0.15)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic active:scale-95">SEAL_SEQUENCE_PARAMETERS</button>
                      </div>
                   </div>
                </motion.div>
             </div>
           )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;400;700;900&display=swap');
          body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 20px; border: 2px solid rgba(0,0,0,0.5); }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
          select { -webkit-appearance: none; appearance: none; cursor: pointer; }
          option { background-color: #050505; color: white; padding: 20px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
