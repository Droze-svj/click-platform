'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Share2,
  Trash2,
  ChevronDown,
  Users,
  Shield,
  Activity,
  Layers,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../lib/api'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'

interface TeamMember {
  userId: { _id: string; name: string; email: string }
  role: string
  joinedAt: string
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canApprove: boolean
  }
}

interface Team {
  _id: string
  name: string
  description: string
  ownerId: { _id: string; name: string; email: string }
  members: TeamMember[]
  settings: { allowMemberInvites: boolean; requireApproval: boolean }
  createdAt: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

export default function TeamDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const teamId = params.teamId as string

  const loadTeam = useCallback(async () => {
    try {
      const res = await apiGet(`/teams/${teamId}`)
      const data = extractApiData<Team>(res as any) ?? (res as any)?.data
      setTeam(data || null)
    } catch {
      showToast('Failed to load team', 'error')
      router.push('/dashboard/teams')
    } finally {
      setLoading(false)
    }
  }, [teamId, router, showToast])

  useEffect(() => {
    if (teamId) loadTeam()
  }, [teamId, loadTeam])

  const canManage = team && (() => {
    const uid = (user as any)?.id || (user as any)?._id
    const m = team.members.find((x) => (x.userId as any)?._id === uid)
    return m?.role === 'owner' || m?.role === 'admin'
  })()

