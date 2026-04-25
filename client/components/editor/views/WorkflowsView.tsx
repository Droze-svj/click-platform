'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GitBranch, 
  Plus, 
  Settings, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  ArrowRight,
  Shield,
  Zap
} from 'lucide-react'
import ApprovalWorkflowBuilder from '../../ApprovalWorkflowBuilder'

interface Workflow {
  _id: string;
  name: string;
  description: string;
  isDefault: boolean;
  stages: any[];
  updatedAt: string;
}

const WorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([])
  const [isCreating, setIsCreating] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined)

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/approvals/workflows', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setWorkflows(result.data.workflows)
      }
    } catch (err) {
      console.error('Failed to fetch workflows', err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchWorkflows()
  }, [])

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] italic text-violet-400 flex items-center gap-4">
            <GitBranch className="w-6 h-6" />
            Approval Pipelines
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
            Multi-stage content verification protocols for high-velocity agencies
          </p>
        </div>
        <div className="flex items-center gap-4">
           {!isCreating && (
             <button
               onClick={() => {
                 setEditingId(undefined)
                 setIsCreating(true)
               }}
               className="px-6 py-2 rounded-xl bg-violet-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_10px_20px_rgba(139,92,246,0.3)]"
             >
               + Create New Pipeline
             </button>
           )}
           {isCreating && (
             <button
               onClick={() => setIsCreating(false)}
               className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
             >
               [ Cancel Builder ]
             </button>
           )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="wait">
          {isCreating ? (
            <motion.div
              key="builder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/5 rounded-[3rem] p-8 border border-white/10"
            >
              <ApprovalWorkflowBuilder 
                workflowId={editingId} 
                onSave={() => {
                  setIsCreating(false)
                  fetchWorkflows()
                }} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              className="grid grid-cols-12 gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="col-span-12 grid grid-cols-3 gap-6">
                 {loading ? (
                   Array.from({ length: 3 }).map((_, i) => (
                     <div key={i} className="h-64 rounded-[2.5rem] bg-white/[0.02] border border-white/5 animate-pulse" />
                   ))
                 ) : (
                   workflows.map((workflow) => (
                     <motion.div
                       key={workflow._id}
                       whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.04)' }}
                       className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/10 group cursor-pointer transition-all flex flex-col justify-between"
                       onClick={() => {
                         setEditingId(workflow._id)
                         setIsCreating(true)
                       }}
                     >
                       <div>
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                  <Shield className="w-5 h-5 text-violet-400" />
                               </div>
                               {workflow.isDefault && (
                                 <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase">Default Protocol</span>
                               )}
                            </div>
                            <Settings className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                          </div>
                          
                          <h3 className="text-lg font-black text-white italic mb-2">{workflow.name}</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider line-clamp-2 leading-relaxed">
                            {workflow.description || 'Verified multi-stage approval logic.'}
                          </p>
                       </div>

                       <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                          <div className="flex -space-x-2">
                             {Array.from({ length: Math.min(workflow.stages.length, 3) }).map((_, i) => (
                               <div key={i} className="w-6 h-6 rounded-full bg-violet-500 border border-black flex items-center justify-center text-[8px] font-black text-black">
                                  {i + 1}
                               </div>
                             ))}
                             {workflow.stages.length > 3 && (
                               <div className="w-6 h-6 rounded-full bg-white/10 border border-black flex items-center justify-center text-[8px] font-black text-white">
                                  +{workflow.stages.length - 3}
                               </div>
                             )}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase">
                             <span>Last Modified: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                          </div>
                       </div>
                     </motion.div>
                   ))
                 )}

                 <motion.div
                    whileHover={{ scale: 0.98 }}
                    onClick={() => {
                      setEditingId(undefined)
                      setIsCreating(true)
                    }}
                    className="border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 group cursor-pointer hover:border-violet-500/30 transition-all min-h-[250px]"
                 >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-violet-500 transition-all">
                       <Plus className="w-6 h-6 text-slate-500 group-hover:text-black" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-violet-400 transition-all">Initialize New Protocol</span>
                 </motion.div>
              </div>

              <div className="col-span-12 grid grid-cols-2 gap-8">
                 <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 flex flex-col gap-6">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                       <Clock className="w-4 h-4 text-emerald-400" />
                       Recent Approval Latency
                    </h3>
                    <div className="space-y-4">
                       {[
                         { label: 'Avg Internal Cycle', value: '4.2h', trend: '-12%' },
                         { label: 'Avg Client Response', value: '18.4h', trend: '+4%' },
                         { label: 'Throughput', value: '98%', trend: 'Stable' },
                       ].map((stat, i) => (
                         <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                            <div className="flex items-center gap-4">
                               <span className="text-[11px] font-mono text-white">{stat.value}</span>
                               <span className={`text-[8px] font-black ${stat.trend.startsWith('-') ? 'text-emerald-400' : 'text-rose-400'} uppercase`}>{stat.trend}</span>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 flex flex-col gap-6">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                       <Zap className="w-4 h-4 text-amber-400" />
                       System Health
                    </h3>
                    <div className="flex-1 flex flex-col justify-center items-center gap-6">
                       <div className="relative w-32 h-32">
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                             <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
                             <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray="282.7" strokeDashoffset="42" className="text-violet-500" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="text-2xl font-black text-white italic">84%</span>
                             <span className="text-[7px] font-black text-slate-500 uppercase">Reliability</span>
                          </div>
                       </div>
                       <p className="text-[10px] text-center text-slate-400 uppercase font-bold max-w-[250px] leading-relaxed">
                          Your pipelines are currently operating with <span className="text-emerald-400 italic">Optimal Integrity</span>.
                       </p>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default WorkflowsView
