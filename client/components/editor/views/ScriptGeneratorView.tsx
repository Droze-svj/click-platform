'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Sparkles,
  Zap,
  Cpu,
  UserCircle,
  PenTool,
  Copy,
  Check,
  Save,
  RefreshCw,
  ChevronDown,
  Target,
  Activity,
  Film,
  Star,
  ArrowUpRight,
  Search,
} from 'lucide-react'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiPost } from '../../../lib/api'
import { Panel, Card, Button, Badge, Input, Textarea, FormField, SectionHeader, EmptyState } from '../../ui'
import { cn } from '../../../lib/utils'

interface ScriptGeneratorViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  /** Optional — called to push hook text as a text overlay at the start of the timeline */
  onInsertToTimeline?: (text: string) => void
}

type CopyTarget = 'full' | 'hook' | 'body' | 'cta'

const ROLES = [
  { id: 'expert', label: 'Authoritative Expert', icon: UserCircle },
  { id: 'skeptic', label: 'Provocative Skeptic', icon: Zap },
  { id: 'hypeman', label: 'High-Energy Hype-Man', icon: Sparkles },
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
  { niche: 'Finance', type: 'Curiosity', text: 'What if I told you your money is sleeping — and the bank is making 9% on it while you get 0.5%?' },
  { niche: 'Finance', type: 'Story',     text: 'I went from $0 to $180k net worth in 3 years. Here\'s literally everything I did.' },
  { niche: 'Finance', type: 'Authority', text: 'I analyzed 1,000 millionaires. Here are the 5 habits literally every single one of them shares.' },
  { niche: 'Finance', type: 'Curiosity', text: 'Why does a barista with a Roth IRA beat a Wall Street analyst with a brokerage? The math will shock you.' },
  // Fitness
  { niche: 'Fitness', type: 'Shock',     text: 'You\'ve been doing abs wrong your entire life. Here\'s what actually works.' },
  { niche: 'Fitness', type: 'Story',     text: 'I trained for 6 months and gained 20 lbs of muscle. This is the EXACT protocol.' },
  { niche: 'Fitness', type: 'Curiosity', text: 'What if you could burn 300 extra calories a day just by changing when you eat?' },
  { niche: 'Fitness', type: 'Authority', text: 'I\'ve coached 10,000 athletes. Here\'s the one thing beginner gym-goers always get wrong.' },
  { niche: 'Fitness', type: 'Shock',     text: 'Stop doing cardio first thing in the morning — science says it\'s actually counterproductive.' },
  // Relationships
  { niche: 'Relationships', type: 'Curiosity', text: 'There\'s one sentence that instantly ends almost any argument. Most couples never learn it.' },
  { niche: 'Relationships', type: 'Story',     text: 'We were on the edge of divorce. Then we tried this one thing — and everything changed.' },
  { niche: 'Relationships', type: 'Shock',     text: 'The reason 60% of marriages fail has nothing to do with cheating or money. It\'s this.' },
  { niche: 'Relationships', type: 'Authority', text: 'I\'ve studied 500 happy couples. The one thing they all do is shockingly simple.' },
  { niche: 'Relationships', type: 'Curiosity', text: 'What if the person you\'re with right now is great — but they\'re not right for you?' },
  // Tech
  { niche: 'Tech', type: 'Shock',     text: 'I built a $10k/month app in a single weekend using only AI tools. Here\'s exactly how.' },
  { niche: 'Tech', type: 'Curiosity', text: 'What if your laptop could run a model smarter than GPT-3? It already can — and you probably don\'t know it.' },
  { niche: 'Tech', type: 'Story',     text: 'I automated my entire job using AI in 30 days. My boss still doesn\'t know.' },
  { niche: 'Tech', type: 'Authority', text: 'I\'ve been in Silicon Valley for 15 years. Here\'s the one skill that will matter most in 2026.' },
  { niche: 'Tech', type: 'Shock',     text: 'Your iPhone has a hidden feature that Apple doesn\'t want you to know about.' },
  // Food
  { niche: 'Food', type: 'Curiosity', text: 'What if your favourite restaurant meal is only $3 to make at home — and tastes better?' },
  { niche: 'Food', type: 'Shock',     text: 'The most viral dish on TikTok took me 4 minutes. Here\'s why everyone is obsessed.' },
  { niche: 'Food', type: 'Story',     text: 'I challenged Gordon Ramsay\'s best pasta recipe with a $5 version. The result floored me.' },
  { niche: 'Food', type: 'Authority', text: 'I\'m a Michelin-starred chef. Here are the 3 techniques that separate home cooks from professionals.' },
  { niche: 'Food', type: 'Curiosity', text: 'Why does restaurant food always taste better? I spent a week working in a professional kitchen to find out.' },
  // Mindset
  { niche: 'Mindset', type: 'Shock',     text: 'The reason you\'re not disciplined isn\'t laziness — it\'s your environment. Here\'s the fix.' },
  { niche: 'Mindset', type: 'Story',     text: 'I did a dopamine detox for 30 days. Here\'s what happened to my brain — and my bank account.' },
  { niche: 'Mindset', type: 'Curiosity', text: 'What if 1 hour a day is all that separates you from the version of yourself you want to be?' },
  { niche: 'Mindset', type: 'Authority', text: 'I\'ve read 300 self-help books. Here are the only 5 ideas that actually changed my life.' },
  { niche: 'Mindset', type: 'Shock',     text: 'Most people who call themselves busy are actually just disorganised. Here\'s the uncomfortable truth.' },
]

