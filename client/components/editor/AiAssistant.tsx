import React, { useState } from 'react'
import { Sparkles, MessageSquare, Zap, Cpu, History, ChevronRight, X, Send, GitBranch, GitPullRequest, GitMerge, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { StyleDNA } from '../../types/editor'

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
    gpuBackend = null,
    gpuVendor,
    agentRunning = false
}) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Ready to optimize your production. How should we proceed?' }
    ])
    const [inputValue, setInputValue] = useState('')
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
                    className="fixed top-0 right-0 h-full w-80 bg-surface-card border-l border-subtle z-[60] flex flex-col shadow-2xl backdrop-blur-xl"
                >
                    <div className="p-4 border-b border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-accent-violet-solid shadow-md">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xs font-bold uppercase text-theme-primary tracking-wider">Neural Oracle</span>
                        </div>
                        <button onClick={onClose} title="Close AI Assistant" className="p-2 hover:bg-surface-card-hover rounded-xl transition-colors text-theme-muted hover:text-theme-primary">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-subtle space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase text-theme-muted tracking-widest">Temporal Branches</p>
                            <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">Agency Workflows</span>
                        </div>
                        <div className="space-y-2">
                             {branches.map(branch => (
                                <div
                                    key={branch.id}
                                    className={`p-3 rounded-2xl border flex items-center justify-between group transition-all ${branch.active ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <GitBranch className={`w-3.5 h-3.5 ${branch.active ? 'text-indigo-400' : 'text-slate-500'}`} />
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-bold ${branch.active ? 'text-white' : 'text-slate-400 uppercase tracking-tight'}`}>{branch.name}</span>
                                            {branch.diff && <span className="text-[7px] text-emerald-400 font-bold uppercase tracking-wider">+12 Cuts, -2 Overlays</span>}
                                        </div>
                                    </div>

                                    {!branch.active && (
                                        <button
                                            onClick={() => {
                                                showToast?.(`Merging [${branch.name}] into master...`, 'info')
                                                setBranches(prev => prev.map(b => ({ ...b, active: b.id === branch.id })))
                                                setTimeout(() => showToast?.('Success: Timeline Merged non-destructively', 'success'), 1500)
                                            }}
                                            title={`Merge ${branch.name} into master`}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-indigo-500 text-white shadow-lg transition-all active:scale-95"
                                        >
                                            <GitMerge className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                             ))}
                        </div>
                    </div>

                    <div className="p-4 border-b border-subtle space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase text-theme-muted tracking-widest">Viral Pulse</p>
                            <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                        </div>
                        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 space-y-3 group cursor-pointer hover:bg-rose-500/15 transition-all">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-rose-400" />
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-tighter italic">Remix Opportunity</p>
                                    <p className="text-[8px] text-rose-300 font-bold uppercase tracking-widest">Trend: &quot;Capybara Chill&quot; (+450%)</p>
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-tight font-medium uppercase tracking-tight">
                                Current clip matches trending motif. <span className="text-white font-bold">Apply &quot;Slow-Pan&quot;</span> to increase potential ROI.
                            </p>
                            <button
                                onClick={() => showToast?.('Remix Protocol Initialized...', 'success')}
                                className="w-full py-2 rounded-xl bg-rose-600 text-white text-[8px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                            >
                                Auto-Remix Now
                            </button>
                        </div>
                    </div>

                    <div className="p-4 border-b border-subtle space-y-3">
                        <p className="text-[10px] font-bold uppercase text-theme-muted tracking-widest">Active background</p>
                        <div className="space-y-2">
                            {[
                                { l: 'Scene Detection', p: 85, c: 'text-blue-500' },
                                { l: 'Voice Sync', p: 40, c: 'text-orange-500' }
                            ].map(item => (
                                <div key={item.l} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-semibold text-theme-secondary uppercase">{item.l}</span>
                                        <span className="text-[10px] font-bold text-theme-primary">{item.p}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.p}%` }}
                                            className={`h-full bg-current ${item.c} rounded-full`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* Style DNA Sync Badge */}
                        {styleDNA && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 group cursor-pointer hover:bg-indigo-500/10 transition-all" onClick={onNormalizeStyle}>
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Style Sync: {styleDNA.theme || 'Vlog'}</span>
                                <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-white/10">
                                    <span className="text-[7px] text-white font-bold opacity-70">Nudge to DNA?</span>
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-accent-violet-solid text-white shadow-md' : 'bg-surface-elevated text-theme-primary border border-subtle'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-surface-elevated/50 border-t border-subtle">
                        <div className="relative">
                             <input
                                type="text"
                                placeholder="Tell Click what to edit..."
                                title="AI Command Input"
                                className="w-full bg-surface-card border border-subtle rounded-xl px-4 py-3 text-xs font-semibold text-theme-primary placeholder:text-theme-muted outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
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
                            <button
                                onClick={() => {
                                    if (inputValue.trim()) {
                                        const userText = inputValue.trim()
                                        setMessages(prev => [...prev, { role: 'user', text: userText }])
                                        setInputValue('')
                                        const response = handleCommand(userText)
                                        setTimeout(() => setMessages(prev => [...prev, { role: 'assistant', text: response }]), 600)
                                    }
                                }}
                                title="Send Command"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:scale-105 transition-all"
                            >
                                <Send className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}

export default AiAssistant
