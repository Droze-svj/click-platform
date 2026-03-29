'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Mic, AudioLines, Play, Loader2, CheckCircle2,
  Languages, Sparkles, Volume2, VolumeX, Download,
  ChevronDown, AlertCircle, Zap, Info
} from 'lucide-react'
import { apiPost, apiGet } from '../../../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────
interface GenerativeDubbingViewProps {
  videoId?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

const LANGUAGES = [
  { code: 'es', name: 'Spanish', flag: '🇪🇸', speakers: '500M+' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', speakers: '250M+' },
  { code: 'fr', name: 'French', flag: '🇫🇷', speakers: '280M+' },
  { code: 'de', name: 'German', flag: '🇩🇪', speakers: '130M+' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', speakers: '600M+' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', speakers: '125M+' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', speakers: '77M+' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', speakers: '1.1B+' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', speakers: '400M+' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', speakers: '85M+' },
]

type DubStep = 'idle' | 'cloning' | 'translating' | 'syncing' | 'rendering' | 'done' | 'error'

const STEP_LABELS: Record<DubStep, string> = {
  idle: 'Ready to dub',
  cloning: 'Cloning voice…',
  translating: 'Translating transcript…',
  syncing: 'Syncing phonemes to lip movements…',
  rendering: 'Rendering final audio track…',
  done: 'Dubbing complete!',
  error: 'Error — please retry',
}

const GenerativeDubbingView: React.FC<GenerativeDubbingViewProps> = ({ videoId, showToast }) => {
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(['es']))
  const [voiceCloneEnabled, setVoiceCloneEnabled] = useState(true)
  const [lipSyncEnabled, setLipSyncEnabled] = useState(false)
  const [step, setStep] = useState<DubStep>('idle')
  const [progress, setProgress] = useState(0)
  const [showLangDropdown, setShowLangDropdown] = useState(false)

  const selectedLangList = LANGUAGES.filter(l => selectedLangs.has(l.code))

  const toggleLang = (code: string) => {
    setSelectedLangs(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const startDubbing = async () => {
    if (!videoId) {
      showToast('No video loaded — select a video first', 'error')
      return
    }
    if (selectedLangs.size === 0) {
      showToast('Select at least one language', 'error')
      return
    }

    setStep('cloning')
    setProgress(10)

    try {
      const targetLangsArray = Array.from(selectedLangs)
      
      // We will loop through selected languages and dub them sequentially for now
      // A more robust implementation might send array of languages to the backend.
      for (let i = 0; i < targetLangsArray.length; i++) {
        const lang = targetLangsArray[i]
        
        // 1. Start Job
        setStep('translating')
        setProgress(30)
        
        const startRes = await apiPost('/dubbing/start', {
           videoId,
           targetLanguage: lang,
           voiceId: 'user_clone_auto', // Pass flag to use clone
           lipSyncEnabled,
           audioSampleUrl: 'video_source' // Hint to extract from video
        })

        if (!startRes || !startRes.jobId) {
           throw new Error('Failed to instantiate dubbing job on the server')
        }

        const jobId = startRes.jobId

        // 2. Poll Status
        let isDone = false
        while (!isDone) {
           // Poll every 2 seconds
           await new Promise(r => setTimeout(r, 2000))
           const statusRes = await apiGet(`/dubbing/status/${jobId}`)
           
           if (!statusRes) continue

           if (statusRes.status === 'processing') {
             if (statusRes.progress < 50) setStep('syncing')
             else setStep('rendering')
             
             // Base progress + lang progress fraction
             const baseProgress = (i / targetLangsArray.length) * 100
             const langFraction = (statusRes.progress / 100) * (100 / targetLangsArray.length)
             setProgress(Math.round(baseProgress + langFraction))
           } else if (statusRes.status === 'completed') {
             isDone = true
           } else if (statusRes.status === 'error') {
             throw new Error(statusRes.error || 'Dubbing generation failed')
           }
        }
      }

      setStep('done')
      setProgress(100)
      showToast(`Dubbing complete for ${selectedLangs.size} language(s) — new audio tracks added to timeline`, 'success')
      
    } catch (err: any) {
      console.error('[DubbingView] generation error:', err)
      setStep('error')
      showToast(err.message || 'Error occurred during dubbing. Please try again.', 'error')
    }
  }

  const reset = () => { setStep('idle'); setProgress(0) }

  const isRunning = step !== 'idle' && step !== 'done' && step !== 'error'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 max-w-[1200px] mx-auto pb-20 px-4 py-8"
    >
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-[0.5em]">
          <Globe className="w-3.5 h-3.5 animate-pulse" />
          Generative Dubbing Suite — 2026
        </div>
        <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
          Dub<br />Studio
        </h1>
        <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
          Clone your voice into <span className="text-white font-black">10 languages</span> with emotion preserved. Optional <span className="text-violet-400 font-black">visual lip-sync</span> warps mouth movements to match foreign phonemes.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        {/* Left Column */}
        <div className="space-y-6">

          {/* Language Selector */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-5`}>
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Target Languages</span>
              <span className="ml-auto text-[9px] font-black text-slate-600">
                {selectedLangs.size} selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LANGUAGES.map(lang => {
                const selected = selectedLangs.has(lang.code)
                return (
                  <motion.button
                    key={lang.code}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleLang(lang.code)}
                    disabled={isRunning}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-40 ${
                      selected
                        ? 'bg-violet-500/15 border-violet-500/30'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <div>
                      <p className={`text-[10px] font-black ${selected ? 'text-white' : 'text-slate-400'}`}>{lang.name}</p>
                      <p className="text-[8px] text-slate-600">{lang.speakers} speakers</p>
                    </div>
                    {selected && <CheckCircle2 className="w-3 h-3 text-violet-400 ml-auto shrink-0" />}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-4`}>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Dubbing Options</span>
            </div>

            {/* Voice Clone toggle */}
            <div className="flex items-center justify-between px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase">Clone My Voice</p>
                  <p className="text-[9px] text-slate-600">Preserves your tone, emotion & accent signature</p>
                </div>
              </div>
              <button
                onClick={() => setVoiceCloneEnabled(v => !v)}
                disabled={isRunning}
                className={`w-11 h-6 rounded-full border transition-all relative ${
                  voiceCloneEnabled ? 'bg-indigo-600 border-indigo-500' : 'bg-white/10 border-white/10'
                }`}
                aria-label="Toggle voice cloning"
              >
                <motion.div
                  layout
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                  animate={{ left: voiceCloneEnabled ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                />
              </button>
            </div>

            {/* Lip Sync toggle */}
            <div className="flex items-center justify-between px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-fuchsia-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase">Visual Lip-Sync</p>
                  <p className="text-[9px] text-slate-600">Warps mouth pixels to match foreign phonemes</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8px] font-black text-amber-400">Elite</span>
              </div>
              <button
                onClick={() => setLipSyncEnabled(v => !v)}
                disabled={isRunning}
                className={`w-11 h-6 rounded-full border transition-all relative ${
                  lipSyncEnabled ? 'bg-fuchsia-600 border-fuchsia-500' : 'bg-white/10 border-white/10'
                }`}
                aria-label="Toggle visual lip sync"
              >
                <motion.div
                  layout
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                  animate={{ left: lipSyncEnabled ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                />
              </button>
            </div>

            {lipSyncEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-4 rounded-2xl bg-fuchsia-500/5 border border-fuchsia-500/10"
              >
                <Info className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Visual lip-sync applies <strong className="text-white">frame-by-frame phoneme warping</strong> using computer vision. Processing time increases by ~3× but the result eliminates the &ldquo;dubbed movie&rdquo; effect entirely.
                </p>
              </motion.div>
            )}
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: isRunning ? 1 : 1.02 }}
            whileTap={{ scale: isRunning ? 1 : 0.98 }}
            onClick={step === 'done' ? reset : (isRunning ? undefined : startDubbing)}
            disabled={selectedLangs.size === 0 && !isRunning}
            className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-40 ${
              step === 'done'
                ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                : isRunning
                ? 'bg-violet-900/40 border border-violet-500/20 text-violet-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-violet-500/20'
            }`}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{STEP_LABELS[step]}</>
            ) : step === 'done' ? (
              <>✓ Done — Dub Another Language</>
            ) : (
              <><Globe className="w-4 h-4" /> Start Dubbing ({selectedLangs.size} language{selectedLangs.size !== 1 ? 's' : ''})</>
            )}
          </motion.button>
        </div>

        {/* Right Column — Progress + Info */}
        <div className="space-y-6">
          {/* Progress Panel */}
          <AnimatePresence>
            {(isRunning || step === 'done') && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassStyle} rounded-[2.5rem] p-6 space-y-5`}
              >
                <div className="flex items-center gap-3">
                  {step === 'done'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  }
                  <span className="text-sm font-black text-white uppercase tracking-wider">
                    {step === 'done' ? 'Dubbing Complete' : 'Processing…'}
                  </span>
                  <span className="ml-auto text-[11px] font-mono font-black text-violet-400">{progress}%</span>
                </div>

                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 italic">{STEP_LABELS[step]}</p>

                {step === 'done' && (
                  <div className="space-y-2">
                    {selectedLangList.map(lang => (
                      <div key={lang.code} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-base">{lang.flag}</span>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-white">{lang.name} Audio</p>
                          <p className="text-[9px] text-emerald-600">Added to timeline • Track A3</p>
                        </div>
                        <button
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                          title={`Preview ${lang.name} dub`}
                        >
                          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    ))}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      className="w-full mt-2 py-3 rounded-2xl bg-violet-600/20 border border-violet-500/20 text-violet-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      onClick={() => showToast('Export with dubbing tracks enabled', 'info')}
                    >
                      <Download className="w-4 h-4" /> Export with Dubbed Audio
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Powered by badge */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-3`}>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">Powered by</div>
            {[
              { name: 'ElevenLabs Dubbing API', desc: 'Voice cloning & multilingual TTS', color: 'text-indigo-400' },
              { name: 'Whisper v3', desc: 'Ultra-accurate word-level transcription', color: 'text-emerald-400' },
              { name: 'Phoneme Warp Engine', desc: 'Real-time lip-sync via computer vision', color: 'text-fuchsia-400' },
            ].map(api => (
              <div key={api.name} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                <div>
                  <p className={`text-[10px] font-black ${api.color}`}>{api.name}</p>
                  <p className="text-[9px] text-slate-600">{api.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default GenerativeDubbingView
