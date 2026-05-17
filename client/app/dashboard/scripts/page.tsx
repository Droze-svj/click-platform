'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy, Download, Trash2, Check,
  ArrowLeft, FileText, RefreshCw, Clock, Plus, ChevronDown,
  Globe, Radio, Sparkles, X, 
  Zap, Database, BookOpen,
  Type, MessageSquare, Feather, Loader2, Search
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { apiGet, apiPost, apiDelete, api } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

interface Script {
  _id: string; title: string; type: string; topic: string
  wordCount: number; duration?: number; status: string
  createdAt: string; script?: string
}

const SAMPLE_PROMPTS = [
  'MISSION_SUCCESS: GROW_0_TO_10K',
  'OPERATIONAL_FLOW: MORNING_CALIBRATION',
  'FATAL_ERRORS: 3_BEGINNER_MISTAKES',
  'SYSTEM_LAUNCH: BEHIND_THE_SCENES',
  'STACK_INVENTORY: DAILY_AI_TOOLS',
  'POST_MORTEM: STRATEGIC_FAILURE_LOGS',
]

const DEPLOYMENT_PLATFORMS: Record<string, { label: string; icon: any; gradient: string }> = {
  youtube:        { label: 'YouTube',      icon: Radio,         gradient: 'from-red-600/20 to-rose-600/20' },
  podcast:        { label: 'Podcast',      icon: MessageSquare, gradient: 'from-purple-600/20 to-indigo-600/20' },
  'social-media': { label: 'Social Media', icon: Globe,         gradient: 'from-emerald-600/20 to-teal-600/20' },
  blog:           { label: 'Blog',         icon: Feather,       gradient: 'from-amber-600/20 to-orange-600/20' },
  email:          { label: 'Email',        icon: Zap,           gradient: 'from-blue-600/20 to-sky-600/20' },
}

const TONE_OPTIONS = ['Authoritative','Inspiring','Educational','Visionary','Precise','Casual','Strategic']
const DOMAIN_MAP: Record<string, string> = { 'social-media': 'instagram', instagram: 'instagram', tiktok: 'tiktok', linkedin: 'linkedin', twitter: 'twitter' }

