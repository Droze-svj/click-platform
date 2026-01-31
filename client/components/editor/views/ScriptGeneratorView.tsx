'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '../../../lib/api'

interface ScriptGeneratorViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

type CopyTarget = 'full' | 'hook' | 'body' | 'cta'

const ROLES = [
  { id: 'expert', label: 'Authoritative Expert', icon: UserCircle, color: 'text-blue-500' },
  { id: 'skeptic', label: 'Provocative Skeptic', icon: Zap, color: 'text-orange-500' },
  { id: 'hypeman', label: 'High-Energy Hype-Man', icon: Sparkles, color: 'text-fuchsia-500' },
]

const TONES = [
  { id: 'energetic', label: 'Energetic' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'authoritative', label: 'Authoritative' },
  { id: 'humorous', label: 'Humorous' },
]

const ScriptGeneratorView: React.FC<ScriptGeneratorViewProps> = ({ showToast }) => {
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

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast('Please provide a topic', 'error')
      return
    }
    try {
      setIsGenerating(true)
      setSavedId(null)
      showToast('Engaging Neural Writing Engine...', 'info')
      const res = await apiPost<{ success?: boolean; script?: any; data?: { script?: any } }>(
        '/ai/generate-script',
        { topic: topic.trim(), tone, role }
      )
      const script = (res as any)?.data?.script ?? (res as any)?.script
      if (script) {
        setGeneratedScript(script)
        showToast('Script generated', 'success')
      } else {
        showToast('Unexpected response', 'error')
      }
    } catch (e) {
      console.error('Script generation failed', e)
      showToast('Generation failed', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedScript || !topic.trim()) {
      showToast('Generate a script first', 'error')
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
        showToast('Script saved to library', 'success')
      } else {
        showToast('Saved', 'success')
      }
    } catch (e) {
      console.error('Save failed', e)
      showToast('Save failed', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const getCopyText = (target: CopyTarget): string => {
    if (!generatedScript) return ''
    switch (target) {
      case 'hook':
        return generatedScript.hook ?? ''
      case 'body':
        return generatedScript.body ?? ''
      case 'cta':
        return generatedScript.cta ?? ''
      default:
        return [generatedScript.hook, generatedScript.body, generatedScript.cta]
          .filter(Boolean)
          .join('\n\n---\n\n')
    }
  }

  const handleCopy = async (target: CopyTarget) => {
    const text = getCopyText(target)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(target)
      showToast('Copied to clipboard', 'success')
      setTimeout(() => setCopied(null), 2000)
      setCopyMenuOpen(false)
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  const handleExportTxt = () => {
    if (!generatedScript) return
    const parts = [
      `# ${topic || 'Untitled'}`,
      '',
      '## Hook',
      generatedScript.hook ?? '',
      '',
      '## Body',
      generatedScript.body ?? '',
      '',
      '## CTA',
      generatedScript.cta ?? '',
    ]
    const hooks = (generatedScript.hooks_used ?? []) as string[]
    const triggers = (generatedScript.psychological_triggers ?? []) as string[]
    if (hooks.length || triggers.length) {
      parts.push('', '## Insights', '')
      if (hooks.length) parts.push('Hooks: ' + hooks.join(', '))
      if (triggers.length) parts.push('Triggers: ' + triggers.join(', '))
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `script-${(topic || 'untitled').slice(0, 40).replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Exported as TXT', 'success')
  }

  const hooksUsed = (generatedScript?.hooks_used ?? []) as string[]
  const triggers = (generatedScript?.psychological_triggers ?? []) as string[]
  const readTime = generatedScript?.estimatedReadTime ?? 0
  const wordCount = [generatedScript?.hook, generatedScript?.body, generatedScript?.cta]
    .filter(Boolean)
    .join(' ')
    .split(/\s+/).length

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">AI Script Mastery</h3>
          <p className="text-xs text-gray-500 font-medium italic">Generate, save, and export high-retention scripts.</p>
        </div>
        <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
          <Cpu className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Topic / Core Idea</label>
              <textarea
                className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[120px]"
                placeholder="E.g. How to use AI for video editing in 2025..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block">Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                      tone === t.id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block">Role</label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      role === r.id ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-400'
                    }`}
                  >
                    <r.icon className={`w-4 h-4 ${role === r.id ? r.color : 'text-current'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[2px] shadow-2xl shadow-white/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate Master Script'}
              </button>
              {generatedScript && (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : 'Save to My Scripts'}
                  </button>
                  {savedId && !String(savedId).startsWith('dev-') && (
                    <a
                      href={`/dashboard/scripts/${savedId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 text-center text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Scripts
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {generatedScript ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden flex flex-col h-full min-h-[600px]"
              >
                <div className="p-6 bg-white/5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Check className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Draft Ready</span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {readTime}s read · {wordCount} words
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outlineView}
                        onChange={(e) => setOutlineView(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-[10px] text-gray-400">Outline</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCopyMenuOpen((o) => !o)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white" />}
                        <span className="text-[10px] font-bold">Copy</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {copyMenuOpen && (
                        <>
                          <div className="absolute inset-0 -inset-y-20" aria-hidden onClick={() => setCopyMenuOpen(false)} />
                          <div className="absolute right-0 top-full mt-1 py-1 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 min-w-[140px]">
                            <button type="button" onClick={() => handleCopy('full')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10">
                              Full script
                            </button>
                            <button type="button" onClick={() => handleCopy('hook')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10">
                              Hook only
                            </button>
                            <button type="button" onClick={() => handleCopy('body')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10">
                              Body only
                            </button>
                            <button type="button" onClick={() => handleCopy('cta')} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10">
                              CTA only
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <button type="button" onClick={handleExportTxt} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-8 space-y-10 overflow-y-auto custom-scrollbar">
                  {outlineView ? (
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-blue-500/80 mb-2">Hook</h4>
                        <p className="text-gray-300">{generatedScript.hook}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-emerald-500/80 mb-2">Body</h4>
                        <p className="text-gray-300 whitespace-pre-wrap">{generatedScript.body}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-fuchsia-500/80 mb-2">CTA</h4>
                        <p className="text-gray-300">{generatedScript.cta}</p>
                      </div>
                      {(hooksUsed.length > 0 || triggers.length > 0) && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Insights</h4>
                          <div className="flex flex-wrap gap-2">
                            {hooksUsed.map((h) => (
                              <span key={h} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px]">
                                {h}
                              </span>
                            ))}
                            {triggers.map((t) => (
                              <span key={t} className="px-2 py-0.5 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 rounded text-[10px]">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <section className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                          <h4 className="text-[10px] font-black uppercase tracking-[3px] text-blue-500/80">01. Scroll-Stopping Hook</h4>
                        </div>
                        <p className="text-xl font-black text-white leading-relaxed">{generatedScript.hook}</p>
                        {hooksUsed.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {hooksUsed.map((h) => (
                              <span key={h} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] font-bold uppercase">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                          <h4 className="text-[10px] font-black uppercase tracking-[3px] text-emerald-500/80">02. Elite Value Delivery</h4>
                        </div>
                        <p className="text-sm text-gray-300 font-medium leading-loose whitespace-pre-wrap">{generatedScript.body}</p>
                      </section>

                      <section className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-fuchsia-500 rounded-full" />
                          <h4 className="text-[10px] font-black uppercase tracking-[3px] text-fuchsia-500/80">03. Psychological CTA</h4>
                        </div>
                        <p className="text-lg font-bold text-white leading-relaxed">{generatedScript.cta}</p>
                      </section>
                    </>
                  )}
                </div>

                {!outlineView && (hooksUsed.length > 0 || triggers.length > 0) && (
                  <div className="p-6 bg-black/40 border-t border-white/5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase text-gray-500 tracking-[2px]">
                      <span>Strategic insights</span>
                      <div className="flex flex-wrap gap-4">
                        {triggers.map((t) => (
                          <span key={t} className="text-white/40">● {t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/20 border border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center p-12 text-center h-full min-h-[600px]"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <PenTool className="w-8 h-8 text-white/20" />
                </div>
                <h4 className="text-xl font-black text-white/40 uppercase tracking-tighter mb-2">Awaiting Neural Cycle</h4>
                <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                  Set your topic, tone, and role, then generate. You can save, copy, or export when ready.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default ScriptGeneratorView