const NICHE_COLORS: Record<HookNiche, string> = {
  Finance:       'text-emerald-500 border-emerald-500/20',
  Fitness:       'text-orange-500 border-orange-500/20',
  Relationships: 'text-pink-500 border-pink-500/20',
  Tech:          'text-indigo-500 border-indigo-500/20',
  Food:          'text-amber-500 border-amber-500/20',
  Mindset:       'text-violet-500 border-violet-500/20',
}

const TYPE_COLORS: Record<HookType, string> = {
  Curiosity: 'text-sky-500 border-sky-500/20',
  Shock:     'text-rose-500 border-rose-500/20',
  Story:     'text-fuchsia-500 border-fuchsia-500/20',
  Authority: 'text-amber-500 border-amber-500/20',
}

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
      showToast('Topic required', 'error')
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
        // Multi-Variant Enhancement (PHASE 7) — client-side copy variations
        // derived from the topic to give quick A/B alternatives.
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
      setCopied(target); showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopied(null), 2000); setCopyMenuOpen(false);
    } catch { showToast('Copy failed', 'error') }
  }

  const hooksUsed = (generatedScript?.hooks_used ?? []) as string[]
  const triggers = (generatedScript?.psychological_triggers ?? []) as string[]
  const readTime = generatedScript?.estimatedReadTime ?? 0
  const wordCount = [generatedScript?.hook, generatedScript?.body, generatedScript?.cta].filter(Boolean).join(' ').split(/\s+/).length

  return (
    <div className="space-y-6 pb-10 ds-anim-rise">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2 border-blue-500/30 text-blue-500">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Semantic Synthesis
          </Badge>
          <SectionHeader as="h1" title="AI Master Script" description="Generate scroll-stopping scripts and insert hooks straight into your timeline." />
        </div>
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 sm:flex">
          <Cpu className="h-6 w-6" aria-hidden />
        </span>
      </div>

      {/* ── Panel Tab Switcher ──────────────────────────────────────────── */}
      <div className="flex w-fit items-center gap-1 rounded-xl ds-surface-subtle p-1">
        {[['generator', 'Script Generator'] as const, ['library', 'Hook Library'] as const].map(([id, label]) => (
          <button type="button"
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              'rounded-lg px-4 py-2 ds-text-label transition-all',
              activePanel === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-theme-muted hover:text-theme-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Hook Library Panel ──────────────────────────────────────────── */}
      {activePanel === 'library' && (
        <div className="space-y-5 ds-anim-fade-in">
          {/* Filters row */}
          <Panel variant="glass" className="space-y-4 p-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" aria-hidden />
              <Input
                type="text"
                value={hookSearch}
                onChange={e => setHookSearch(e.target.value)}
                placeholder="Search hooks..."
                className="pl-10"
                title="Search hooks"
              />
            </div>
            {/* Niche filter */}
            <div className="flex flex-wrap gap-2">
              {(['All', 'Finance', 'Fitness', 'Relationships', 'Tech', 'Food', 'Mindset'] as const).map(n => (
                <button key={n} type="button" onClick={() => setHookNiche(n)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                    hookNiche === n
                      ? 'border-primary bg-primary text-primary-foreground'
                      : cn('border-subtle text-theme-muted hover:border-border', n !== 'All' && NICHE_COLORS[n as HookNiche])
                  )}
                >{n}</button>
              ))}
            </div>
            {/* Type filter */}
            <div className="flex flex-wrap gap-2">
              {(['All', 'Curiosity', 'Shock', 'Story', 'Authority'] as const).map(t => (
                <button key={t} type="button" onClick={() => setHookType(t)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                    hookType === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : cn('border-subtle text-theme-muted hover:border-border', t !== 'All' && TYPE_COLORS[t as HookType])
                  )}
                >{t}</button>
              ))}
            </div>
          </Panel>

          {/* Hook cards */}
          <div className="space-y-2">
            <p className="ds-text-caption text-theme-muted">{filteredHooks.length} hooks</p>
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {filteredHooks.map((h, i) => (
                <Card key={i} variant="subtle"
                  className="group flex cursor-pointer items-start justify-between gap-4 p-4 transition-colors hover:border-border"
                  onClick={() => { setTopic(h.text); setActivePanel('generator'); showToast('Hook loaded — edit and generate!', 'success') }}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', NICHE_COLORS[h.niche])}>{h.niche}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', TYPE_COLORS[h.type])}>{h.type}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-theme-secondary transition-colors group-hover:text-theme-primary">{h.text}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <button
                     type="button"
                      title="Toggle favourite"
                      onClick={e => { e.stopPropagation(); toggleFav(h.text) }}
                      className={cn('rounded-lg p-1.5 transition-all', favourites.has(h.text) ? 'text-yellow-500' : 'text-theme-muted hover:text-theme-secondary')}
                    >
                      <Star className={cn('h-3.5 w-3.5', favourites.has(h.text) && 'fill-current')} aria-hidden />
                    </button>
                    <ArrowUpRight className="h-3.5 w-3.5 text-theme-muted transition-colors group-hover:text-blue-500" aria-hidden />
                  </div>
                </Card>
              ))}
              {filteredHooks.length === 0 && (
                <EmptyState icon={Search} title="No hooks match your filters" description="Try a different niche, type, or search term." />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Generator Panel ─────────────────────────────────────────────── */}
      {activePanel === 'generator' && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 ds-anim-fade-in">
        <div className="space-y-6 lg:col-span-1">
          <Panel variant="glass" className="space-y-6 p-6">
            <FormField label="Core Topic" htmlFor="script-topic">
              <Textarea
                id="script-topic"
                className="min-h-[160px]"
                placeholder="Initialize topic or core semantic idea..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </FormField>

            <div className="space-y-2">
              <span className="ds-text-label text-theme-secondary">Tone</span>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tn) => (
                  <button type="button"
                    key={tn.id}
                    onClick={() => setTone(tn.id)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-xs font-semibold transition-all',
                      tone === tn.id ? 'border-primary bg-primary text-primary-foreground' : 'border-subtle text-theme-muted hover:border-border'
                    )}
                  >
                    {tn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="ds-text-label text-theme-secondary">Narrator Role</span>
              <div className="grid grid-cols-1 gap-2">
                {ROLES.map((r) => {
                  const RIcon = r.icon
                  const active = role === r.id
                  return (
                    <button type="button"
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl border p-4 transition-all',
                        active ? 'border-border ds-surface-subtle text-theme-primary' : 'border-subtle text-theme-muted hover:border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <RIcon className={cn('h-5 w-5', active ? 'text-indigo-500' : 'text-current')} aria-hidden />
                        <span className="ds-text-label">{r.label}</span>
                      </div>
                      {active && <Check className="h-4 w-4 text-indigo-500" aria-hidden />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                loading={isGenerating}
                size="lg"
                className="w-full"
                leftIcon={!isGenerating ? <PenTool className="h-5 w-5" aria-hidden /> : undefined}
              >
                {isGenerating ? 'Synthesizing…' : 'Generate Script'}
              </Button>

              {generatedScript && (
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={isSaving}
                  loading={isSaving}
                  className="w-full"
                  leftIcon={!isSaving ? <Save className="h-4 w-4" aria-hidden /> : undefined}
                >
                  {isSaving ? 'Saving…' : savedId ? 'Saved to Library' : 'Save to Library'}
                </Button>
              )}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-2">
          {generatedScript ? (
            <Panel variant="glass" className="flex h-full min-h-[600px] flex-col overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Check className="h-5 w-5" aria-hidden />
                    <span className="ds-text-label">Synthesized</span>
                  </div>
                  <span className="ds-text-caption text-theme-muted">
                    {readTime}s read · {wordCount} words
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* ── Insert Hook to Timeline ── */}
                  <Button
                    onClick={handleInsertToTimeline}
                    size="sm"
                    title="Insert hook text as a timeline caption at 00:00"
                    leftIcon={<Film className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Insert Hook
                  </Button>
                  <div className="relative">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCopyMenuOpen((o) => !o)}
                      leftIcon={copied ? <Check className="h-4 w-4 text-emerald-500" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                      rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}
                    >
                      Copy
                    </Button>
                    {copyMenuOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl ds-surface-elevated py-1 ds-anim-fade-in">
                        {(['full', 'hook', 'body', 'cta'] as const).map(t => (
                          <button key={t} onClick={() => handleCopy(t)} className="w-full px-4 py-2 text-left text-sm capitalize text-theme-secondary transition-all hover:bg-accent hover:text-theme-primary">
                            {t === 'full' ? 'Full script' : `${t}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-10 overflow-y-auto p-6 sm:p-8">
                {/* Phase 7: copy variations */}
                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-indigo-500" />
                    <h4 className="ds-text-label text-theme-secondary">Variations</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {generatedScript.variants?.hooks.map((h: any, idx: number) => (
                      <Card key={idx} variant="subtle" className="group/var space-y-3 p-4 transition-colors hover:border-indigo-500/40">
                        <div className="flex items-center justify-between">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                            {idx === 0 ? <Zap className="h-4 w-4" aria-hidden /> : idx === 1 ? <UserCircle className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                          </span>
                          <span className="ds-text-caption text-indigo-500">{h.type}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-theme-primary">{h.text}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setGeneratedScript({ ...generatedScript, hook: h.text }); showToast('Hook Variant Applied', 'success') }}
                          className="w-full"
                        >
                          Apply to Master
                        </Button>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {generatedScript.variants?.marketing.map((m: any, idx: number) => (
                      <Card key={idx} variant="subtle" className="space-y-2 p-4">
                        <h5 className="ds-text-label text-theme-secondary">{m.title}</h5>
                        <p className="text-xs leading-relaxed text-theme-muted">{m.desc}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(`${m.title}\n${m.desc}`); showToast('Metadata copied', 'success') }}
                          className="mt-1 text-xs font-semibold text-indigo-500/70 transition-colors hover:text-indigo-500"
                        >
                          Copy metadata
                        </button>
                      </Card>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-blue-500" />
                    <h4 className="ds-text-label text-theme-secondary">01 · Hook</h4>
                  </div>
                  <p className="ds-text-h2 text-theme-primary">{generatedScript.hook}</p>
                  {hooksUsed.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {hooksUsed.map((h) => (
                        <Badge key={h} variant="outline" className="border-blue-500/20 text-blue-500">{h}</Badge>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-emerald-500" />
                    <h4 className="ds-text-label text-theme-secondary">02 · Value Delivery</h4>
                  </div>
                  <p className="whitespace-pre-wrap ds-text-body text-theme-secondary">{generatedScript.body}</p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-rose-500" />
                    <h4 className="ds-text-label text-theme-secondary">03 · Call To Action</h4>
                  </div>
                  <p className="ds-text-h3 text-theme-primary">{generatedScript.cta}</p>
                </section>
              </div>

              {triggers.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-subtle p-5">
                  <div className="flex items-center gap-2 text-theme-muted">
                    <Target className="h-4 w-4" aria-hidden />
                    <span className="ds-text-caption">Strategic Insights</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {triggers.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          ) : (
            <EmptyState
              icon={PenTool}
              className="ds-surface-subtle h-full min-h-[600px] border border-dashed border-subtle"
              title="Awaiting your topic"
              description="Set a topic, tone, and narrator role, then generate a high-ROI master script."
            />
          )}
        </div>
      </div>
      )}

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default ScriptGeneratorView
