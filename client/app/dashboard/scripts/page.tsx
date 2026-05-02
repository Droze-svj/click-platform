'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy, Download, Trash2, Eye, CopyPlus, Sparkles, X, Check,
  ArrowLeft, FileText, RefreshCw, Clock, Hash, Plus, ChevronDown,
  Terminal, Cpu, Activity, Shield, Globe, Target, Radio, Layers,
  Zap, Share2, ArrowRight, Gauge, Database, Network, BookOpen,
  Feather, PenTool, Type, MessageSquare, Fingerprint, Loader2
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
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
  'How I grew from 0 → 10K followers',
  'My morning routine breakdown',
  '3 mistakes beginners make',
  'Behind the scenes of a launch',
  'Tools I use every single day',
  'Lessons from my biggest failure',
]

const DEPLOYMENT_PLATFORMS: Record<string, { label: string; icon: any }> = {
  youtube:        { label: 'YouTube',      icon: Radio },
  podcast:        { label: 'Podcast',      icon: MessageSquare },
  'social-media': { label: 'Social Media', icon: Globe },
  blog:           { label: 'Blog',         icon: Feather },
  email:          { label: 'Email',        icon: Zap },
}

const TONE_OPTIONS = ['authoritative','inspiring','educational','visionary','precise','casual','strategic']
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
  const [tone, setTone] = useState('authoritative')
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
      showToast('Failed to load scripts', 'error')
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
        tone: tone,
        targetAudience: targetAudience || workflow.niche || (user as any)?.niche || 'general audience',
        platform: workflow.platform || DOMAIN_MAP[platform] || 'instagram',
      }
      if (keywords.trim()) options.keywords = keywords.split(/[\s,]+/).filter(Boolean).slice(0, 10)

      const res: any = await apiPost('/scripts/generate', { topic: seed.trim(), type: platform, options })
      const data = res?.data || res
      if (data?._id) {
        showToast('✓ Script generated', 'success')
        setLatestScriptId(data._id); await loadScripts(); setShowTerminal(false); setSeed('')
        completeStage('script')
      }
    } catch {
      showToast('Generation failed', 'error')
    } finally { setSynthesizing(false) }
  }

  const handleExportScript = async (id: string) => {
    try {
      const res = await api.get(`/scripts/${id}/export?format=txt`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      Object.assign(document.createElement('a'), { href: url, download: `script-${id}.txt` }).click()
      URL.revokeObjectURL(url)
      showToast('✓ Exported', 'success')
    } catch { showToast('Export failed', 'error') }
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
      setCopyId(s._id); showToast('✓ Copied to clipboard', 'success')
      setTimeout(() => setCopyId(null), 2000)
    }
  }

  const handleDeleteScript = async (id: string) => {
    setDeleting(true)
    try {
      await apiDelete(`/scripts/${id}`)
      showToast('✓ Deleted', 'success')
      if (latestScriptId === id) setLatestScriptId(null)
      await loadScripts()
    } catch { showToast('Delete failed', 'error') }
    finally { setDeleting(false); setDeleteTargetId(null) }
  }

  const activeScript = latestScriptId ? scripts.find(s => s._id === latestScriptId) : null
  const deleteTarget = deleteTargetId ? scripts.find(s => s._id === deleteTargetId) : null

  const filteredScripts = scripts.filter(s => {
    if (filterPlatform !== 'all' && s.type !== filterPlatform) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (s.topic || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-surface-50 dark:bg-surface-950 min-h-screen gap-6">
      <Loader2 size={40} className="text-primary-500 animate-spin" />
      <div className="space-y-2 text-center">
        <p className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest">Loading scripts...</p>
        <p className="text-xs font-medium text-surface-500 uppercase tracking-widest">Please wait</p>
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10 space-y-10">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => router.push('/dashboard')} 
                title="Return"
                className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <BookOpen size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    Content Management
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Scripts</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium max-w-xl leading-relaxed">
                  Generate, edit, and export AI scripts for every platform — YouTube, podcast, social, blog, email.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTerminal(!showTerminal)}
              className="px-5 py-3 rounded-xl bg-primary-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {showTerminal ? <X size={16} /> : <Sparkles size={16} />}
              {showTerminal ? 'Cancel' : 'New Script'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Scripts', value: scripts.length, icon: Layers },
              { label: 'YouTube',       value: scripts.filter(s => s.type === 'youtube').length, icon: Radio },
              { label: 'Social Media',  value: scripts.filter(s => s.type === 'social-media').length, icon: Globe },
              { label: 'Email',         value: scripts.filter(s => s.type === 'email').length, icon: Zap },
            ].map((s, i) => (
              <motion.div 
                 initial={{ opacity: 0, y: 10 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 transition={{ delay: i * 0.1 }}
                 key={s.label} 
                 className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm"
              >
                 <div className="w-16 h-16 bg-surface-50 dark:bg-surface-950 rounded-2xl flex items-center justify-center mb-6 border border-surface-200 dark:border-surface-800">
                    <s.icon size={28} className="text-surface-600 dark:text-surface-400" />
                 </div>
                 <div className="text-4xl font-black text-surface-900 dark:text-white mb-2">{s.value}</div>
                 <div className="text-xs font-bold text-surface-500 uppercase tracking-wider">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Generator Terminal */}
          <AnimatePresence>
            {showTerminal && (
              <motion.div 
                 initial={{ opacity: 0, height: 0 }} 
                 animate={{ opacity: 1, height: 'auto' }} 
                 exit={{ opacity: 0, height: 0 }} 
                 className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="p-8 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center border border-primary-200 dark:border-primary-800"><Sparkles size={24} className="text-primary-600 dark:text-primary-400" /></div>
                    <div>
                      <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">AI Script Generator</h2>
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mt-1">Configure Generation</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleGenerateScript} className="p-8 space-y-8 bg-surface-50 dark:bg-surface-950">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Target size={16} /> Quick Start Prompts</label>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PROMPTS.map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSeed(q)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${seed === q ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="xl:col-span-2 space-y-4">
                      <label htmlFor="seed-input" className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Terminal size={16} /> Topic</label>
                      <input
                        id="seed-input"
                        type="text"
                        value={seed}
                        onChange={e => setSeed(e.target.value)}
                        required
                        placeholder="What should the script be about?"
                        className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-6 py-4 text-base font-bold text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-shadow"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Radio size={16} /> Platform</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(DEPLOYMENT_PLATFORMS).map(([id, cfg]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPlatform(id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border transition-colors ${platform === id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white shadow-sm' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                            <cfg.icon size={18} />
                            <span>{cfg.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-4">
                          <label className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Activity size={16} /> Tone</label>
                          <div className="flex flex-wrap gap-2">
                            {TONE_OPTIONS.map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTone(t)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${tone === t ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white shadow-sm' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {(platform === 'youtube' || platform === 'podcast') && (
                            <div className="space-y-3">
                              <label htmlFor="duration-input" className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Clock size={14} /> Duration (mins)</label>
                              <input
                                id="duration-input"
                                type="number"
                                value={duration}
                                onChange={e => setDuration(parseInt(e.target.value,10)||10)}
                                min={1} max={120}
                                className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm font-bold text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                              />
                            </div>
                          )}
                          <div className="space-y-3">
                             <label htmlFor="audience-input" className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Target size={14} /> Audience</label>
                             <input
                                id="audience-input"
                                type="text"
                                value={targetAudience}
                                onChange={e => setTargetAudience(e.target.value)}
                                placeholder="e.g. beginners, creators"
                                className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label htmlFor="keywords-input" className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2"><Hash size={14} /> Keywords</label>
                          <input
                             id="keywords-input"
                             type="text"
                             value={keywords}
                             onChange={e => setKeywords(e.target.value)}
                             placeholder="growth, focus (optional)"
                             className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          />
                       </div>
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end">
                     <button
                       type="submit"
                       disabled={synthesizing}
                       className="px-8 py-4 bg-primary-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                     >
                       {synthesizing ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                       {synthesizing ? 'Generating...' : 'Generate Script'}
                     </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Latest Script Banner */}
          <AnimatePresence>
            {activeScript && (
              <motion.div 
                 initial={{ opacity: 0, y: -10 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0, y: -10 }}
                 className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-3xl shadow-sm"
              >
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center justify-center"><Check size={24} /></div>
                   <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Generated Successfully</p>
                      <p className="text-xl font-black text-surface-900 dark:text-white tracking-tight truncate max-w-2xl">{activeScript.title}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button type="button" onClick={() => router.push(`/dashboard/scripts/${activeScript._id}`)}
                    className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                    Open Script
                  </button>
                  <button type="button" title="Dismiss" onClick={() => setLatestScriptId(null)} className="w-12 h-12 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white rounded-xl flex items-center justify-center transition-colors"><X size={18} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scripts List */}
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-8 border-b border-surface-200 dark:border-surface-800 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded-xl flex items-center justify-center"><Database size={24} className="text-surface-600 dark:text-surface-400" /></div>
                 <div>
                    <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-1">Your Scripts</h2>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Browse and manage</p>
                 </div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                 {filteredScripts.length} / {scripts.length} Total
              </div>
            </div>

            {/* Filters */}
            {scripts.length > 0 && (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 p-6 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950">
                 <div className="relative flex-1">
                    <Target size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                       type="text"
                       value={search}
                       onChange={e => setSearch(e.target.value)}
                       placeholder="Search by topic or title..."
                       className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-shadow"
                    />
                    {search && (
                       <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">
                          <X size={16} />
                       </button>
                    )}
                 </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    {[{ id: 'all', label: 'All Platforms' }, ...Object.entries(DEPLOYMENT_PLATFORMS).map(([id, cfg]) => ({ id, label: cfg.label }))].map(opt => (
                       <button
                          type="button"
                          key={opt.id}
                          onClick={() => setFilterPlatform(opt.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${filterPlatform === opt.id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white shadow-sm' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                       >
                          {opt.label}
                       </button>
                    ))}
                 </div>
              </div>
            )}

            <div className="flex flex-col">
              {scripts.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
                     <FileText size={32} className="text-surface-400" />
                  </div>
                  <div>
                     <p className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-2">No scripts yet</p>
                     <p className="text-sm font-medium text-surface-500 max-w-sm mx-auto">Generate your first script using the AI generator above.</p>
                  </div>
                </div>
              ) : filteredScripts.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center gap-4">
                  <Target size={32} className="text-surface-400" />
                  <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight">No matches found</p>
                  <button type="button" onClick={() => { setSearch(''); setFilterPlatform('all') }} className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="divide-y divide-surface-200 dark:divide-surface-800">
                  {filteredScripts.map((s) => {
                    const cfg = DEPLOYMENT_PLATFORMS[s.type] || { label: s.type, icon: FileText }
                    return (
                      <div key={s._id} className="group flex flex-col md:flex-row items-start md:items-center gap-6 p-6 sm:p-8 hover:bg-surface-50 dark:hover:bg-surface-950/50 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400 shrink-0">
                          <cfg.icon size={24} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight truncate mb-1">{s.topic || s.title || 'Untitled script'}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-surface-500 uppercase tracking-wider">
                            <span className="px-2 py-1 bg-surface-100 dark:bg-surface-800 rounded-md text-surface-700 dark:text-surface-300">{cfg.label}</span>
                            <span>•</span>
                            <span>{s.wordCount.toLocaleString()} words</span>
                            {s.duration != null && <><span>•</span><span>{s.duration} min read</span></>}
                            <span>•</span>
                            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 md:mt-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => handleExportScript(s._id)} className="w-10 h-10 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Export">
                            <Download size={16} />
                          </button>
                          <button type="button" onClick={() => handleCopyScript(s)} className="w-10 h-10 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Copy text">
                            {copyId === s._id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                          <button type="button" onClick={() => setDeleteTargetId(s._id)} className="w-10 h-10 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Delete">
                            <Trash2 size={16} />
                          </button>
                          <div className="w-px h-6 bg-surface-200 dark:bg-surface-800 mx-1" />
                          <button type="button" onClick={() => router.push(`/dashboard/scripts/${s._id}`)} className="px-5 py-2.5 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2">
                            Open <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteTargetId(null)}>
            <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               onClick={e => e.stopPropagation()}
               className="bg-white dark:bg-surface-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-surface-200 dark:border-surface-800"
            >
               <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center mb-6">
                  <Trash2 size={24} className="text-rose-600 dark:text-rose-400" />
               </div>
               <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-2">Delete Script?</h3>
               <p className="text-sm font-medium text-surface-500 mb-8">
                  Are you sure you want to delete <span className="font-bold text-surface-900 dark:text-white">{deleteTarget.topic || deleteTarget.title || 'Untitled script'}</span>? This cannot be undone.
               </p>
               <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setDeleteTargetId(null)} disabled={deleting} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                     Cancel
                  </button>
                  <button type="button" onClick={() => handleDeleteScript(deleteTarget._id)} disabled={deleting} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2">
                     {deleting ? <RefreshCw size={14} className="animate-spin" /> : null}
                     {deleting ? 'Deleting...' : 'Delete'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  )
}
