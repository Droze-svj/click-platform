'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes, Plus, ArrowLeft, ArrowRight, Crown, Activity, Users,
  Check, X, RefreshCw, Layers, Database, Globe, Sparkles
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

interface Workspace {
  id: string
  name: string
  handle: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  members: number
  plan: string
  niche: string
  color: string
  active: boolean
}

const STORAGE_KEY = 'click:active-workspace'

function seedWorkspaces(userName?: string): Workspace[] {
  const initial = (userName || 'Creator').charAt(0).toUpperCase()
  return [
    { id: 'primary', name: `${userName || 'Creator'}'s Studio`, handle: `@${(userName || 'creator').toLowerCase()}`, role: 'owner',  members: 1, plan: 'Pro',     niche: 'Personal Brand',     color: 'from-indigo-500 to-violet-700', active: true },
    { id: 'demo-2',  name: 'Atlas Lifestyle',                   handle: '@atlas-lifestyle',                          role: 'admin',  members: 4, plan: 'Pro',     niche: 'Health & Wellness',  color: 'from-emerald-500 to-teal-700',  active: false },
    { id: 'demo-3',  name: 'Nexus Finance',                     handle: '@nexus-finance',                            role: 'editor', members: 7, plan: 'Agency',  niche: 'Finance Education',  color: 'from-amber-500 to-rose-600',    active: false },
  ]
}

