'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, ChevronRight, MessageSquare, Video, Shield,
  UserPlus, Globe, Cpu, Radio, Activity, Network, Zap,
  Target, Terminal, Database, ArrowRight, ArrowLeft,
  Fingerprint, Gauge, Sparkles, Brain, X, Crown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-300'

interface Team {
  _id: string; name: string; description: string;
  ownerId: { _id: string; name: string; email: string };
  members: Array<{ userId: { _id: string; name: string; email: string }; role: string; joinedAt: string }>;
}

export default function SwarmCollectiveNodePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')

  const loadSwarmData = useCallback(async () => {
    try {
      const res = await apiGet('/teams')
      const data = extractApiData<Team[]>(res as any) ?? (res as any)?.data
      setTeams(Array.isArray(data) ? data : [])
    } catch {
      showToast('Failed to load teams', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    loadSwarmData()
  }, [user, authLoading, router, loadSwarmData])

  const filteredTeams = teams.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  })

  const handleClusterGenesis = async () => {
    if (!name.trim()) {
      showToast('Team name is required', 'error')
      return
    }
    setCreating(true)
    try {
      await apiPost('/teams', { name: name.trim(), description: description.trim() })
      showToast('✓ Team created', 'success')
      setShowCreateModal(false)
      setName('')
      setDescription('')
      await loadSwarmData()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to create team', 'error')
    } finally {
      setCreating(false)
    }
  }

  const isPrimeOrchestrator = (t: Team) =>
    (t.ownerId as any)?._id === (user as any)?.id || (t.ownerId as any)?._id === (user as any)?._id

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <Network size={80} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <div className="space-y-4 text-center">
          <p className="text-[14px] font-bold text-indigo-400 uppercase tracking-[0.4em] animate-pulse leading-none">Loading teams…</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.3em] leading-none">Please wait</p>
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
          <button type="button"
            onClick={() => router.push('/dashboard')}
            title="Back to dashboard"
            className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95 hover:border-rose-500/50">
            <ArrowLeft size={28} />
          </button>
          <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-xl relative">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent" />
             <Users size={36} className="text-indigo-400 relative z-10" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Activity className="text-indigo-500 animate-pulse" size={14} />
              <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-indigo-400 leading-none">Click · Teams</span>
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter leading-none mb-3">Teams</h1>
            <p className="text-slate-400 text-[14px] font-medium tracking-wide leading-relaxed">Collaborate with editors, reviewers, and contributors on shared content.</p>
          </div>
        </div>
        <button type="button"
          onClick={() => setShowCreateModal(true)}
          title="Create new team"
          className="px-10 py-5 bg-white text-black rounded-[2rem] text-[13px] font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-3 active:scale-95"
        >
          <Plus size={18} /> New Team
        </button>
      </div>

      {/* Collaboration Hub */}
      <div className={`${glassStyle} p-10 rounded-[3rem] relative overflow-hidden group/hud z-10 border-indigo-500/10 hover:border-indigo-500/30`}>
         <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover/hud:opacity-[0.08] transition-all duration-700"><Radio size={300} className="text-indigo-400" /></div>
         <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-5 mb-5">
               <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center">
                  <MessageSquare size={22} className="text-indigo-400" />
               </div>
               <h3 className="text-3xl font-black text-white tracking-tighter leading-tight">Collaboration Hub</h3>
            </div>
            <p className="text-[15px] text-slate-300 font-medium leading-relaxed mb-8 max-w-2xl">
              Each team gets <strong className="text-indigo-400">shared assets</strong>, <strong className="text-indigo-400">comment threads</strong>, and an <strong className="text-indigo-400">approval queue</strong>. Manage tasks, briefs, and reviews together.
            </p>
            <button type="button" onClick={() => router.push('/dashboard/tasks')}
              title="Open tasks"
              className="px-7 py-3 rounded-full text-[13px] font-bold text-white uppercase tracking-[0.2em] bg-white/[0.05] border border-white/10 hover:bg-indigo-500 hover:border-indigo-500 transition-colors flex items-center gap-3 active:scale-95"
            >
              <Video size={16} />
              Open Tasks <ArrowRight size={14} />
            </button>
         </div>
      </div>

      {teams.length === 0 ? (
        <div className={`${glassStyle} rounded-[3rem] p-16 text-center border-dashed border-2 border-white/10 flex flex-col items-center z-10 hover:border-indigo-500/20 group/empty transition-colors`}>
          <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center mb-8 relative">
             <Network size={44} className="text-slate-500 group-hover/empty:text-indigo-400 transition-colors" />
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight mb-4 group-hover/empty:text-indigo-400 transition-colors">No teams yet</h3>
          <p className="text-slate-400 text-[14px] font-medium max-w-md mb-8 leading-relaxed">
            Create your first team to invite collaborators, share assets, and run approval workflows.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            title="Create your first team"
            className="px-8 py-3.5 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-colors active:scale-95 flex items-center gap-3"
          >
            <Plus size={16} /> Create your first team
          </button>
        </div>
      ) : (
        <>
          {/* Swarm Scanner */}
          <div className={`${glassStyle} rounded-[3rem] p-6 flex items-center gap-4 relative z-10 border-white/5`}>
             <div className="flex items-center gap-3 pl-6 pr-2 border-r-2 border-white/5">
                <Target size={20} className="text-indigo-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic whitespace-nowrap hidden md:inline">SCAN_SWARM</span>
             </div>
             <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search teams by name or description…"
                className="flex-1 bg-transparent text-[13px] font-medium text-white focus:outline-none placeholder:text-slate-500 px-3"
             />
             {search && (
                <button type="button" onClick={() => setSearch('')} title="Clear" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/20 transition-colors">
                   <X size={14} />
                </button>
             )}
             <div className="px-4 py-2 rounded-full bg-black/60 border border-white/5 text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap">
                <Database size={12} className="text-indigo-400" /> {filteredTeams.length} / {teams.length}
             </div>
          </div>

          {filteredTeams.length === 0 ? (
            <div className={`${glassStyle} rounded-[2.5rem] p-12 flex flex-col items-center text-center gap-5 z-10 relative`}>
               <Target size={36} className="text-slate-500" />
               <h3 className="text-2xl font-black text-white tracking-tight">No matches</h3>
               <p className="text-[13px] font-medium text-slate-400">Adjust your search or clear it to see all teams.</p>
               <button type="button" onClick={() => setSearch('')} className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-indigo-500/50 transition-colors">
                  Clear search
               </button>
            </div>
          ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 z-10 relative">
          {filteredTeams.map((team, idx) => (
            <motion.div 
              layout 
              key={team._id} 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 1 }}
              whileHover={{ y: -20, scale: 1.02 }}
              className={`${glassStyle} rounded-[6rem] p-16 group relative flex flex-col min-h-[500px] border-white/5 hover:border-indigo-500/40 transition-all duration-300 overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,0.8)]`}
            >
              <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-500 rotate-12 group-hover:rotate-0"><Cpu size={300} /></div>
              
              <div className="flex justify-between items-start mb-12">
                <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:rotate-[360deg] transition-all duration-300 shadow-3xl">
                   <Cpu size={48} className="text-indigo-400 group-hover:text-white transition-colors duration-300" />
                </div>
                {isPrimeOrchestrator(team) && (
                  <div className="px-3 py-1 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full shadow-md flex items-center gap-1.5">
                    <Crown size={10} /> Owner
                  </div>
                )}
              </div>

              <div className="flex-1 mb-8 relative z-10">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-2">Team #{String(idx + 1).padStart(2, '0')}</p>
                <h3 className="text-3xl font-black text-white tracking-tight mb-4 group-hover:text-indigo-400 transition-colors leading-tight line-clamp-2">{team.name}</h3>
                {team.description && (
                  <div className="p-4 bg-black/40 rounded-[1.2rem] border border-white/5 shadow-inner mb-4">
                    <p className="text-[13px] text-slate-300 font-medium leading-relaxed line-clamp-3">
                      {team.description}
                    </p>
                  </div>
                )}
                {(() => {
                  const roleCounts: Record<string, number> = {}
                  team.members.forEach(m => {
                    const r = (m.role || 'operative').toLowerCase()
                    roleCounts[r] = (roleCounts[r] || 0) + 1
                  })
                  const entries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
                  if (entries.length === 0) return null
                  const colorFor = (r: string) =>
                    r.includes('admin') || r.includes('owner') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : r.includes('editor') || r.includes('mod') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : r.includes('view') ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  return (
                    <div className="flex flex-wrap gap-2">
                      {entries.map(([role, count]) => (
                        <span key={role} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border italic ${colorFor(role)}`}>
                          {role} · {count}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="flex items-center justify-between py-6 border-t border-white/5 relative z-10">
                 <div className="flex -space-x-3">
                    {team.members.slice(0, 5).map((m, i) => (
                      <div key={i} title={m.userId?.name} className="w-10 h-10 rounded-full bg-[#050505] border-2 border-white/10 flex items-center justify-center text-[12px] font-bold text-white overflow-hidden ring-4 ring-[#020205] transition-transform hover:z-50 hover:scale-110 relative">
                         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-violet-700/20" />
                         <span className="relative z-10 uppercase">{m.userId?.name?.charAt(0) || '?'}</span>
                      </div>
                    ))}
                    {team.members.length > 5 && (
                      <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white/10 flex items-center justify-center text-[11px] font-bold text-white ring-4 ring-[#020205]">
                         +{team.members.length - 5}
                      </div>
                    )}
                 </div>
                 <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] leading-none">Members</p>
                    <p className="text-2xl font-black text-indigo-400 tabular-nums leading-none tracking-tight">{team.members.length}</p>
                 </div>
              </div>

              <button type="button"
                onClick={() => router.push(`/dashboard/teams/${team._id}`)}
                title="Open team"
                className="w-full py-3.5 bg-white text-black rounded-full text-[13px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-colors shadow-lg active:scale-95 group/act flex items-center justify-center gap-3"
              >
                Open team <ArrowRight size={14} className="group-hover/act:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ))}
        </div>
          )}
        </>
      )}

      {/* Modal: Nexus Initialization */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-[#020205]/95 backdrop-blur-3xl" onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className={`${glassStyle} rounded-[7rem] p-12 max-w-4xl w-full border-white/20 relative overflow-hidden shadow-[0_100px_300px_rgba(0,0,0,1)]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-700"><UserPlus size={400} className="text-white" /></div>
              
              <div className="flex items-center gap-5 mb-10 relative z-10">
                <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-lg">
                  <UserPlus size={26} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">Create a new team</h2>
                  <p className="text-slate-400 text-[12px] font-medium mt-1 leading-none">Invite members after creating.</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <label htmlFor="nexus-designation" className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.3em] leading-none pl-1">Team name</label>
                  <input
                    id="nexus-designation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    title="Team name"
                    className="w-full px-6 py-4 bg-black/60 border-2 border-white/10 rounded-[1.2rem] text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500 shadow-inner"
                    placeholder="e.g. Marketing Crew, Editorial Team" autoFocus
                  />
                </div>
                <div className="space-y-3">
                  <label htmlFor="strategic-directives" className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.3em] leading-none pl-1">Description (optional)</label>
                  <textarea
                    id="strategic-directives"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    title="Description"
                    className="w-full px-6 py-4 bg-black/60 border-2 border-white/10 rounded-[1.2rem] text-base font-medium text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500 shadow-inner min-h-[140px] resize-none"
                    placeholder="What does this team do? Who's in it? What's the goal?"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 justify-end">
                  <button type="button" onClick={() => { setShowCreateModal(false); setName(''); setDescription('') }}
                    title="Cancel"
                    className="px-6 py-3 text-[12px] font-bold text-slate-300 uppercase tracking-[0.2em] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={handleClusterGenesis} disabled={creating || !name.trim()}
                    title="Create team"
                    className="px-9 py-3 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] shadow-lg disabled:opacity-40 hover:bg-indigo-500 hover:text-white transition-colors active:scale-95 flex items-center gap-3 group/init"
                  >
                    {creating ? 'Creating…' : (
                      <>Create team <ArrowRight size={14} className="group-hover/init:translate-x-1 transition-transform" /></>
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