  const isOwner = (m: TeamMember) => m.role === 'owner'
  const ownerId = (t: Team) => (t.ownerId as any)?._id

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      showToast('Enter an email address', 'error')
      return
    }
    setInviting(true)
    try {
      await apiPost(`/teams/${teamId}/invite-by-email`, { email, role: inviteRole })
      showToast('Invite sent', 'success')
      setInviteEmail('')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Invite failed', 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    setUpdatingRole(memberId)
    try {
      await apiPut(`/teams/${teamId}/members/${memberId}/role`, { role })
      showToast('Role updated', 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Update failed', 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the team?')) return
    setRemoving(memberId)
    try {
      await apiDelete(`/teams/${teamId}/members/${memberId}`)
      showToast('Member removed', 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Remove failed', 'error')
    } finally {
      setRemoving(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const c: Record<string, string> = {
      owner: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
      admin: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
      editor: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
      viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    }
    return c[role] || c.viewer
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020205] gap-8">
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
           <RefreshCw size={80} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Synchronizing Swarm Node...</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020205] p-12 text-center">
        <div className="w-48 h-48 rounded-[3rem] bg-white/[0.02] border-2 border-white/5 flex items-center justify-center mb-10 shadow-3xl">
           <Users size={80} className="text-rose-500/40" />
        </div>
        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-6">SWARM_CLUSTER_ABSENT</h2>
        <p className="text-slate-1000 text-[14px] font-black uppercase tracking-[0.4em] mb-12 italic">The requested swarm cluster is not registered in the neural lattice.</p>
        <button onClick={() => router.push('/dashboard/teams')} className="px-10 py-5 bg-white text-black rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all italic">REVERT_TO_COLLECTIVE</button>
      </div>
    )
  }

  const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[20px_40px_100px_rgba(0,0,0,0.8)] transition-all duration-700 hover:bg-white/[0.04]'

  return (
    <div className="min-h-screen bg-[#020205] text-white selection:bg-indigo-500 selection:text-white relative overflow-hidden pb-48">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
         <Users size={800} className="text-white absolute -top-40 -right-40 -rotate-12" />
      </div>

      <div className="max-w-[1200px] mx-auto px-10 py-24 space-y-16 relative z-10">
        <button
          onClick={() => router.push('/dashboard/teams')}
          title="Return to Swarm Matrix"
          className="inline-flex items-center gap-4 text-slate-1000 hover:text-indigo-400 transition-all text-[12px] font-black uppercase tracking-[0.6em] italic"
        >
          <ArrowLeft className="w-5 h-5" />
          BACK_TO_COLLECTIVE
        </button>

        <div className="flex flex-col lg:flex-row justify-between items-start gap-12 border-b-2 border-white/5 pb-16">
          <div className="space-y-6">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                   <Layers size={16} className="text-indigo-400" />
                   <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Swarm Cluster v12.4</span>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 tracking-widest uppercase italic leading-none">ACTIVE_NODE</div>
             </div>
             <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{team.name.toUpperCase()}</h1>
             {team.description && (
               <p className="text-[18px] font-black text-slate-1000 uppercase tracking-widest italic leading-relaxed max-w-2xl opacity-60">{team.description.toUpperCase()}</p>
             )}
             <div className="flex flex-wrap gap-10 text-[12px] font-black text-slate-1000 uppercase tracking-[0.4em] italic leading-none opacity-40 pt-4">
               <span className="flex items-center gap-3"><Shield size={16} className="text-indigo-400" /> ARCHITECT: {team.ownerId?.name?.toUpperCase()}</span>
               <span className="flex items-center gap-3"><Users size={16} className="text-indigo-400" /> {team.members.length} NEURAL_UNITS</span>
               <span className="flex items-center gap-3"><Activity size={16} className="text-indigo-400" /> UPTIME: {new Date(team.createdAt).toLocaleDateString().toUpperCase()}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
           <div className="lg:col-span-8 space-y-12">
              {/* Members Matrix */}
              <div className={`${glassStyle} rounded-[4rem] overflow-hidden`}>
                <div className="px-12 py-10 border-b-2 border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <Users className="w-6 h-6 text-indigo-400" />
                     <h2 className="text-[18px] font-black text-white uppercase tracking-[0.4em] italic">CLUSTER_MEMBERS</h2>
                  </div>
                  <div className="text-[11px] font-black text-slate-1000 uppercase tracking-widest italic opacity-40">{team.members.length} UNITS_SYNCED</div>
                </div>
                <div className="divide-y-2 divide-white/5">
                  {team.members.map((m) => (
                    <div
                      key={(m.userId as any)?._id}
                      className="px-12 py-10 flex flex-wrap items-center justify-between gap-8 hover:bg-white/[0.02] transition-colors group"
                    >
                      <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-[2rem] bg-white/[0.05] border-2 border-white/10 flex items-center justify-center text-xl font-black text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-xl italic">
                          {(m.userId?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[20px] font-black text-white italic uppercase tracking-tighter leading-tight">{m.userId?.name}</p>
                          <p className="text-[12px] font-black text-slate-1000 uppercase tracking-widest italic opacity-60 mb-2">{m.userId?.email}</p>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic opacity-40">
                            INITIALIZED: {new Date(m.joinedAt).toLocaleDateString().toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {isOwner(m) ? (
                          <div className="px-6 py-2 rounded-full bg-amber-500/10 border-2 border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest italic flex items-center gap-3">
                            <Shield className="w-4 h-4" />
                            CORE_OWNER
                          </div>
                        ) : canManage ? (
                          <div className="flex items-center gap-4">
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole((m.userId as any)._id, e.target.value)}
                              disabled={!!updatingRole}
                              title="Assign Component Role"
                              className="px-6 py-2.5 bg-black/60 border-2 border-white/5 rounded-2xl text-[11px] font-black text-slate-300 uppercase tracking-widest italic focus:border-indigo-500 transition-all custom-scrollbar"
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value} className="bg-[#020205]">
                                  {r.label.toUpperCase()}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleRemoveMember((m.userId as any)._id)}
                              disabled={!!removing}
                              className="w-12 h-12 flex items-center justify-center text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/5 rounded-2xl transition-all border-2 border-transparent hover:border-rose-500/20"
                              title="Terminate Node Connection"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <div className={`px-6 py-2 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest italic`}>
                            {m.role.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advanced Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6">
                 <div className={`${glassStyle} rounded-[4rem] p-12 space-y-8`}>
                    <div className="flex items-center gap-6">
                       <Share2 className="w-6 h-6 text-indigo-400" />
                       <h3 className="text-[18px] font-black text-white uppercase tracking-[0.4em] italic">LATTICE_INTEGRATION</h3>
                    </div>
                    <p className="text-[13px] font-black text-slate-1000 uppercase tracking-widest italic opacity-60 leading-relaxed">Cross-link modular components with this cluster to synchronize narrative and kinetic assets.</p>
                    <button
                      onClick={() => router.push('/dashboard/content')}
                      className="w-full py-5 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.6em] transition-all italic active:scale-95 shadow-2xl"
                    >
                      INTEGRATE_ASSETS
                    </button>
                 </div>
                 <div className={`${glassStyle} rounded-[4rem] p-12 space-y-8`}>
                    <div className="flex items-center gap-6">
                       <Zap className="w-6 h-6 text-indigo-400" />
                       <h3 className="text-[18px] font-black text-white uppercase tracking-[0.4em] italic">SWARM_TELEMETRY</h3>
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between px-6 py-4 rounded-3xl bg-black/40 border border-white/5">
                          <span className="text-[10px] font-black text-slate-1000 uppercase tracking-widest italic opacity-60">ID_DNA_REGISTRY</span>
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">VERIFIED</span>
                       </div>
                       <div className="flex items-center justify-between px-6 py-4 rounded-3xl bg-black/40 border border-white/5">
                          <span className="text-[10px] font-black text-slate-1000 uppercase tracking-widest italic opacity-60">NEURAL_SYNC_RATE</span>
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">99.8%</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-4 space-y-12">
              {/* Invite Node */}
              {canManage && (
                <div className={`${glassStyle} rounded-[4rem] p-12 space-y-10 shadow-[20px_40px_100px_rgba(0,0,0,0.8)] border-indigo-500/20`}>
                   <div className="flex items-center gap-6">
                      <UserPlus className="w-6 h-6 text-indigo-400" />
                      <h2 className="text-[20px] font-black text-white italic uppercase tracking-tighter">NODE_INDUCTION</h2>
                   </div>
                   <p className="text-[13px] font-black text-slate-1000 uppercase tracking-widest italic opacity-60 leading-relaxed">
                     Inject a new unit into the cluster by specifying their neural coordinate (email).
                   </p>
                   <div className="space-y-6">
                      <div className="relative group/input">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-1000 group-focus-within/input:text-indigo-400 transition-colors" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="NEURAL_COORDINATE (EMAIL)"
                          title="Enter induction email"
                          className="w-full pl-16 pr-8 py-5 bg-black/60 border-2 border-white/5 rounded-3xl text-[12px] font-black text-indigo-200 uppercase tracking-[0.2em] italic placeholder:text-slate-950 focus:border-indigo-500/50 transition-all shadow-inner"
                        />
                      </div>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        title="Select induction role"
                        className="w-full px-8 py-5 bg-black/60 border-2 border-white/5 rounded-3xl text-[12px] font-black text-slate-300 uppercase tracking-[0.2em] italic focus:border-indigo-500 transition-all custom-scrollbar"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value} className="bg-[#020205]">
                            {r.label.toUpperCase()}_PROTOCOL
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleInviteByEmail}
                        disabled={inviting}
                        className="w-full py-6 bg-indigo-500 text-white hover:bg-white hover:text-black rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.8em] transition-all italic active:scale-95 shadow-[0_20px_60px_rgba(99,102,241,0.3)] disabled:opacity-50"
                      >
                        {inviting ? 'INITIATING...' : 'INDUCT_UNIT'}
                      </button>
                   </div>
                </div>
              )}

              {/* Cluster Settings */}
              <div className={`${glassStyle} rounded-[5rem] overflow-hidden`}>
                <div className="px-10 py-8 border-b-2 border-white/5">
                   <h2 className="text-[16px] font-black text-white uppercase tracking-[0.4em] italic">CLUSTER_INTEGRITY</h2>
                </div>
                <div className="p-10 space-y-8">
                  <div className="flex items-center justify-between p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                    <div>
                      <p className="text-[12px] font-black text-white uppercase tracking-widest italic mb-1">UNIT_AUTONOMY</p>
                      <p className="text-[9px] font-black text-slate-1000 uppercase tracking-widest italic opacity-40">AUTO_INDUCTION_PERMIT</p>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1.5 transition-colors duration-500 ${team.settings?.allowMemberInvites ? 'bg-indigo-500' : 'bg-white/10'}`}>
                       <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-500 shadow-xl ${team.settings?.allowMemberInvites ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                    <div>
                      <p className="text-[12px] font-black text-white uppercase tracking-widest italic mb-1">CONSENSUS_PROTOCOL</p>
                      <p className="text-[9px] font-black text-slate-1000 uppercase tracking-widest italic opacity-40">MANDATORY_VALIDATION</p>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1.5 transition-colors duration-500 ${team.settings?.requireApproval ? 'bg-indigo-500' : 'bg-white/10'}`}>
                       <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-500 shadow-xl ${team.settings?.requireApproval ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 20px; border: 2px solid rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
      `}</style>
    </div>
  )
}
