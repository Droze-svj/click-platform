'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Sparkles,
  Zap,
  Cpu,
  UserCircle,
  PenTool,
  BarChart3,
  Copy,
  Check,
  Download,
  Save,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Target,
  Activity,
  Layers,
  Radio,
  ArrowUpRight,
  Film,
  BookOpen,
  Star,
  Search,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiPost } from '../../../lib/api'

interface ScriptGeneratorViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  /** Optional — called to push hook text as a text overlay at the start of the timeline */
  onInsertToTimeline?: (text: string) => void
}

type CopyTarget = 'full' | 'hook' | 'body' | 'cta'

const ROLES = [
  { id: 'expert', label: 'Authoritative Expert', icon: UserCircle, color: 'emerald' },
  { id: 'skeptic', label: 'Provocative Skeptic', icon: Zap, color: 'rose' },
  { id: 'hypeman', label: 'High-Energy Hype-Man', icon: Sparkles, color: 'fuchsia' },
]

const TONES = [
  { id: 'energetic', label: 'Energetic' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'authoritative', label: 'Authoritative' },
  { id: 'humorous', label: 'Humorous' },
]

// ── Viral Hook Library ────────────────────────────────────────────────────────

type HookNiche = 'Finance' | 'Fitness' | 'Relationships' | 'Tech' | 'Food' | 'Mindset'
type HookType = 'Curiosity' | 'Shock' | 'Story' | 'Authority'

interface HookEntry {
  niche: HookNiche
  type: HookType
  text: string
}

const HOOK_LIBRARY: HookEntry[] = [
  // Finance
  { niche: 'Finance', type: 'Shock',     text: 'The average person will never know this one tax hack that saves $12,000 a year.' },
  { niche: 'Finance', type: 'Curiosity', text: 'What if I told you your money is sleeping \u2014 and the bank is making 9% on it while you get 0.5%?' },
  { niche: 'Finance', type: 'Story',     text: 'I went from $0 to $180k net worth in 3 years. Here\'s literally everything I did.' },
  { niche: 'Finance', type: 'Authority', text: 'I analyzed 1,000 millionaires. Here are the 5 habits literally every single one of them shares.' },
  { niche: 'Finance', type: 'Curiosity', text: 'Why does a barista with a Roth IRA beat a Wall Street analyst with a brokerage? The math will shock you.' },
  // Fitness
  { niche: 'Fitness', type: 'Shock',     text: 'You\'ve been doing abs wrong your entire life. Here\'s what actually works.' },
  { niche: 'Fitness', type: 'Story',     text: 'I trained for 6 months and gained 20 lbs of muscle. This is the EXACT protocol.' },
  { niche: 'Fitness', type: 'Curiosity', text: 'What if you could burn 300 extra calories a day just by changing when you eat?' },
  { niche: 'Fitness', type: 'Authority', text: 'I\'ve coached 10,000 athletes. Here\'s the one thing beginner gym-goers always get wrong.' },
  { niche: 'Fitness', type: 'Shock',     text: 'Stop doing cardio first thing in the morning \u2014 science says it\'s actually counterproductive.' },
  // Relationships
  { niche: 'Relationships', type: 'Curiosity', text: 'There\'s one sentence that instantly ends almost any argument. Most couples never learn it.' },
  { niche: 'Relationships', type: 'Story',     text: 'We were on the edge of divorce. Then we tried this one thing \u2014 and everything changed.' },
  { niche: 'Relationships', type: 'Shock',     text: 'The reason 60% of marriages fail has nothing to do with cheating or money. It\'s this.' },
  { niche: 'Relationships', type: 'Authority', text: 'I\'ve studied 500 happy couples. The one thing they all do is shockingly simple.' },
  { niche: 'Relationships', type: 'Curiosity', text: 'What if the person you\'re with right now is great \u2014 but they\'re not right for you?' },
  // Tech
  { niche: 'Tech', type: 'Shock',     text: 'I built a $10k/month app in a single weekend using only AI tools. Here\'s exactly how.' },
  { niche: 'Tech', type: 'Curiosity', text: 'What if your laptop could run a model smarter than GPT-3? It already can \u2014 and you probably don\'t know it.' },
  { niche: 'Tech', type: 'Story',     text: 'I automated my entire job using AI in 30 days. My boss still doesn\'t know.' },
  { niche: 'Tech', type: 'Authority', text: 'I\'ve been in Silicon Valley for 15 years. Here\'s the one skill that will matter most in 2026.' },
  { niche: 'Tech', type: 'Shock',     text: 'Your iPhone has a hidden feature that Apple doesn\'t want you to know about.' },
  // Food
  { niche: 'Food', type: 'Curiosity', text: 'What if your favourite restaurant meal is only $3 to make at home \u2014 and tastes better?' },
  { niche: 'Food', type: 'Shock',     text: 'The most viral dish on TikTok took me 4 minutes. Here\'s why everyone is obsessed.' },
  { niche: 'Food', type: 'Story',     text: 'I challenged Gordon Ramsay\'s best pasta recipe with a $5 version. The result floored me.' },
  { niche: 'Food', type: 'Authority', text: 'I\'m a Michelin-starred chef. Here are the 3 techniques that separate home cooks from professionals.' },
  { niche: 'Food', type: 'Curiosity', text: 'Why does restaurant food always taste better? I spent a week working in a professional kitchen to find out.' },
  // Mindset
  { niche: 'Mindset', type: 'Shock',     text: 'The reason you\'re not disciplined isn\'t laziness \u2014 it\'s your environment. Here\'s the fix.' },
  { niche: 'Mindset', type: 'Story',     text: 'I did a dopamine detox for 30 days. Here\'s what happened to my brain \u2014 and my bank account.' },
  { niche: 'Mindset', type: 'Curiosity', text: 'What if 1 hour a day is all that separates you from the version of yourself you want to be?' },
  { niche: 'Mindset', type: 'Authority', text: 'I\'ve read 300 self-help books. Here are the only 5 ideas that actually changed my life.' },
  { niche: 'Mindset', type: 'Shock',     text: 'Most people who call themselves busy are actually just disorganised. Here\'s the uncomfortable truth.' },
]