const ROLE_CFG: Record<string, { label: string; color: string }> = {
  owner:  { label: 'OWNER',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  admin:  { label: 'ADMIN',  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  editor: { label: 'EDITOR', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  viewer: { label: 'VIEWER', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.6)] transition-all duration-300'

export default function WorkspacesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNiche, setNewNiche] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    const seeded = seedWorkspaces(user?.name)
    let activeId: string | null = null
    try { activeId = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null } catch { activeId = null }
    setWorkspaces(seeded.map(w => ({ ...w, active: activeId ? w.id === activeId : w.active })))
  }, [user, authLoading, router])

  const activeWs = useMemo(() => workspaces.find(w => w.active) || workspaces[0], [workspaces])

  const handleSwitch = (id: string) => {
    setWorkspaces(prev => prev.map(w => ({ ...w, active: w.id === id })))
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch {}
    const target = workspaces.find(w => w.id === id)
    showToast(`✓ SWITCHED → ${(target?.name || 'WORKSPACE').toUpperCase()}`, 'success')
  }

  const handleCreate = async () => {
    if (!newName.trim()) { showToast('NAME_REQUIRED', 'error'); return }
    setCreating(true)
    await new Promise(r => setTimeout(r, 600))
    const id = `ws-${Date.now()}`
    const newWs: Workspace = {
      id,
      name: newName.trim(),
      handle: `@${newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
      role: 'owner',
      members: 1,
      plan: user?.subscription?.plan || 'Pro',
      niche: newNiche.trim() || 'General',
      color: 'from-rose-500 to-fuchsia-700',
      active: false,
    }
    setWorkspaces(prev => [...prev, newWs])
    setShowCreate(false); setNewName(''); setNewNiche('')
    setCreating(false)
    showToast(`✓ WORKSPACE_INITIALIZED: ${newWs.name.toUpperCase()}`, 'success')
  }

  if (authLoading || !user) return null

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1500px] mx-auto space-y-16 bg-[#020205]">
        <ToastContainer />

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back" className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:border-rose-500/50">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-violet-500/10 border-2 border-violet-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl">
              <Boxes size={40} className="text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-violet-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-violet-400 italic leading-none">Multi-Brand Lattice</span>
              </div>
              <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Workspaces</h1>
              <p className="text-slate-500 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">Switch between sovereign brand instances. Each carries isolated assets, schedules, and analytics.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="px-12 py-6 bg-white text-black rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] italic flex items-center gap-5 hover:bg-violet-500 hover:text-white transition-colors">
            <Plus size={22} /> SPAWN_WORKSPACE
          </button>
        </div>

        {/* Active Workspace Banner */}
        {activeWs && (
          <div className={`${glassStyle} rounded-[3rem] p-10 border-violet-500/20 relative overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${activeWs.color} opacity-[0.05] pointer-events-none`} />
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
              <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br ${activeWs.color} flex items-center justify-center text-white font-black text-5xl italic shadow-[0_30px_80px_rgba(0,0,0,0.4)] flex-shrink-0`}>
                {activeWs.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-center lg:text-left">
                <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.5em] italic mb-2 leading-none">ACTIVE_INSTANCE</p>
                <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-tight mb-3 truncate">{activeWs.name}</h2>
                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic">{activeWs.handle}</span>
                  <span className="opacity-30 text-slate-500">·</span>
                  <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.4em] italic ${ROLE_CFG[activeWs.role].color}`}>{ROLE_CFG[activeWs.role].label}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] italic flex items-center gap-2"><Users size={11} /> {activeWs.members}</span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-[0.4em] italic flex items-center gap-2"><Crown size={11} /> {activeWs.plan}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Workspaces', value: workspaces.length, icon: Layers, color: 'text-white' },
            { label: 'Owned',            value: workspaces.filter(w => w.role === 'owner').length, icon: Crown, color: 'text-amber-400' },
            { label: 'Joined',           value: workspaces.filter(w => w.role !== 'owner').length, icon: Users, color: 'text-indigo-400' },
            { label: 'Total Members',    value: workspaces.reduce((s, w) => s + w.members, 0), icon: Database, color: 'text-violet-400' },
          ].map(s => (
            <div key={s.label} className={`${glassStyle} rounded-[2.5rem] p-8 flex items-center gap-6`}>
              <div className="w-14 h-14 rounded-[1.4rem] bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <s.icon size={26} className={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mb-1 leading-none">{s.label}</p>
                <p className={`text-4xl font-black italic tabular-nums tracking-tighter leading-none ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Workspace Grid */}
        <div>
          <div className="flex items-center gap-5 mb-8">
            <div className="w-12 h-12 rounded-[1.2rem] bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <Globe size={22} className="text-slate-400" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">All Instances</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-2 leading-none">CLICK_TO_SWITCH_CONTEXT</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {workspaces.map(ws => (
              <motion.button
                key={ws.id}
                type="button"
                whileHover={{ y: -6 }}
                onClick={() => handleSwitch(ws.id)}
                className={`${glassStyle} rounded-[2.5rem] p-7 flex flex-col gap-5 text-left relative overflow-hidden ${ws.active ? 'border-violet-500/40 ring-2 ring-violet-500/20 shadow-[0_0_80px_rgba(139,92,246,0.15)]' : 'hover:border-white/20'}`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${ws.color} opacity-[0.06] blur-2xl pointer-events-none`} />
                <div className="flex items-start justify-between relative z-10">
                  <div className={`w-14 h-14 rounded-[1.4rem] bg-gradient-to-br ${ws.color} flex items-center justify-center text-white font-black text-2xl italic shadow-xl`}>
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  {ws.active && <span className="px-2.5 py-1 rounded-full bg-violet-500 text-white text-[8px] font-black uppercase tracking-[0.4em] italic flex items-center gap-1.5"><Check size={10} /> ACTIVE</span>}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className="text-2xl font-black text-white italic uppercase tracking-tight leading-tight mb-1.5 truncate">{ws.name}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mb-3 truncate">{ws.handle}</p>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{ws.niche}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap relative z-10">
                  <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.3em] italic ${ROLE_CFG[ws.role].color}`}>{ROLE_CFG[ws.role].label}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[9px] font-black uppercase tracking-[0.3em] italic flex items-center gap-1.5"><Users size={10} /> {ws.members}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[9px] font-black uppercase tracking-[0.3em] italic">{ws.plan}</span>
                </div>
              </motion.button>
            ))}
            <button type="button" onClick={() => setShowCreate(true)} className={`${glassStyle} rounded-[2.5rem] p-7 flex flex-col items-center justify-center gap-4 text-center border-dashed border-2 border-white/10 hover:border-violet-500/40 hover:bg-violet-500/[0.02] min-h-[280px]`}>
              <div className="w-16 h-16 rounded-[1.4rem] bg-violet-500/10 border-2 border-violet-500/20 flex items-center justify-center text-violet-400">
                <Plus size={28} />
              </div>
              <p className="text-xl font-black text-white italic uppercase tracking-tight">Spawn Instance</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic max-w-[200px] leading-relaxed">Initialize a new sovereign workspace.</p>
            </button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-[#020205]/90 backdrop-blur-2xl" onClick={() => !creating && setShowCreate(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }} transition={{ type: 'spring', damping: 22, stiffness: 240 }} onClick={e => e.stopPropagation()} className={`${glassStyle} rounded-[3rem] p-12 max-w-2xl w-full border-violet-500/20`}>
              <div className="flex items-center gap-6 mb-10">
                <div className="w-14 h-14 rounded-[1.4rem] bg-violet-500/10 border-2 border-violet-500/30 flex items-center justify-center"><Sparkles size={26} className="text-violet-400" /></div>
                <div>
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.5em] italic mb-2 leading-none">SPAWN_PROTOCOL</p>
                  <h3 className="text-3xl font-black text-white italic uppercase tracking-tight leading-tight">New Workspace</h3>
                </div>
              </div>
              <div className="space-y-6 mb-10">
                <div className="space-y-3">
                  <label htmlFor="ws-name" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic block">Brand Designation</label>
                  <input id="ws-name" autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="ATLAS_FITNESS" className="w-full bg-black/60 border-2 border-white/5 rounded-[1.5rem] px-6 py-4 text-xl font-black text-white uppercase tracking-tight italic focus:outline-none focus:border-violet-500/50 placeholder:text-slate-600" />
                </div>
                <div className="space-y-3">
                  <label htmlFor="ws-niche" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic block">Niche / Vertical (optional)</label>
                  <input id="ws-niche" value={newNiche} onChange={e => setNewNiche(e.target.value)} placeholder="HEALTH_AND_WELLNESS" className="w-full bg-black/60 border-2 border-white/5 rounded-[1.5rem] px-6 py-4 text-base font-black text-white uppercase tracking-tight italic focus:outline-none focus:border-violet-500/50 placeholder:text-slate-600" />
                </div>
              </div>
              <div className="flex items-center gap-4 justify-end">
                <button type="button" disabled={creating} onClick={() => { setShowCreate(false); setNewName(''); setNewNiche('') }} className="px-7 py-3 bg-white/5 border-2 border-white/10 text-slate-300 rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:text-white hover:bg-white/10 italic disabled:opacity-40">CANCEL</button>
                <button type="button" disabled={creating || !newName.trim()} onClick={handleCreate} className="px-9 py-3 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:bg-violet-500 hover:text-white italic disabled:opacity-40 flex items-center gap-3 transition-colors">
                  {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'SPAWNING...' : 'INITIALIZE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  )
}
