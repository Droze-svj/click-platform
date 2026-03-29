'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, Plus, ChevronRight, MessageSquare, Video, Shield, 
  UserPlus, Globe, Cpu, Radio, Activity, Network, Zap, 
  Target, Terminal, Database, ArrowRight, ArrowLeft,
  Fingerprint, Gauge, Sparkles, Brain
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

interface Team {
  _id: string; name: string; description: string;
  ownerId: { _id: string; name: string; email: string };
  members: Array<{ userId: { _id: string; name: string; email: string }; role: string; joinedAt: string }>;
}

export default function SwarmCollectiveNodePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const loadSwarmData = useCallback(async () => {
    try {
      const res = await apiGet('/teams')
      const data = extractApiData<Team[]>(res as any) ?? (res as any)?.data
      setTeams(Array.isArray(data) ? data : [])
    } catch {
      showToast('SWARM_SYNC_ERR: NERVE CENTER OFFLINE', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login')
      return
    }
    loadSwarmData()
  }, [user, router, loadSwarmData, loading])

  const handleClusterGenesis = async () => {
    if (!name.trim()) {
      showToast('CLUSTER_ERR: DESIGNATION REQUIRED', 'error')
      return
    }
    setCreating(true)
    try {
      await apiPost('/teams', { name: name.trim(), description: description.trim() })
      showToast('OPERATIVE CLUSTER INITIALIZED', 'success')
      setShowCreateModal(false)
      setName('')
      setDescription('')
      await loadSwarmData()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'INIT_FAILED: PROTOCOL REJECTED', 'error')
    } finally {
      setCreating(false)
    }
  }

  const isPrimeOrchestrator = (t: Team) =>
    (t.ownerId as any)?._id === (user as any)?.id || (t.ownerId as any)?._id === (user as any)?._id

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <Network size={80} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <div className="space-y-4 text-center">
          <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Linking Swarm Collective Nodes...</p>
          <p className="text-[10px] font-black text-slate-1000 uppercase tracking-[0.4em] leading-none">COHERENCE_LEVEL_98%</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1600px] mx-auto space-y-20">
      <ToastContainer />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
          <Network size={800} className="text-white" />
       </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
        <div className="flex items-center gap-12">
          <button 
            onClick={() => router.push('/dashboard')} 
            title="Abort Swarm Session"
            className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center text-slate-900 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl hover:border-rose-500/50">
            <ArrowLeft size={40} />
          </button>
          <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
             <Users size={48} className="text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-1000" />
          </div>
          <div>
            <div className="flex items-center gap-6 mb-4">
              <Activity className="text-indigo-500 animate-pulse" size={16} />
              <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Swarm Collective v12.4</span>
            </div>
            <h1 className="text-9xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">SWARM</h1>
            <p className="text-slate-1000 text-[14px] uppercase font-black tracking-[0.4em] mt-6 italic leading-none">Distributed coordination of sovereign operative clusters.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          title="Deploy Operative Nexus"
          className="px-16 py-8 bg-white text-black rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_50px_150px_rgba(255,255,255,0.05)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center gap-8 italic active:scale-95 group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-indigo-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-1000" />
          <div className="relative z-10 flex items-center gap-6">
            <Plus size={32} className="group-hover:rotate-180 transition-transform duration-1000" />
            DEPLOY_OPERATIVE_NEXUS
          </div>
        </button>
      </div>

      {/* Sovereign Sync Protocol HUD */}
      <div className={`${glassStyle} p-20 rounded-[6rem] relative overflow-hidden group/hud z-10 border-indigo-500/10 hover:border-indigo-500/30`}>
         <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none group-hover/hud:opacity-[0.1] transition-all duration-[3s] group-hover/hud:scale-125 group-hover/hud:rotate-12"><Radio size={400} className="text-indigo-400" /></div>
         <div className="relative z-10 max-w-5xl">
            <div className="flex items-center gap-10 mb-10">
               <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl relative group-hover/hud:scale-110 transition-transform duration-1000">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-2xl opacity-0 group-hover/hud:opacity-100 transition-opacity" />
                  <MessageSquare size={40} className="text-indigo-400 relative z-10" />
               </div>
               <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Sovereign Sync Protocol</h3>
            </div>
            <p className="text-[22px] text-slate-1000 font-black leading-tight italic mb-16 uppercase tracking-tight max-w-3xl">
              Low-latency visual synthesis, spectral audio, and <strong className="text-indigo-400 tracking-widest bg-indigo-500/10 px-4 py-1 rounded-xl">ENCRYPTED_MESH_SYNC</strong> protocols are integrated into every objective. Deploy to the <strong className="text-indigo-400 underline decoration-indigo-500/30 underline-offset-8">Operational Pulse Grid</strong> for live swarm resonance.
            </p>
            <button onClick={() => router.push('/dashboard/tasks')}
              title="Enter Operations Node"
              className="px-12 py-6 rounded-[3rem] text-[15px] font-black text-white uppercase tracking-[0.4em] bg-white/[0.02] border-2 border-white/10 hover:bg-indigo-500 transition-all duration-1000 flex items-center gap-8 italic group/btn shadow-3xl active:scale-95"
            >
              <Video size={28} className="group-hover/btn:scale-125 transition-transform duration-1000" />
              ENTER_OPERATIONS_NODE <ArrowRight size={28} className="group-hover/btn:translate-x-4 transition-transform duration-1000" />
            </button>
         </div>
      </div>

      {teams.length === 0 ? (
        <div className={`${glassStyle} rounded-[8rem] p-56 text-center border-dashed border-2 border-white/10 flex flex-col items-center z-10 hover:border-indigo-500/20 group/empty transition-all duration-1000 shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
          <div className="w-48 h-48 rounded-[6rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center mb-16 shadow-[0_0_120px_rgba(99,102,241,0.2)] group/icon relative">
             <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] opacity-0 group-hover/empty:opacity-100 transition-opacity duration-1000" />
             <Network size={80} className="text-slate-1000 group-hover/empty:text-indigo-400 group-hover/empty:rotate-[135deg] transition-all duration-[2s] relative z-10" />
          </div>
          <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-10 group-hover/empty:text-indigo-400 transition-colors duration-1000">No Active Clusters Detected</h3>
          <p className="text-slate-1000 text-[18px] font-black uppercase tracking-[0.5em] max-w-xl mb-20 italic leading-tight opacity-40 group-hover/empty:opacity-80 transition-opacity duration-1000">
            Initialize your first sovereign operative cluster to begin distributed workflow execution and collective logic synthesis.
          </p>
          <button 
            onClick={() => setShowCreateModal(true)}
            title="Deploy Node_01"
            className="px-20 py-10 bg-white text-black rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 shadow-[0_50px_150px_rgba(255,255,255,0.05)] active:scale-95 italic"
          >
            DEPLOY_NODE_01
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 z-10 relative">
          {teams.map((team, idx) => (
            <motion.div 
              layout 
              key={team._id} 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 1 }}
              whileHover={{ y: -20, scale: 1.02 }}
              className={`${glassStyle} rounded-[6rem] p-16 group relative flex flex-col min-h-[500px] border-white/5 hover:border-indigo-500/40 transition-all duration-1000 overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,0.8)]`}
            >
              <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-[2s] rotate-12 group-hover:rotate-0"><Cpu size={300} /></div>
              
              <div className="flex justify-between items-start mb-12">
                <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:rotate-[360deg] transition-all duration-1000 shadow-3xl">
                   <Cpu size={48} className="text-indigo-400 group-hover:text-white transition-colors duration-1000" />
                </div>
                {isPrimeOrchestrator(team) && (
                  <div className="px-6 py-2 bg-indigo-500 text-black text-[12px] font-black uppercase tracking-[0.4em] rounded-full shadow-[0_0_40px_rgba(99,102,241,0.5)] italic animate-pulse">
                    PRIME_ORCHESTRATOR
                  </div>
                )}
              </div>

              <div className="flex-1 mb-16 relative z-10">
                <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-4 italic">Operative Nexus_0{idx + 1}</p>
                <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-8 group-hover:text-indigo-400 transition-colors duration-1000 leading-tight line-clamp-2">{team.name}</h3>
                {team.description && (
                  <div className="p-6 bg-black/40 rounded-[3rem] border-2 border-white/5 shadow-inner">
                    <p className="text-[14px] text-slate-1000 font-black uppercase italic tracking-widest leading-normal line-clamp-3">
                      {team.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-12 border-t-2 border-white/5 relative z-10">
                 <div className="flex -space-x-6">
                    {team.members.slice(0, 5).map((m, i) => (
                      <div key={i} title={m.userId?.name} className="w-16 h-16 rounded-[2rem] bg-[#050505] border-2 border-white/10 flex items-center justify-center text-[18px] font-black text-white uppercase overflow-hidden ring-8 ring-[#020205] transition-all hover:z-50 hover:scale-125 hover:-translate-y-4 shadow-3xl relative">
                         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-40" />
                         <span className="relative z-10">{m.userId?.name?.charAt(0) || '?'}</span>
                      </div>
                    ))}
                    {team.members.length > 5 && (
                      <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 border-2 border-white/10 flex items-center justify-center text-[14px] font-black text-white ring-8 ring-[#020205] shadow-3xl italic">
                         +{team.members.length - 5}
                      </div>
                    )}
                 </div>
                 <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-[10px] font-black text-slate-1000 uppercase tracking-[0.6em] italic leading-none opacity-40 group-hover:opacity-100 transition-opacity duration-1000">OPERATIVE_NODES</p>
                    <p className="text-6xl font-black text-indigo-400 italic tabular-nums leading-none tracking-tighter group-hover:scale-110 transition-transform duration-1000">{team.members.length}</p>
                 </div>
              </div>

              <button 
                onClick={() => router.push(`/dashboard/teams/${team._id}`)}
                title="Orchestrate Swarm"
                className="w-full py-10 bg-white text-black rounded-[4rem] text-[15px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 shadow-[0_40px_100px_rgba(255,255,255,0.05)] italic active:scale-95 group/act flex items-center justify-center gap-6"
              >
                ORCHESTRATE_SWARM <ArrowRight size={28} className="group-hover/act:translate-x-4 transition-transform duration-1000" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal: Nexus Initialization */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-[#020205]/95 backdrop-blur-3xl" onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className={`${glassStyle} rounded-[7rem] p-24 max-w-4xl w-full border-white/20 relative overflow-hidden shadow-[0_100px_300px_rgba(0,0,0,1)]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-[3s]"><UserPlus size={400} className="text-white" /></div>
              
              <div className="flex items-center gap-12 mb-20 relative z-10">
                <div className="w-24 h-24 rounded-[3.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse" />
                  <UserPlus size={48} className="text-indigo-400 relative z-10" />
                </div>
                <div>
                  <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Nexus Initialization</h2>
                  <p className="text-slate-1000 text-[12px] uppercase font-black tracking-[0.6em] mt-4 italic leading-none">DEPLOYING_COLLECTIVE_OPERATIVE_GRID</p>
                </div>
              </div>
              
              <div className="space-y-20 relative z-10">
                <div className="space-y-8">
                  <label htmlFor="nexus-designation" className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none pl-10">Collective Designation</label>
                  <input 
                    id="nexus-designation"
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    title="Nexus Designation"
                    className="w-full px-16 py-12 bg-black/60 border-2 border-white/5 rounded-[4rem] text-5xl font-black uppercase text-white tracking-widest focus:outline-none focus:border-indigo-500 transition-all duration-1000 placeholder:text-slate-1000 shadow-inner italic"
                    placeholder="ALPHA_SWARM_NODE" autoFocus
                  />
                </div>
                <div className="space-y-8">
                  <label htmlFor="strategic-directives" className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.8em] italic leading-none pl-10">Strategic Directives</label>
                  <textarea 
                    id="strategic-directives"
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    title="Strategic Directives"
                    className="w-full px-16 py-12 bg-black/60 border-2 border-white/5 rounded-[4rem] text-[22px] font-black uppercase text-white tracking-widest focus:outline-none focus:border-indigo-500 transition-all duration-1000 placeholder:text-slate-1000 shadow-inner italic min-h-[220px] resize-none"
                    placeholder="OUTLINE_PROTOCOL_OBJECTIVES..."
                  />
                </div>

                <div className="flex items-center gap-16 pt-16">
                  <button onClick={() => { setShowCreateModal(false); setName(''); setDescription('') }}
                    title="Abort Initialization"
                    className="text-[18px] font-black text-slate-1000 uppercase tracking-[0.6em] hover:text-rose-500 transition-all duration-1000 italic leading-none"
                  >
                    ABORT_INIT
                  </button>
                  <button onClick={handleClusterGenesis} disabled={creating || !name.trim()}
                    title="Initialize Nexus"
                    className="flex-1 py-12 bg-white text-black rounded-[4rem] text-[20px] font-black uppercase tracking-[0.8em] shadow-[0_50px_100px_rgba(255,255,255,0.05)] disabled:opacity-10 hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic active:scale-95 flex items-center justify-center gap-8 group/init"
                  >
                    {creating ? 'SYNCING_LATTICE...' : (
                      <>INITIALIZE_NEXUS <ArrowRight size={36} className="group-hover/init:translate-x-4 transition-transform duration-1000" /></>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        
        body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.3); border: 2px solid transparent; background-clip: content-box; }
      `}</style>
    </div>
  )
}