const NICHE_COLORS: Record<HookNiche, string> = {
  Finance:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Fitness:       'text-orange-400  bg-orange-500/10  border-orange-500/20',
  Relationships: 'text-pink-400    bg-pink-500/10    border-pink-500/20',
  Tech:          'text-indigo-400  bg-indigo-500/10  border-indigo-500/20',
  Food:          'text-amber-400   bg-amber-500/10   border-amber-500/20',
  Mindset:       'text-violet-400  bg-violet-500/10  border-violet-500/20',
}

const TYPE_COLORS: Record<HookType, string> = {
  Curiosity: 'text-sky-400    bg-sky-500/10    border-sky-500/20',
  Shock:     'text-rose-400   bg-rose-500/10   border-rose-500/20',
  Story:     'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  Authority: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

// ── Component ─────────────────────────────────────────────────────────────────

const ScriptGeneratorView: React.FC<ScriptGeneratorViewProps> = ({ showToast, onInsertToTimeline }) => {
  const [activePanel, setActivePanel] = React.useState<'generator' | 'library'>('generator')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('energetic')
  const [role, setRole] = useState('expert')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generatedScript, setGeneratedScript] = useState<any>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [outlineView, setOutlineView] = useState(false)
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  // Hook Library state
  const [hookSearch, setHookSearch] = useState('')
  const [hookNiche, setHookNiche] = useState<HookNiche | 'All'>('All')
  const [hookType,  setHookType]  = useState<HookType  | 'All'>('All')
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('click-hook-favs') ?? '[]')) }
    catch { return new Set() }
  })

  const toggleFav = useCallback((text: string) => {
    setFavourites(prev => {
      const next = new Set(prev)
      if (next.has(text)) next.delete(text)
      else next.add(text)
      try { localStorage.setItem('click-hook-favs', JSON.stringify(Array.from(next))) } catch { /* no-op */ }
      return next
    })
  }, [])

  const filteredHooks = useMemo(() => HOOK_LIBRARY.filter(h => {
    const matchesNiche = hookNiche === 'All' || h.niche === hookNiche
    const matchesType  = hookType  === 'All' || h.type  === hookType
    const matchesSearch = !hookSearch.trim() || h.text.toLowerCase().includes(hookSearch.toLowerCase())
    return matchesNiche && matchesType && matchesSearch
  }), [hookNiche, hookType, hookSearch])

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast('Neural node offline: Topic required', 'error')
      return
    }
    try {
      setSwarmHUDTask(`Forge Neural Matrix: ${topic.trim()}`)
      setShowSwarmHUD(true)
      setIsGenerating(true)
      setSavedId(null)
      const res = await apiPost<{ success?: boolean; script?: any; data?: { script?: any } }>(
        '/ai/generate-script',
        { 
          topic: topic.trim(), 
          tone, 
          role,
          integrityChecks: true,
          clicheDetection: true
        }
      )
      const script = (res as any)?.data?.script ?? (res as any)?.script
      if (script) {
        // Multi-Variant Enhancement (PHASE 7)
        const enhancedScript = {
          ...script,
          variants: {
            hooks: [
              { type: 'The Agitator', text: `Why everything you know about ${topic} is WRONG. (And how to fix it).` },
              { type: 'The Authority', text: `After 10,000 hours of analyzing ${topic}, I found the one secret to scale.` },
              { type: 'The Storyteller', text: `I started with nothing but a ${topic} and a dream. Here's what happened next.` }
            ],
            marketing: [
              { title: `Ultimate ${topic} Guide`, desc: `Master the ${topic} matrix with these alpha-tier strategies.` },
              { title: `${topic}: The Silent Killer`, desc: `Why most people fail at ${topic} and how to stay ahead.` },
              { title: `The ${topic} Script`, desc: `Exact word-for-word breakdown for maximum resonance.` }
            ]
          }
        }
        setGeneratedScript(enhancedScript)
        showToast('Multi-Variant Synthesis Complete', 'success')
      } else {
        showToast('Synthesis interrupted', 'error')
      }
    } catch (e) {
      showToast('Neural Error during generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedScript || !topic.trim()) {
      showToast('Generate a script node first', 'error')
      return
    }
    try {
      setIsSaving(true)
      const res = await apiPost<{ data?: { _id?: string }; _id?: string }>('/ai/save-master-script', {
        topic: topic.trim(),
        tone,
        role,
        script: generatedScript,
      })
      const id = (res as any)?.data?._id ?? (res as any)?._id
      if (id) {
        setSavedId(String(id))
        showToast('Node archived to Library', 'success')
      } else {
        showToast('Archive complete', 'success')
      }
    } catch (e) {
      showToast('Archive failed', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  /** Push the generated hook into the editor timeline as a text overlay at t=0 */
  const handleInsertToTimeline = () => {
    const hookText = generatedScript?.hook
    if (!hookText) {
      showToast('Generate a script first', 'error')
      return
    }
    if (onInsertToTimeline) {
      onInsertToTimeline(hookText)
      showToast('Hook inserted into timeline at 00:00', 'success')
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(hookText).catch(() => {})
      showToast('Hook copied — paste into your Text overlay layer', 'info')
    }
  }

  const handleCopy = async (target: CopyTarget) => {
    let text = ''
    if (generatedScript) {
      switch (target) {
        case 'hook': text = generatedScript.hook ?? ''; break
        case 'body': text = generatedScript.body ?? ''; break
        case 'cta': text = generatedScript.cta ?? ''; break
        default: text = [generatedScript.hook, generatedScript.body, generatedScript.cta].filter(Boolean).join('\n\n---\n\n')
      }
    }
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(target); showToast('Node bridged to Clipboard', 'success');
      setTimeout(() => setCopied(null), 2000); setCopyMenuOpen(false);
    } catch { showToast('Bridge failed', 'error') }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const hooksUsed = (generatedScript?.hooks_used ?? []) as string[]
  const triggers = (generatedScript?.psychological_triggers ?? []) as string[]
  const readTime = generatedScript?.estimatedReadTime ?? 0
  const wordCount = [generatedScript?.hook, generatedScript?.body, generatedScript?.cta].filter(Boolean).join(' ').split(/\s+/).length

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1200px] mx-auto space-y-12 pb-20 py-4"
    >
      <motion.div variants={itemVariants} className="flex flex-col xl:flex-row items-center justify-between gap-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-[0.4em] italic text-blue-400 shadow-xl">
            <Activity className="w-4 h-4 animate-pulse" />
            Semantic Synthesis
          </div>
          <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">NEURAL<br />MASTER SCRIPT</h2>
        </div>
        <div className="p-4 bg-white/[0.03] border border-white/10 rounded-[2rem] shadow-3xl">
          <Cpu className="w-10 h-10 text-blue-400" />
        </div>
      </motion.div>

      {/* ── Panel Tab Switcher ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/10 rounded-2xl w-fit">
        {[['generator', 'Script Generator'] as const, ['library', 'Hook Library ✦'] as const].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActivePanel(id)}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activePanel === id ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {/* ── Hook Library Panel ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
      {activePanel === 'library' && (
        <motion.div key="library" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
          {/* Filters row */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-4`}>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="text"
                value={hookSearch}
                onChange={e => setHookSearch(e.target.value)}
                placeholder="Search hooks..."
                className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-[12px] text-white placeholder-slate-700 outline-none focus:border-blue-500/40"
                title="Search hooks"
              />
            </div>
            {/* Niche filter */}
            <div className="flex flex-wrap gap-2">
              {(['All', 'Finance', 'Fitness', 'Relationships', 'Tech', 'Food', 'Mindset'] as const).map(n => (
                <button key={n} type="button" onClick={() => setHookNiche(n)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${
                    hookNiche === n
                      ? 'bg-white text-black border-white'
                      : `text-slate-500 border-white/10 hover:border-white/20 ${n !== 'All' ? NICHE_COLORS[n as HookNiche] : ''}`
                  }`}
                >{n}</button>
              ))}
            </div>
            {/* Type filter */}
            <div className="flex flex-wrap gap-2">
              {(['All', 'Curiosity', 'Shock', 'Story', 'Authority'] as const).map(t => (
                <button key={t} type="button" onClick={() => setHookType(t)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${
                    hookType === t
                      ? 'bg-white text-black border-white'
                      : `text-slate-500 border-white/10 hover:border-white/20 ${t !== 'All' ? TYPE_COLORS[t as HookType] : ''}`
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Hook cards */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-2">{filteredHooks.length} hooks</p>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredHooks.map((h, i) => (
                <motion.div key={i} whileHover={{ scale: 1.007 }}
                  className={`${glassStyle} rounded-2xl p-4 flex items-start justify-between gap-4 group cursor-pointer hover:border-white/20 transition-all`}
                  onClick={() => { setTopic(h.text); setActivePanel('generator'); showToast('Hook loaded — edit and generate!', 'success') }}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${NICHE_COLORS[h.niche]}`}>{h.niche}</span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${TYPE_COLORS[h.type]}`}>{h.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed group-hover:text-white transition-colors">{h.text}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      type="button"
                      title="Toggle favourite"
                      onClick={e => { e.stopPropagation(); toggleFav(h.text) }}
                      className={`p-1.5 rounded-lg transition-all ${favourites.has(h.text) ? 'text-yellow-400' : 'text-slate-700 hover:text-slate-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${favourites.has(h.text) ? 'fill-current' : ''}`} />
                    </button>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-blue-400 transition-colors" />
                  </div>
                </motion.div>
              ))}
              {filteredHooks.length === 0 && (
                <div className="text-center py-10 text-slate-700 text-[11px]">No hooks match your filters</div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Generator Panel ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
      {activePanel === 'generator' && (
      <motion.div key="generator" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
          <motion.div variants={itemVariants} className={`${glassStyle} rounded-[3rem] p-10 space-y-10 shadow-3xl`}>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] italic pl-4">CORE SEMANTICS</label>
              <textarea
                className="w-full bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[200px] shadow-inner italic"
                placeholder="Initialize topic or core semantic idea..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] italic pl-4">TONAL MATRIX</label>
              <div className="flex flex-wrap gap-3">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest italic border transition-all ${tone === t.id ? 'bg-white text-black border-white shadow-3xl' : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] italic pl-4">NEURAL ROLE</label>
              <div className="grid grid-cols-1 gap-4">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all ${role === r.id ? 'bg-white/[0.08] border-white/20 text-white shadow-3xl' : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-6">
                      <r.icon className={`w-6 h-6 ${role === r.id ? `text-${r.color}-400` : 'text-current'}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest italic">{r.label}</span>
                    </div>
                    {role === r.id && <div className={`w-2 h-2 rounded-full bg-${r.color}-400 shadow-[0_0_8px_rgba(var(--${r.color}-rgb),0.8)]`} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-6 bg-white text-black rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-white/10 flex items-center justify-center gap-4 disabled:opacity-50 transition-all"
              >
                {isGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <PenTool className="w-6 h-6" />}
                {isGenerating ? 'SYNTHESIZING...' : 'INITIALIZE FORGE'}
              </motion.button>

              <AnimatePresence>
                {generatedScript && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest italic flex items-center justify-center gap-4 hover:bg-emerald-500 transition-all shadow-3xl shadow-emerald-600/20 border border-white/20"
                    >
                      {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {isSaving ? 'ARCHIVING...' : 'SAVE TO REPOSITORY'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {generatedScript ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${glassStyle} rounded-[4rem] overflow-hidden flex flex-col h-full min-h-[700px] shadow-3xl`}
              >
                <div className="p-8 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 text-emerald-400">
                      <Check className="w-6 h-6 shadow-inner" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">Synthesized Alpha</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                      {readTime}s TEMPORAL · {wordCount} TOKENS
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* ── Insert Hook to Timeline ── */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleInsertToTimeline}
                      title="Insert hook text as a timeline caption at 00:00"
                      className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all border border-indigo-400/20"
                    >
                      <Film className="w-3.5 h-3.5" /> Insert Hook
                    </motion.button>
                    <div className="relative">
                      <button
                        onClick={() => setCopyMenuOpen((o) => !o)}
                        className="px-6 py-4 bg-white/[0.05] hover:bg-white/[0.1] rounded-2xl border border-white/10 transition-all flex items-center gap-4"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white" />}
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Bridge</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {copyMenuOpen && (
                        <div className="absolute right-0 top-full mt-4 py-2 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-3xl z-50 min-w-[200px] overflow-hidden animate-in fade-in slide-in-from-top-4">
                          {(['full', 'hook', 'body', 'cta'] as const).map(t => (
                            <button key={t} onClick={() => handleCopy(t)} className="w-full text-left px-8 py-4 text-[10px] font-black uppercase tracking-widest italic hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                              {t === 'full' ? 'Neural Matrix' : `${t} node`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-12 space-y-16 overflow-y-auto custom-scrollbar italic font-medium">
                  {/* Phase 7: Neural Variations */}
                  <section className="space-y-10">
                    <div className="flex items-center gap-6">
                      <div className="w-1.5 h-10 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400/80">SYNTHESIZED VARIATIONS</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {generatedScript.variants?.hooks.map((h: any, idx: number) => (
                        <motion.div
                          key={idx}
                          whileHover={{ y: -4 }}
                          className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all space-y-4 group/var shadow-inner"
                        >
                          <div className="flex items-center justify-between">
                             <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                {idx === 0 ? <Zap className="w-4 h-4 text-indigo-400" /> : idx === 1 ? <UserCircle className="w-4 h-4 text-indigo-400" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                             </div>
                             <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{h.type}</span>
                          </div>
                          <p className="text-[13px] text-white font-bold leading-relaxed">{h.text}</p>
                          <button
                            onClick={() => { setGeneratedScript({ ...generatedScript, hook: h.text }); showToast('Hook Variant Applied', 'success') }}
                            className="w-full py-3 rounded-lg bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover/var:opacity-100 transition-opacity border border-indigo-500/10 hover:bg-indigo-500 hover:text-white"
                          >
                             Apply to Master
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                       {generatedScript.variants?.marketing.map((m: any, idx: number) => (
                         <div key={idx} className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-2">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.title}</h5>
                            <p className="text-[11px] text-slate-600 italic leading-relaxed">{m.desc}</p>
                            <button
                              onClick={() => { navigator.clipboard.writeText(`${m.title}\n${m.desc}`); showToast('Marketing Node bridged', 'success') }}
                              className="text-[8px] font-bold text-indigo-400/50 hover:text-indigo-400 transition-colors uppercase tracking-widest mt-2"
                            >
                               Copy Metadata
                            </button>
                         </div>
                       ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-1.5 h-10 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400/80">01. SCROLL-STOPPING HOOK (MASTER)</h4>
                    </div>
                    <p className="text-3xl font-black text-white leading-tight tracking-tighter uppercase">{generatedScript.hook}</p>
                    {hooksUsed.length > 0 && (
                      <div className="flex flex-wrap gap-4 pt-4">
                        {hooksUsed.map((h) => (
                          <span key={h} className="px-6 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[9px] font-black uppercase tracking-widest shadow-inner">
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-1.5 h-10 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-400/80">02. ELITE VALUE DELIVERY</h4>
                    </div>
                    <p className="text-xl text-slate-300 font-medium leading-[2.2] whitespace-pre-wrap">{generatedScript.body}</p>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-1.5 h-10 bg-rose-500 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-rose-400/80">03. PSYCHOLOGICAL CTA</h4>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight uppercase leading-relaxed">{generatedScript.cta}</p>
                  </section>
                </div>

                <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <Target className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">STRATEGIC INSIGHTS</span>
                  </div>
                  <div className="flex flex-wrap gap-10">
                    {triggers.map((t) => (
                      <div key={t} className="flex items-center gap-3">
                        <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center p-20 text-center h-full min-h-[700px] shadow-inner"
              >
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-10 animate-pulse-slow border border-white/5 shadow-3xl">
                  <PenTool className="w-12 h-12 text-blue-500/20" />
                </div>
                <h4 className="text-3xl font-black text-white/20 uppercase tracking-tighter mb-4 italic">Awaiting Neural Cycle</h4>
                <p className="text-lg text-slate-700 max-w-md font-medium italic leading-relaxed">
                  Initialize core semantics, tonal matrix, and neural role to forge a high-ROI master script.
                </p>

                <div className="mt-16 flex items-center gap-10 opacity-10">
                  <div className="flex flex-col items-center gap-2">
                    <Radio className="w-6 h-6 text-white" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Uplink</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Layers className="w-6 h-6 text-white" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Buffer</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="w-6 h-6 text-white" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Synced</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  )
}

export default ScriptGeneratorView
