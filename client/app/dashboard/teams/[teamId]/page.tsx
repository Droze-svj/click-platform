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
  Monitor,
  Database,
  ArrowRight,
  CheckCircle,
  MoreVertical,
  Fingerprint
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../lib/api'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()
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
      showToast(t('teamDetailPage.toastLoadFailed'), 'error')
      router.push('/dashboard/teams')
    } finally {
      setLoading(false)
    }
  }, [teamId, router, showToast, t])

  useEffect(() => {
    if (teamId) loadTeam()
  }, [teamId, loadTeam])

  const canManage = team && (() => {
    const uid = (user as any)?.id || (user as any)?._id
    const m = team.members.find((x) => (x.userId as any)?._id === uid)
    return m?.role === 'owner' || m?.role === 'admin'
  })()

  const isOwner = (m: TeamMember) => m.role === 'owner'

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      showToast(t('teamDetailPage.toastEmailRequired'), 'warning')
      return
    }
    setInviting(true)
    try {
      await apiPost(`/teams/${teamId}/invite-by-email`, { email, role: inviteRole })
      showToast(t('teamDetailPage.toastInviteSent'), 'success')
      setInviteEmail('')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastInviteFailed'), 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    setUpdatingRole(memberId)
    try {
      await apiPut(`/teams/${teamId}/members/${memberId}/role`, { role })
      showToast(t('teamDetailPage.toastRoleUpdated'), 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastRoleFailed'), 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm(t('teamDetailPage.confirmRemoveMember'))) return
    setRemoving(memberId)
    try {
      await apiDelete(`/teams/${teamId}/members/${memberId}`)
      showToast(t('teamDetailPage.toastMemberRemoved'), 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastRemoveFailed'), 'error')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page transition-colors duration-500">
        <RefreshCw size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic">{t('teamDetailPage.loading')}</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page p-12 text-center transition-colors duration-500">
        <div className="w-48 h-48 rounded-[3.5rem] bg-surface-card border-4 border-dashed border-surface-200 dark:border-surface-800 flex items-center justify-center mb-12 shadow-2xl">
           <Users size={80} className="text-surface-200 dark:text-slate-800" />
        </div>
        <h2 className="text-5xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter mb-6">{t('teamDetailPage.notFoundTitle')}</h2>
        <p className="text-surface-500 dark:text-slate-600 text-sm font-black uppercase tracking-[0.5em] mb-12 italic leading-relaxed max-w-md">{t('teamDetailPage.notFoundDescription')}</p>
        <button type="button" onClick={() => router.push('/dashboard/teams')} className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2rem] text-[11px] font-black uppercase tracking-[0.6em] hover:bg-primary-500 hover:text-white transition-all shadow-2xl italic active:scale-95 border-none">{t('teamDetailPage.revertToCollective')}</button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard/teams')} aria-label={t('teamDetailPage.backToTeams')} title={t('teamDetailPage.backToTeams')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                 <Users size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('teamDetailPage.collectiveNode')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {t('teamDetailPage.syncedOnline')}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{team.name}</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full md:w-auto">
              <div className="flex items-center gap-3 px-6 py-3 bg-surface-card border-2 border-surface-100 dark:border-surface-800 rounded-2xl text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic shadow-inner">
                 <Activity size={16} className="text-primary-500" /> {t('teamDetailPage.uptimeLabel', { date: new Date(team.createdAt).toLocaleDateString().toUpperCase() })}
              </div>
              <button type="button" onClick={() => loadTeam()} aria-label={t('teamDetailPage.refreshTeamData')} title={t('teamDetailPage.refreshTeamData')} className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90">
                 <RefreshCw size={28} />
              </button>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
           {/* Members Matrix Section */}
           <main className="lg:col-span-8 space-y-12">
              <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] overflow-hidden shadow-2xl transition-all duration-500 group hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
                 <div className="px-10 sm:px-14 py-12 border-b-2 border-surface-100 dark:border-surface-800 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-lg group-hover:rotate-12 transition-all">
                          <Fingerprint size={28} />
                       </div>
                       <div>
                          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-1">{t('teamDetailPage.membersMatrix')}</h2>
                          <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.5em] italic leading-none">{t('teamDetailPage.neuralUnitRegistry')}</p>
                       </div>
                    </div>
                    <div className="px-5 py-2 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-xl text-[11px] font-black text-primary-500 uppercase tracking-widest tabular-nums italic shadow-inner">
                       {t('teamDetailPage.unitsSynced', { count: team.members.length })}
                    </div>
                 </div>

                 <div className="divide-y-2 divide-surface-100 dark:divide-surface-800/50">
                    {team.members.map((m) => (
                      <div key={(m.userId as any)?._id} className="px-10 sm:px-14 py-10 flex flex-wrap items-center justify-between gap-10 hover:bg-surface-page/50 dark:hover:bg-white/[0.01] transition-all duration-500 group/member">
                        <div className="flex items-center gap-8">
                           <div className="w-20 h-20 rounded-[2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-2xl font-black text-primary-500 group-hover/member:bg-primary-500 group-hover/member:text-white group-hover/member:rotate-12 transition-all duration-500 shadow-inner group-hover/member:shadow-primary-500/30 italic">
                             {(m.userId?.name || '?').charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <p className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-tight mb-2 group-hover/member:text-primary-500 transition-colors">{m.userId?.name}</p>
                              <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.3em] italic mb-3 leading-none">{m.userId?.email}</p>
                              <div className="flex items-center gap-3">
                                 <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic border-r-2 border-surface-100 dark:border-surface-800 pr-3 leading-none">{t('teamDetailPage.initializedLabel', { date: new Date(m.joinedAt).toLocaleDateString().toUpperCase() })}</span>
                                 <div className="flex items-center gap-2 text-[9px] font-black text-primary-500 uppercase tracking-widest italic leading-none">
                                    <Activity size={10} className="group-hover/member:animate-pulse" /> {t('teamDetailPage.syncedReady')}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-6">
                           {isOwner(m) ? (
                             <div className="px-6 py-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] italic flex items-center gap-4 shadow-sm">
                                <Shield className="w-4 h-4" /> {t('teamDetailPage.coreOwner')}
                             </div>
                           ) : canManage ? (
                             <div className="flex items-center gap-4">
                                <div className="relative group/sel">
                                   <select
                                     value={m.role}
                                     onChange={(e) => handleUpdateRole((m.userId as any)._id, e.target.value)}
                                     disabled={!!updatingRole}
                                     aria-label={t('teamDetailPage.roleForMember', { name: m.userId?.name || t('teamDetailPage.memberFallback') })}
                                     title={t('teamDetailPage.roleForMember', { name: m.userId?.name || t('teamDetailPage.memberFallback') })}
                                     className="px-8 py-3 bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 rounded-2xl text-[11px] font-black text-surface-600 dark:text-slate-400 uppercase tracking-widest italic focus:border-primary-500/50 focus:text-primary-500 outline-none appearance-none cursor-pointer transition-all shadow-inner group-hover/sel:bg-surface-card"
                                   >
                                     {ROLES.map((r) => (
                                       <option key={r.value} value={r.value} className="bg-surface-card">
                                         {t(`teamDetailPage.role_${r.value}`)}
                                       </option>
                                     ))}
                                   </select>
                                   <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-300 group-hover/sel:text-primary-500 pointer-events-none transition-all" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember((m.userId as any)._id)}
                                  disabled={!!removing}
                                  className="w-12 h-12 flex items-center justify-center text-surface-200 dark:text-slate-800 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border-2 border-transparent hover:border-rose-500/20 active:scale-90"
                                >
                                  {removing === (m.userId as any)._id ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                </button>
                             </div>
                           ) : (
                             <div className="px-6 py-3 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 text-[10px] font-black text-primary-600 dark:text-primary-500 uppercase tracking-[0.4em] italic shadow-sm">
                                {m.role.toUpperCase()}
                             </div>
                           )}
                        </div>
                      </div>
                    ))}
                 </div>
              </section>

              {/* Advanced Controls Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-12 space-y-8 shadow-xl transition-all duration-500 hover:border-primary-500/30 group">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 shadow-inner group-hover:rotate-12 transition-transform">
                          <Share2 size={28} />
                       </div>
                       <div>
                          <h3 className="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none mb-1">{t('teamDetailPage.latticeIntegration')}</h3>
                          <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('teamDetailPage.nodeCrossLinking')}</p>
                       </div>
                    </div>
                    <p className="text-sm font-bold text-surface-500 dark:text-slate-600 uppercase tracking-tight italic leading-relaxed">{t('teamDetailPage.latticeIntegrationDesc')}</p>
                    <button type="button" onClick={() => router.push('/dashboard/content')}
                      className="w-full py-5 bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.6em] transition-all italic active:scale-95 shadow-xl border-none"
                    >
                      {t('teamDetailPage.synchronizeAssets')}
                    </button>
                 </section>

                 <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-12 space-y-10 shadow-xl transition-all duration-500 hover:border-primary-500/30 group">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 shadow-inner group-hover:rotate-12 transition-transform">
                          <Zap size={28} />
                       </div>
                       <div>
                          <h3 className="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none mb-1">{t('teamDetailPage.swarmTelemetry')}</h3>
                          <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.4em] italic leading-none">{t('teamDetailPage.realTimeNodeStatus')}</p>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between px-8 py-5 rounded-[1.8rem] bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 shadow-inner group-hover:bg-surface-card transition-all">
                          <span className="text-[10px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic">{t('teamDetailPage.idDnaRegistry')}</span>
                          <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic flex items-center gap-2"><CheckCircle size={14} /> {t('teamDetailPage.verified')}</span>
                       </div>
                       <div className="flex items-center justify-between px-8 py-5 rounded-[1.8rem] bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 shadow-inner group-hover:bg-surface-card transition-all">
                          <span className="text-[10px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic">{t('teamDetailPage.neuralSyncRate')}</span>
                          <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic">{t('teamDetailPage.syncRateOptimal')}</span>
                       </div>
                    </div>
                 </section>
              </div>
           </main>

           {/* Sidebar Section */}
           <aside className="lg:col-span-4 space-y-10">
              {/* Invite Node HUD */}
              {canManage && (
                <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 space-y-12 shadow-2xl transition-all duration-500 hover:shadow-[0_40px_100px_rgba(0,0,0,0.5)] border-primary-500/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><UserPlus size={300} className="text-primary-500" /></div>
                   
                   <div className="flex items-center gap-6 relative z-10">
                      <div className="w-16 h-16 rounded-[1.8rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-xl group-hover:rotate-12 transition-transform">
                         <UserPlus size={32} />
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter leading-none mb-1">{t('teamDetailPage.nodeInduction')}</h2>
                         <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.5em] italic leading-none">{t('teamDetailPage.injectNewUnit')}</p>
                      </div>
                   </div>

                   <p className="text-sm font-bold text-surface-500 dark:text-slate-600 uppercase tracking-tight italic leading-relaxed relative z-10">
                      {t('teamDetailPage.nodeInductionDesc')}
                   </p>

                   <div className="space-y-6 relative z-10">
                      <div className="relative group/input">
                        <Mail className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-300 dark:text-slate-800 group-focus-within/input:text-primary-500 group-focus-within/input:scale-110 transition-all" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder={t('teamDetailPage.emailPlaceholder')}
                          className="w-full pl-16 pr-8 py-6 bg-surface-page dark:bg-surface-950/30 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] text-sm font-black text-surface-900 dark:text-white uppercase tracking-widest italic placeholder:text-surface-200 dark:placeholder:text-slate-800 focus:border-primary-500 outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="relative group/sel">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          aria-label={t('teamDetailPage.inviteRole')}
                          title={t('teamDetailPage.inviteRole')}
                          className="w-full px-8 py-6 bg-surface-page dark:bg-surface-950/30 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] text-[11px] font-black text-surface-600 dark:text-slate-400 uppercase tracking-[0.3em] italic focus:border-primary-500 outline-none appearance-none cursor-pointer transition-all shadow-inner"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value} className="bg-surface-card">
                              {t(`teamDetailPage.roleProtocol_${r.value}`)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={22} className="absolute right-8 top-1/2 -translate-y-1/2 text-surface-300 dark:text-slate-800 group-hover/sel:text-primary-500 pointer-events-none transition-all" />
                      </div>
                      <button
                        type="button"
                        onClick={handleInviteByEmail}
                        disabled={inviting}
                        className="w-full py-7 bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.8em] transition-all italic active:scale-95 shadow-[0_30px_70px_rgba(0,0,0,0.5)] disabled:opacity-10 border-none group/submit"
                      >
                        {inviting ? <RefreshCw className="animate-spin" size={24} /> : t('teamDetailPage.inductUnit')}
                      </button>
                   </div>
                </section>
              )}

              {/* Cluster Integrity HUD */}
              <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] overflow-hidden shadow-2xl transition-all duration-500 group">
                 <div className="px-10 py-10 border-b-2 border-surface-100 dark:border-surface-800 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                       <Shield size={24} className="text-primary-500 group-hover:rotate-12 transition-transform" />
                       <h2 className="text-[16px] font-black text-surface-900 dark:text-white uppercase tracking-[0.4em] italic leading-none">{t('teamDetailPage.clusterIntegrity')}</h2>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                 </div>
                 <div className="p-10 space-y-8">
                   <div className="flex items-center justify-between p-8 rounded-[2.5rem] bg-surface-page dark:bg-surface-950/30 border-2 border-surface-100 dark:border-surface-800 shadow-inner group/toggle hover:border-primary-500/20 transition-all">
                     <div className="flex-1">
                       <p className="text-[12px] font-black text-surface-900 dark:text-white uppercase tracking-[0.2em] italic mb-1">{t('teamDetailPage.unitAutonomy')}</p>
                       <p className="text-[9px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic opacity-60">{t('teamDetailPage.autoInductionPermit')}</p>
                     </div>
                     <div className={`w-16 h-9 rounded-full p-1.5 transition-all duration-500 shadow-lg ${team.settings?.allowMemberInvites ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-900'}`}>
                        <div className={`w-6 h-6 rounded-full bg-white transition-transform duration-500 shadow-md ${team.settings?.allowMemberInvites ? 'translate-x-7' : 'translate-x-0'}`} />
                     </div>
                   </div>
                   <div className="flex items-center justify-between p-8 rounded-[2.5rem] bg-surface-page dark:bg-surface-950/30 border-2 border-surface-100 dark:border-surface-800 shadow-inner group/toggle hover:border-primary-500/20 transition-all">
                     <div className="flex-1">
                       <p className="text-[12px] font-black text-surface-900 dark:text-white uppercase tracking-[0.2em] italic mb-1">{t('teamDetailPage.consensusProtocol')}</p>
                       <p className="text-[9px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic opacity-60">{t('teamDetailPage.mandatoryValidation')}</p>
                     </div>
                     <div className={`w-16 h-9 rounded-full p-1.5 transition-all duration-500 shadow-lg ${team.settings?.requireApproval ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-900'}`}>
                        <div className={`w-6 h-6 rounded-full bg-white transition-transform duration-500 shadow-md ${team.settings?.requireApproval ? 'translate-x-7' : 'translate-x-0'}`} />
                     </div>
                   </div>
                 </div>
                 <div className="px-10 py-8 bg-surface-page dark:bg-surface-950/50 text-center">
                    <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.6em] italic">{t('teamDetailPage.globalSecurityEnabled')}</p>
                 </div>
              </section>

              {/* Node Metadata HUD */}
              <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-10 shadow-2xl space-y-8 group">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <Database className="text-primary-500" size={20} />
                       <span className="text-[11px] font-black text-surface-900 dark:text-white uppercase tracking-[0.4em] italic">{t('teamDetailPage.latticeMetadata')}</span>
                    </div>
                    <MoreVertical size={16} className="text-surface-300 dark:text-slate-800" />
                 </div>
                 <div className="space-y-6">
                    <div className="flex justify-between items-center text-[10px] font-black italic">
                       <span className="text-surface-400 dark:text-slate-600 uppercase tracking-widest">{t('teamDetailPage.clusterId')}</span>
                       <span className="text-surface-900 dark:text-white tabular-nums tracking-tighter truncate max-w-[150px]">{team._id.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black italic">
                       <span className="text-surface-400 dark:text-slate-600 uppercase tracking-widest">{t('teamDetailPage.ownerHash')}</span>
                       <span className="text-surface-900 dark:text-white truncate max-w-[150px]">{team.ownerId?.email?.toUpperCase()}</span>
                    </div>
                 </div>
              </section>
           </aside>
        </div>

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
