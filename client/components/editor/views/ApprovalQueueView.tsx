'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Eye, 
  Filter, 
  Search, 
  ArrowRight,
  ShieldCheck,
  History,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  Sparkles,
  Info, Wand2
} from 'lucide-react'
import VisualDiffViewer from '../VisualDiffViewer'

interface Approval {
  _id: string;
  contentId: {
    _id: string;
    title: string;
    type: string;
    thumbnail?: string;
  };
  workflowId: {
    name: string;
  };
  createdBy: {
    name: string;
  };
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'changes_requested';
  currentStage: number;
  stages: any[];
  createdAt: string;
}

const ApprovalQueueView: React.FC = () => {
  const [approvals, setApprovals] = React.useState<Approval[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'pending' | 'all'>('pending')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [comment, setComment] = React.useState('')
  const [processing, setProcessing] = React.useState(false)
  const [showDiff, setShowDiff] = React.useState(false)
  const [detailedApproval, setDetailedApproval] = React.useState<any>(null)

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/approvals/my-approvals?status=${filter === 'pending' ? 'pending' : ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setApprovals(result.data.approvals)
      }
    } catch (err) {
      console.error('Failed to fetch approvals', err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchApprovals()
  }, [filter])

  const fetchDetailedApproval = async (id: string) => {
    try {
      const response = await fetch(`/api/approvals/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setDetailedApproval(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch detailed approval', err)
    }
  }

  React.useEffect(() => {
    if (selectedId) {
      fetchDetailedApproval(selectedId)
    } else {
      setDetailedApproval(null)
    }
  }, [selectedId])

  const handleAction = async (action: 'approve' | 'reject' | 'request-changes' | 'accept-v2') => {
    if (!selectedId) return
    setProcessing(true)
    try {
      const endpoint = action === 'accept-v2' 
        ? `/api/approvals/${selectedId}/accept-v2`
        : `/api/approvals/${selectedId}/${action.replace('_', '-')}` // Map request-changes to request-changes
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          comment, 
          rejectionReason: action === 'reject' ? comment : undefined,
          requestedChanges: action === 'request-changes' ? comment : undefined
        })
      })
      const result = await response.json()
      if (result.success) {
        setSelectedId(null)
        setComment('')
        setShowDiff(false)
        fetchApprovals()
      }
    } catch (err) {
      console.error(`Failed to ${action} approval`, err)
    } finally {
      setProcessing(false)
    }
  }

  const selectedApproval = approvals.find(a => a._id === selectedId)

  return (
    <div className="flex gap-8 h-full">
      <div className="flex-1 flex flex-col gap-8">
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-[0.2em] italic text-emerald-400 flex items-center gap-4">
              <ShieldCheck className="w-6 h-6" />
              Sovereign Approval Feed
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
              Systemized intake relay for multi-tier content verification
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
                >
                  Action Required
                </button>
                <button 
                  onClick={() => setFilter('all')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  All Entries
                </button>
             </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
             <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-[2rem] bg-white/[0.02] border border-white/5 animate-pulse" />
                ))}
             </div>
          ) : (
            <div className="space-y-4">
              {approvals.length === 0 ? (
                <div className="h-64 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4">
                   <CheckCircle className="w-12 h-12 text-slate-700" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Queue is Optimal (0 Pending)</span>
                </div>
              ) : (
                approvals.map((approval) => (
                  <motion.div
                    key={approval._id}
                    layoutId={approval._id}
                    onClick={() => setSelectedId(approval._id)}
                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer group flex items-center justify-between ${
                      selectedId === approval._id 
                        ? 'bg-emerald-500/10 border-emerald-500/40' 
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 rounded-2xl bg-white/5 overflow-hidden relative border border-white/10">
                          {approval.contentId.thumbnail && <img src={approval.contentId.thumbnail} className="w-full h-full object-cover" />}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Eye className="w-5 h-5 text-white" />
                          </div>
                       </div>
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-[10px] font-black text-white italic">{approval.contentId.title}</span>
                             <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[7px] font-black text-slate-500 uppercase">{approval.contentId.type}</span>
                          </div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Requested by {approval.createdBy.name}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-12">
                       <div className="text-right">
                          <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Pipeline State</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-white uppercase">{approval.workflowId.name}</span>
                             <ArrowRight className="w-3 h-3 text-slate-600" />
                             <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[8px] font-black text-violet-400 uppercase">Stage {approval.currentStage + 1}</span>
                          </div>
                       </div>
                       
                       <div className="w-32 text-right">
                          <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Timestamp</span>
                          <span className="text-[10px] font-mono text-white">{new Date(approval.createdAt).toLocaleDateString()}</span>
                       </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Sidebar */}
      <AnimatePresence>
        {selectedId && selectedApproval && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 450, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-white/[0.02] border-l border-white/5 flex flex-col overflow-hidden"
          >
            <div className="p-8 flex flex-col gap-8 h-full">
               <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                     <History className="w-4 h-4 text-violet-400" />
                     Decision Matrix
                  </h3>
                  <button onClick={() => setSelectedId(null)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all">
                     <XCircle className="w-4 h-4" />
                  </button>
               </div>

               <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10">
                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Selected Payload</span>
                     <div className="aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden relative mb-4">
                        {selectedApproval.contentId.thumbnail && <img src={selectedApproval.contentId.thumbnail} className="w-full h-full object-cover" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                           <span className="text-[10px] font-black text-white tracking-widest uppercase italic">{selectedApproval.contentId.title}</span>
                        </div>
                     </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Protocol Feedback</span>
                     
                     {/* AI Revision Banner */}
                     {detailedApproval?.contentId?.metadata?.proposedV2 && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-4"
                       >
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                <span className="text-[10px] font-black text-white uppercase italic">AI Revision Drafted</span>
                             </div>
                             <button 
                               onClick={() => setShowDiff(true)}
                               className="text-[9px] font-black text-violet-400 uppercase hover:underline"
                             >
                                Visual Diff &rarr;
                             </button>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed italic truncate">
                             &quot;{detailedApproval.contentId.metadata.proposedV2.explanation}&quot;
                          </p>
                       </motion.div>
                     )}

                     <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Enter verdict or requested modifications..."
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] text-white focus:border-violet-500/50 outline-none transition-all resize-none font-bold uppercase tracking-widest placeholder:text-slate-700"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mt-auto">
                  {detailedApproval?.contentId?.metadata?.proposedV2 ? (
                    <button
                      onClick={() => handleAction('accept-v2')}
                      disabled={processing}
                      className="col-span-2 py-4 rounded-[1.5rem] bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all shadow-[0_10px_30px_rgba(139,92,246,0.4)] disabled:opacity-50"
                    >
                       <Wand2 className="w-4 h-4" />
                       Accept AI Revision & Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={processing}
                      className="col-span-2 py-4 rounded-[1.5rem] bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)] disabled:opacity-50"
                    >
                       <CheckCircle className="w-4 h-4" />
                       Issue Complete Approval
                    </button>
                  )}
                  <button
                    onClick={() => handleAction('request-changes')}
                    disabled={processing || !comment}
                    className="py-4 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/50 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                  >
                     <MessageSquare className="w-4 h-4" />
                     Request Change
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={processing || !comment}
                    className="py-4 rounded-[1.5rem] bg-rose-500/10 border border-rose-500/50 text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                  >
                     <XCircle className="w-4 h-4" />
                     Final Rejection
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Diff Modal Overlay */}
      {showDiff && detailedApproval && (
        <VisualDiffViewer 
          originalUrl={detailedApproval.contentId.videoUrl || ''}
          originalTimeline={detailedApproval.contentId.timeline}
          v2Timeline={detailedApproval.contentId.metadata?.proposedV2?.timeline}
          v2Explanation={detailedApproval.contentId.metadata?.proposedV2?.explanation}
          onAccept={() => handleAction('accept-v2')}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  )
}

export default ApprovalQueueView