export default function ScriptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { state: workflow, completeStage } = useWorkflow()

  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [synthesizing, setSynthesizing] = useState(false)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [latestScriptId, setLatestScriptId] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)

  const [seed, setSeed] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [duration, setDuration] = useState(10)
  const [tone, setTone] = useState('Authoritative')
  const [targetAudience, setTargetAudience] = useState('')
  const [keywords, setKeywords] = useState('')

  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadScripts = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await apiGet('/scripts')
      const data = res?.data ?? (Array.isArray(res) ? res : [])
      setScripts(data)
    } catch {
      showToast('Could not load: SCRIPT_unavailable', 'error')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { if (!user) router.push('/login'); else loadScripts() }, [user, router, loadScripts])

  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seed.trim()) return
    setSynthesizing(true)
    try {
      const options: Record<string, any> = {
        duration: (platform === 'youtube' || platform === 'podcast') ? duration : undefined,
        tone: tone.toLowerCase(),
        targetAudience: targetAudience || workflow.niche || (user as any)?.niche || 'general audience',
        platform: workflow.platform || DOMAIN_MAP[platform] || 'instagram',
      }
      if (keywords.trim()) options.keywords = keywords.split(/[\s,]+/).filter(Boolean).slice(0, 10)

      const res: any = await apiPost('/scripts/generate', { topic: seed.trim(), type: platform, options })
      const data = res?.data || res
      if (data?._id) {
        showToast('✓ SYNTHESIS_COMPLETE: SCRIPT_GENERATED', 'success')
        setLatestScriptId(data._id); await loadScripts(); setShowTerminal(false); setSeed('')
        completeStage('script')
      }
    } catch {
      showToast('SYNTHESIS_FAILURE: GENERATION_ABORTED', 'error')
    } finally { setSynthesizing(false) }
  }

  const handleExportScript = async (id: string) => {
    try {
      const res = await api.get(`/scripts/${id}/export?format=txt`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      Object.assign(document.createElement('a'), { href: url, download: `script-${id}.txt` }).click()
      URL.revokeObjectURL(url)
      showToast('✓ PAYLOAD_EXPORTED', 'success')
    } catch { showToast('EXPORT_ERR: FAILED_TO_DOWNLOAD', 'error') }
  }

  const handleCopyScript = async (s: Script) => {
    let text = s.script
    if (!text) {
      try {
        const res: any = await apiGet(`/scripts/${s._id}`)
        text = (res?.data || res)?.script
      } catch { return }
    }
    if (text) {
      await navigator.clipboard.writeText(text)
      setCopyId(s._id); showToast('✓ CLIPBOARD_SYNCED', 'success')
      setTimeout(() => setCopyId(null), 2000)
    }
  }

  const handleDeleteScript = async (id: string) => {
    setDeleting(true)
    try {
      await apiDelete(`/scripts/${id}`)
      showToast('✓ NODE_DELETED', 'success')
      if (latestScriptId === id) setLatestScriptId(null)
      await loadScripts()
    } catch { showToast('DELETE_ERR: FAILED_TO_REMOVE', 'error') }
    finally { setDeleting(false); setDeleteTargetId(null) }
  }

  const filteredScripts = scripts.filter(s => {
    if (filterPlatform !== 'all' && s.type !== filterPlatform) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (s.topic || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
       <BookOpen size={80} className="text-primary-500 animate-spin mb-12" />
       <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">Syncing Scriptorium...</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1750px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-100 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-8 w-full md:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} 
                title="Back to Dashboard" aria-label="Back to Dashboard"
                className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90 group">
                <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <BookOpen size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] border-2 border-primary-500/20 italic leading-none">
                      Scriptorium Core
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {scripts.length} TOTAL_SCRIPTS
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">Scriptorium</h1>
              </div>
           </div>

           <button type="button" onClick={() => setShowTerminal(!showTerminal)}
             className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.5em] italic shadow-[0_30px_80px_rgba(0,0,0,0.4)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all flex items-center gap-5 active:scale-95 border-none"
           >
             {showTerminal ? <X size={24} /> : <Plus size={24} />}
             {showTerminal ? 'ABORT_SESSION' : 'NEW_SYNTHESIS'}
           </button>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Total Scripts', value: scripts.length, icon: FileText, color: 'text-primary-500 bg-primary-500/10 border-primary-500/20' },
            { label: 'YouTube Strands', value: scripts.filter(s => s.type === 'youtube').length, icon: Radio, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
            { label: 'Social Vectors', value: scripts.filter(s => s.type === 'social-media').length, icon: Globe, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Growth Cycles', value: scripts.filter(s => s.wordCount > 1000).length, icon: Sparkles, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
          ].map((stat, i) => (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={stat.label}
              className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] p-8 shadow-xl flex items-center gap-6 group hover:bg-surface-page transition-all duration-500 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><stat.icon size={120} /></div>
              <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-12 transition-transform ${stat.color}`}>
                <stat.icon size={28} />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic mb-1 leading-none">{stat.label}</p>
                <h4 className="text-4xl font-black text-surface-900 dark:text-white italic leading-none">{stat.value}</h4>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Generator Form */}
        <AnimatePresence>
          {showTerminal && (
            <motion.section initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-surface-card backdrop-blur-3xl border-2 border-primary-500/20 rounded-[4rem] overflow-hidden shadow-[0_100px_200px_rgba(0,0,0,0.5)] group"
            >
              <div className="p-10 border-b-2 border-surface-100 dark:border-surface-800 flex items-center gap-8 bg-primary-500/5">
                <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                  <Sparkles size={32} className="text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-2">Neural Synthesis</h2>
                  <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.5em] italic leading-none">Draft high-converting scripts via Swarm Consensus</p>
                </div>
              </div>

              <form onSubmit={handleGenerateScript} className="p-10 lg:p-16 space-y-12">
                <div className="space-y-6">
                  <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Inspiration Vectors</label>
                  <div className="flex flex-wrap gap-4">
                    {SAMPLE_PROMPTS.map(p => (
                      <button type="button" key={p} onClick={() => setSeed(p)}
                        className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 italic transition-all duration-300 ${seed === p ? 'bg-primary-600 text-white border-primary-500 shadow-2xl scale-105' : 'bg-surface-page dark:bg-surface-950 text-surface-500 dark:text-slate-400 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 shadow-inner'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-6 lg:col-span-2">
                      <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Core Thesis / Operational Hook</label>
                      <input type="text" value={seed} onChange={e => setSeed(e.target.value)} required placeholder="INITIALIZE_MISSION_PARAMETERS..."
                        className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] px-10 py-8 text-2xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                      />
                   </div>

                   <div className="space-y-8">
                      <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Output Strata (Platform)</label>
                      <div className="grid grid-cols-2 gap-6">
                         {Object.entries(DEPLOYMENT_PLATFORMS).map(([id, cfg]) => (
                            <button type="button" key={id} onClick={() => setPlatform(id)}
                              className={`flex items-center gap-4 px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 italic transition-all duration-300 ${platform === id ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-transparent shadow-2xl scale-105' : 'bg-surface-page dark:bg-surface-950 border-surface-100 dark:border-surface-800 text-surface-400 dark:text-slate-600 hover:border-primary-500/40 shadow-inner'}`}
                            >
                               <cfg.icon size={20} /> {cfg.label}
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Vocal Signature (Tone)</label>
                        <div className="relative group/sel">
                          <select value={tone} onChange={e => setTone(e.target.value)} aria-label="Vocal tone" title="Vocal tone" className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-8 py-5 text-[10px] font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none appearance-none cursor-pointer shadow-inner backdrop-blur-xl transition-all group-hover/sel:bg-surface-card">
                             {TONE_OPTIONS.map(t => <option key={t} value={t} className="bg-surface-card">{t.toUpperCase()}</option>)}
                          </select>
                          <ChevronDown size={22} className="absolute right-6 top-1/2 -translate-y-1/2 text-surface-400 group-hover/sel:text-primary-500 pointer-events-none transition-colors" />
                        </div>
                      </div>
                      {(platform === 'youtube' || platform === 'podcast') && (
                        <div className="space-y-6">
                          <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Duration (Mins)</label>
                          <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value,10)||1)} min={1} max={60}
                            aria-label="Duration in minutes"
                            title="Duration in minutes"
                            className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-8 py-5 text-sm font-black text-surface-900 dark:text-white italic focus:border-primary-500 outline-none transition-all shadow-inner backdrop-blur-xl"
                          />
                        </div>
                      )}
                   </div>
                </div>

                <div className="flex justify-end pt-12 border-t-2 border-surface-100 dark:border-surface-800">
                   <button type="submit" disabled={synthesizing}
                     className="px-16 py-7 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] text-sm font-black uppercase tracking-[1em] italic shadow-[0_40px_100px_rgba(0,0,0,0.5)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:-translate-y-2 transition-all duration-300 border-none active:scale-95 flex items-center gap-8 group/forge"
                   >
                     {synthesizing ? <RefreshCw className="animate-spin" size={28} /> : <Sparkles size={28} className="group-hover/forge:rotate-12 transition-transform" />}
                     {synthesizing ? 'INITIALIZING_SYNTHESIS...' : 'COMMENCE_SYNTHESIS'}
                   </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Scripts Archive */}
        <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] overflow-hidden shadow-2xl relative group">
           <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><Database size={400} /></div>
           <header className="p-10 border-b-2 border-surface-100 dark:border-surface-800 flex flex-col lg:flex-row items-center gap-10 bg-surface-page/30 relative z-10">
              <div className="relative flex-1 w-full group/search">
                 <Search size={24} className="absolute left-8 top-1/2 -translate-y-1/2 text-surface-300 group-focus-within/search:text-primary-500 transition-colors" />
                 <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH_SCRIPTS_ARCHIVE..."
                   className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.2rem] pl-20 pr-8 py-5 text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:outline-none focus:border-primary-500 transition-all shadow-inner backdrop-blur-xl"
                 />
              </div>
              <div className="flex items-center gap-4 overflow-x-auto pb-4 lg:pb-0 w-full lg:w-auto custom-scrollbar">
                 {['all', ...Object.keys(DEPLOYMENT_PLATFORMS)].map(id => (
                   <button key={id} onClick={() => setFilterPlatform(id)}
                     className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest italic whitespace-nowrap transition-all border-2 ${filterPlatform === id ? 'bg-primary-600 text-white border-transparent shadow-xl scale-110 z-10' : 'bg-surface-page dark:bg-surface-900/50 text-surface-400 hover:text-primary-500 border-surface-100 dark:border-surface-800 shadow-inner'}`}
                   >
                     {id === 'all' ? 'ALL_NODES' : DEPLOYMENT_PLATFORMS[id].label.toUpperCase()}
                   </button>
                 ))}
              </div>
           </header>

           <div className="divide-y-2 divide-surface-100 dark:divide-surface-800/50 relative z-10">
              {filteredScripts.length === 0 ? (
                <div className="py-56 text-center opacity-10 flex flex-col items-center">
                   <FileText size={120} className="mb-10" />
                   <p className="text-3xl font-black uppercase tracking-[1em] italic">NULL_ARCHIVE_MATCH</p>
                </div>
              ) : (
                filteredScripts.map((s, idx) => {
                  const cfg = DEPLOYMENT_PLATFORMS[s.type] || { label: s.type, icon: FileText, gradient: 'from-surface-400 to-surface-600' }
                  return (
                    <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={s._id} className="p-10 group/item flex flex-col sm:flex-row items-start sm:items-center gap-10 hover:bg-primary-500/[0.03] transition-all duration-500">
                       <div className={`w-24 h-24 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-3xl flex items-center justify-center text-surface-300 dark:text-slate-800 group-hover/item:text-primary-500 group-hover/item:border-primary-500/30 group-hover/item:rotate-6 group-hover/item:scale-110 transition-all duration-700 shadow-inner shrink-0 relative overflow-hidden`}>
                          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-0 group-hover/item:opacity-20 transition-opacity duration-700`} />
                          <cfg.icon size={44} className="relative z-10" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-6 mb-4">
                             <h4 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter truncate italic uppercase group-hover/item:text-primary-500 transition-colors duration-500 leading-none">{s.topic || s.title || 'NULL_IDENTIFIER'}</h4>
                             <span className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-surface-page dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 text-surface-400 uppercase tracking-widest italic leading-none">{cfg.label.toUpperCase()}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-10 text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic leading-none">
                             <span className="flex items-center gap-3 hover:text-primary-500 transition-colors"><Type size={18} className="text-primary-500" /> {s.wordCount} WORDS</span>
                             <div className="w-2 h-2 rounded-full bg-surface-100 dark:bg-surface-800" />
                             <span className="flex items-center gap-3 hover:text-primary-500 transition-colors"><Clock size={18} className="text-primary-500" /> {new Date(s.createdAt).toLocaleDateString().toUpperCase()}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 sm:opacity-0 group-hover/item:opacity-100 transition-all duration-500">
                           <button type="button" onClick={() => handleCopyScript(s)} title="Copy Script" aria-label="Copy Script" className="w-16 h-16 rounded-[1.5rem] border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 dark:text-slate-800 hover:text-emerald-500 hover:border-emerald-500/40 transition-all bg-surface-card dark:bg-surface-950 shadow-xl active:scale-90 group/btn border-none">
                             {copyId === s._id ? <Check size={28} className="text-emerald-500 animate-pulse" /> : <Copy size={28} className="group-hover/btn:scale-110 transition-transform" />}
                           </button>
                           <button type="button" onClick={() => handleExportScript(s._id)} title="Export Script" aria-label="Export Script" className="w-16 h-16 rounded-[1.5rem] border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 dark:text-slate-800 hover:text-primary-500 hover:border-primary-500/40 transition-all bg-surface-card dark:bg-surface-950 shadow-xl active:scale-90 group/btn border-none">
                             <Download size={28} className="group-hover/btn:scale-110 transition-transform" />
                           </button>
                           <button type="button" onClick={() => setDeleteTargetId(s._id)} title="Purge Script" aria-label="Purge Script" className="w-16 h-16 rounded-[1.5rem] border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 dark:text-slate-800 hover:text-rose-500 hover:border-rose-500/40 transition-all bg-surface-card dark:bg-surface-950 shadow-xl active:scale-90 group/btn border-none">
                             <Trash2 size={28} className="group-hover/btn:scale-110 transition-transform" />
                           </button>
                          <Link href={`/dashboard/scripts/${s._id}`} className="px-12 py-5 bg-surface-900 dark:bg-white text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.8em] italic shadow-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:-translate-y-2 transition-all ml-6 active:scale-95 text-center">
                             OPEN_NODE
                          </Link>
                       </div>
                    </motion.div>
                  )
                })
              )}
           </div>
        </div>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
           {deleteTargetId && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-surface-950/90 backdrop-blur-[50px]">
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} transition={{ type: 'spring', damping: 25 }} className="bg-surface-card rounded-[4rem] p-16 max-w-2xl w-full border-2 border-rose-500/20 shadow-[0_50px_150px_rgba(0,0,0,0.8)] text-center group/modal">
                   <div className="w-24 h-24 bg-rose-500/10 border-2 border-rose-500/20 rounded-[2rem] flex items-center justify-center mb-12 mx-auto shadow-2xl group-hover/modal:rotate-12 transition-transform">
                      <Trash2 size={48} className="text-rose-500" />
                   </div>
                   <h3 className="text-5xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase mb-6 leading-none">Purge Node?</h3>
                   <p className="text-sm font-bold text-surface-500 dark:text-slate-400 mb-16 italic uppercase tracking-tight leading-relaxed px-10">This will permanently de-index the script from the neural collective. This action is irreversible and final.</p>
                   <div className="flex gap-8">
                      <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-6 rounded-[2rem] bg-surface-page dark:bg-surface-950 text-surface-400 dark:text-slate-600 font-black uppercase text-[12px] tracking-[0.6em] italic border-2 border-surface-100 dark:border-surface-800 active:scale-95 transition-all shadow-inner">ABORT_PURGE</button>
                      <button onClick={() => handleDeleteScript(deleteTargetId)} disabled={deleting} className="flex-1 py-6 rounded-[2rem] bg-rose-600 text-white font-black uppercase text-[12px] tracking-[1em] italic shadow-[0_20px_50px_rgba(244,63,94,0.4)] border-none active:scale-95 transition-all hover:bg-rose-500 flex items-center justify-center gap-4">
                        {deleting ? <RefreshCw className="animate-spin" size={24} /> : 'COMMIT_PURGE'}
                      </button>
                   </div>
                </motion.div>
             </motion.div>
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
