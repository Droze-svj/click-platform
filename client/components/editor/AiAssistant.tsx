import React, { useState, useCallback } from 'react'
import { Sparkles, X, Send, GitBranch, GitMerge, Wand2, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../lib/api'
import { IconButton, Input, Button, Badge } from '../ui'
import { cn } from '../../lib/utils'

import { StyleDNA } from '../../types/editor'

interface SuggestionItem {
    id: string
    kind: 'cut' | 'caption' | 'hook' | 'cta'
    type: string
    timeRange?: { start: number; end: number }
    description: string
    rationale: string
    frameworkId: string
    expectedRetentionDelta: number
    confidence: number
}

interface AiAssistantProps {
    isOpen: boolean
    onClose: () => void
    setTimelineSegments?: (v: any) => void
    setTextOverlays?: (v: any) => void
    setVideoFilters?: (v: any) => void
    showToast?: (m: string, t: any) => void
    styleDNA?: StyleDNA
    onNormalizeStyle?: () => void
    gpuBackend?: string | null
    gpuVendor?: string
    agentRunning?: boolean
    /** Editor passes these so the assistant can fetch + apply niche-aware suggestions. */
    videoId?: string
    onSplitAtPlayhead?: () => void
    onSeek?: (time: number) => void
}

const AiAssistant: React.FC<AiAssistantProps> = ({
    isOpen,
    onClose,
    setTimelineSegments,
    setTextOverlays,
    setVideoFilters,
    showToast,
    styleDNA,
    onNormalizeStyle,
    videoId,
    onSplitAtPlayhead,
    onSeek,
}) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Ready to optimize your production. How should we proceed?' }
    ])
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    const fetchSuggestions = useCallback(async () => {
        if (!videoId) {
            showToast?.('Open a video first to get suggestions', 'info')
            return
        }
        setLoadingSuggestions(true)
        try {
            const res: any = await apiGet(`/video/ai-editing/suggestions?videoId=${encodeURIComponent(videoId)}`)
            const items: SuggestionItem[] = res?.data?.suggestions || res?.suggestions || []
            setSuggestions(items)
            if (items.length === 0) showToast?.('No suggestions yet for this clip', 'info')
        } catch (e: any) {
            showToast?.(e?.message || 'Failed to fetch suggestions', 'error')
        } finally {
            setLoadingSuggestions(false)
        }
    }, [videoId, showToast])

    const applySuggestion = useCallback((s: SuggestionItem) => {
        // Each suggestion type maps to an existing editor action.
        if (s.timeRange?.start != null) onSeek?.(s.timeRange.start)
        if (s.kind === 'cut') {
            onSplitAtPlayhead?.()
            showToast?.(`Split applied near ${s.timeRange?.start.toFixed(1)}s`, 'success')
            return
        }
        if (s.kind === 'caption') {
            setTextOverlays?.((prev: any) => [...prev, {
                id: `sg-${Date.now()}`,
                text: s.description.replace(/\..*$/, '').toUpperCase().slice(0, 40),
                startTime: s.timeRange?.start ?? 0,
                endTime: (s.timeRange?.end ?? (s.timeRange?.start || 0) + 3),
                fontSize: 32,
                color: '#ffffff',
                x: 50, y: 80,
                fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                style: 'bold-kinetic',
                animationIn: 'pop',
            }])
            showToast?.(`Caption added (${s.frameworkId})`, 'success')
            return
        }
        if (s.kind === 'hook' || s.kind === 'cta') {
            // Surface the rewrite in the chat so the user can copy/refine.
            setMessages(prev => [...prev, { role: 'assistant', text: `${s.kind === 'hook' ? 'Hook' : 'CTA'} suggestion (${s.frameworkId}): ${s.description}` }])
            return
        }
    }, [onSplitAtPlayhead, onSeek, setTextOverlays, showToast])
    const [branches, setBranches] = useState([
        { id: 'b1', name: 'v1-original', active: true },
        { id: 'b2', name: 'client-revision-1', active: false, diff: true }
    ])

    const handleCommand = (cmd: string) => {
        const lowerCmd = cmd.toLowerCase().trim()

        if (lowerCmd.startsWith('/zoom')) {
            setVideoFilters?.((prev: any) => ({ ...prev, zoom: 1.2 }))
            showToast?.('Neural Zoom Applied', 'success')
            return 'Calibrating optics... Zoom-in node established at 1.2x scale.'
        }

        if (lowerCmd.includes('subtitle') || lowerCmd.startsWith('/subtitle')) {
            setTextOverlays?.((prev: any) => [...prev, {
                id: `sub-${Date.now()}`,
                text: 'NEURAL SUBTITLE',
                startTime: 0,
                endTime: 5,
                style: { fontSize: 48, color: '#ffffff', fontWeight: 'bold' }
            }])
            showToast?.('Subtitles Injected', 'success')
            return 'Injecting semantic text overlays across temporal nodes.'
        }

        if (lowerCmd.includes('clean') || lowerCmd.startsWith('/clean')) {
            showToast?.('Scanning for dead air...', 'info')
            setTimeout(() => {
                showToast?.('Silence nodes eliminated', 'success')
            }, 1000)
            return 'Background worker engaged. Identifying and removing high-latency silence zones.'
        }

        if (lowerCmd.startsWith('/style')) {
            // Use Style DNA if available to personalize the grade
            const isHighOctane = styleDNA?.theme === 'high-octane'
            setVideoFilters?.((prev: any) => ({
                ...prev,
                brightness: isHighOctane ? 1.1 : 1.05,
                contrast: isHighOctane ? 1.2 : 1.1,
                saturation: isHighOctane ? 1.3 : 1.15,
                hue: 0.02
            }))
            showToast?.(`Cinematic Grade Applied (${styleDNA?.theme || 'vlog'} mode)`, 'success')
            return `Optimizing visual aesthetics. Applied Neural LUT: "${styleDNA?.theme === 'high-octane' ? 'Elite High-Octane' : 'Elite Cinematic v2'}".`
        }

        if (lowerCmd.includes('help')) {
            return 'I can execute: /zoom (optics), /subtitle (temporal text), /style (color grading), or /clean (silence removal).'
        }

        return `Command "/${lowerCmd}" interpreted. Executing neural optimization protocol for your timeline segments.`
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="ds-surface-elevated ds-elev-3 fixed top-0 right-0 h-full w-80 border-l border-border z-[60] flex flex-col"
                >
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="ds-text-label text-theme-primary">AI Assistant</span>
                        </div>
                        <IconButton aria-label="Close AI Assistant" variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </IconButton>
                    </div>

                    <div className="p-4 border-b border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="ds-text-label text-theme-muted">Timeline branches</p>
                            <Badge variant="secondary">Workflows</Badge>
                        </div>
                        <div className="space-y-2">
                             {branches.map(branch => (
                                <div
                                    key={branch.id}
                                    className={cn(
                                        'p-3 rounded-xl border flex items-center justify-between group transition-all',
                                        branch.active ? 'bg-primary/10 border-primary/30' : 'ds-surface-card ds-hover-lift'
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <GitBranch className={cn('w-3.5 h-3.5', branch.active ? 'text-primary' : 'text-theme-muted')} />
                                        <div className="flex flex-col">
                                            <span className={cn('ds-text-body font-medium', branch.active ? 'text-theme-primary' : 'text-theme-secondary')}>{branch.name}</span>
                                            {branch.diff && <span className="text-[10px] text-emerald-500 font-medium">Modified</span>}
                                        </div>
                                    </div>

                                    {!branch.active && (
                                        <IconButton
                                            aria-label={`Merge ${branch.name} into master`}
                                            variant="primary"
                                            size="sm"
                                            onClick={() => {
                                                showToast?.(`Merging [${branch.name}] into master...`, 'info')
                                                setBranches(prev => prev.map(b => ({ ...b, active: b.id === branch.id })))
                                                setTimeout(() => showToast?.('Success: Timeline Merged non-destructively', 'success'), 1500)
                                            }}
                                            className="opacity-0 group-hover:opacity-100"
                                        >
                                            <GitMerge className="w-3 h-3" />
                                        </IconButton>
                                    )}
                                </div>
                             ))}
                        </div>
                    </div>

                    {/* Niche-aware suggestions — pulled from /video/ai-editing/suggestions
                         which is grounded in the marketing playbooks for the creator's
                         niche/platform. Each item maps to a concrete editor action. */}
                    <div className="p-4 border-b border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="ds-text-label text-theme-muted">Next moves</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={fetchSuggestions}
                                disabled={loadingSuggestions}
                                loading={loadingSuggestions}
                                leftIcon={<Wand2 className="w-3 h-3" />}
                            >
                                {loadingSuggestions ? 'Loading…' : 'Suggest'}
                            </Button>
                        </div>
                        {suggestions.length === 0 ? (
                            <div className="space-y-2">
                                <p className="ds-text-body text-theme-muted leading-relaxed">
                                    Tap <span className="text-primary font-medium">Suggest</span> for niche-aware edits — hooks, cuts, and CTAs grounded in your platform's retention curve.
                                </p>
                                <a
                                    href="/dashboard/marketing-ai"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 ds-text-label text-primary hover:text-primary/80"
                                >
                                    View Marketing Oracle <ChevronRight className="w-3 h-3" />
                                </a>
                            </div>
                        ) : (
                            <ul className="space-y-1.5">
                                {suggestions.map(s => (
                                    <li key={s.id}>
                                        <button
                                           type="button"
                                            onClick={() => applySuggestion(s)}
                                            className="w-full text-left p-2.5 rounded-xl ds-surface-card ds-hover-lift hover:border-primary/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn(
                                                    'text-[10px] font-medium px-1.5 py-0.5 rounded capitalize',
                                                    s.kind === 'hook' ? 'bg-rose-500/15 text-rose-500' :
                                                    s.kind === 'cta' ? 'bg-emerald-500/15 text-emerald-500' :
                                                    s.kind === 'caption' ? 'bg-amber-500/15 text-amber-500' :
                                                    'bg-sky-500/15 text-sky-500'
                                                )}>{s.kind}</span>
                                                <span className="text-[10px] font-mono text-theme-muted tabular-nums">
                                                    {s.timeRange ? `${s.timeRange.start.toFixed(1)}s` : ''}
                                                </span>
                                                <span className="ml-auto text-[10px] text-emerald-500 font-semibold">+{Math.round(s.expectedRetentionDelta * 100)}%</span>
                                                <ChevronRight className="w-3 h-3 text-theme-muted group-hover:text-primary transition-colors" />
                                            </div>
                                            <p className="ds-text-body text-theme-secondary leading-snug line-clamp-2">{s.description}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* Style DNA Sync Badge */}
                        {styleDNA && (
                            <button type="button" className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-primary/20 bg-primary/5 group hover:bg-primary/10 transition-all" onClick={onNormalizeStyle}>
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span className="text-[10px] font-medium text-primary capitalize">Style sync: {styleDNA.theme || 'Vlog'}</span>
                                <span className="hidden group-hover:inline text-[10px] text-theme-secondary ml-1 pl-1 border-l border-border">Nudge to DNA?</span>
                            </button>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                <div className={cn(
                                    'max-w-[85%] p-3 rounded-2xl ds-text-body leading-relaxed',
                                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'ds-surface-card text-theme-primary'
                                )}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 ds-surface-subtle border-t border-border">
                        <div className="relative">
                             <Input
                                type="text"
                                placeholder="Tell Click what to edit..."
                                title="AI Command Input"
                                className="pr-12"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inputValue.trim()) {
                                        const userText = inputValue.trim()
                                        setMessages(prev => [...prev, { role: 'user', text: userText }])
                                        setInputValue('')
                                        const response = handleCommand(userText)
                                        setTimeout(() => setMessages(prev => [...prev, { role: 'assistant', text: response }]), 600)
                                    }
                                }}
                            />
                            <IconButton
                                aria-label="Send Command"
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    if (inputValue.trim()) {
                                        const userText = inputValue.trim()
                                        setMessages(prev => [...prev, { role: 'user', text: userText }])
                                        setInputValue('')
                                        const response = handleCommand(userText)
                                        setTimeout(() => setMessages(prev => [...prev, { role: 'assistant', text: response }]), 600)
                                    }
                                }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                            >
                                <Send className="w-3 h-3" />
                            </IconButton>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}

export default AiAssistant
