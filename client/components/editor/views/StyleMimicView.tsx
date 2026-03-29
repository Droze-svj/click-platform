'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link as LinkIcon,
  Upload,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Fingerprint,
  Zap,
  Play,
  RotateCcw
} from 'lucide-react'
import { StyleProfile } from '@/types/editor'

interface StyleMimicViewProps {
  onStyleMirror: (profile: StyleProfile) => void
  onBack: () => void
}

const StyleMimicView: React.FC<StyleMimicViewProps> = ({ onStyleMirror, onBack }) => {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'complete'>('idle')
  const [progress, setProgress] = useState(0)
  const [extractedProfile, setExtractedProfile] = useState<StyleProfile | null>(null)

  const handleStartAnalysis = async () => {
    setStatus('analyzing')
    setProgress(0)

    // Simulation of AI Analysis
    const steps = [
      "Extracting Pacing DNA...",
      "Analyzing Color Palette...",
      "Decoding Font Hierarchies...",
      "Identifying Transition Patterns...",
      "Synthesizing Neural Style Profile..."
    ]

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 800))
      setProgress((i + 1) * 20)
    }

    const mockProfile: StyleProfile = {
      id: `mimic-${Date.now()}`,
      name: 'Mimic: ' + (url.includes('youtube') ? 'YouTube Viral' : 'Reference Style'),
      description: 'Extracted visual DNA from reference source.',
      lastTrained: Date.now(),
      pacing: {
        medianClipLength: 1.8,
        jCutFrequency: 'medium',
        lCutFrequency: 'medium',
        cutOnSentence: true
      },
      visuals: {
        lutId: 'cinematic-vibrant',
        punchInFrequency: 0.4,
        punchInAmount: 15,
        defaultTransition: 'crossfade'
      },
      assets: {
        fontFamily: 'Inter',
        fontHex: '#FACC15',
        dropShadowHex: '#000000',
        bezierCurve: 'linear'
      },
      audio: {
        duckingDb: -12,
        masterDb: 0,
        voiceDb: 3
      }
    }

    setExtractedProfile(mockProfile)
    setStatus('complete')
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fingerprint className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-black tracking-tight text-white italic uppercase">The Mimic // Style Mirror</h2>
        </div>
        <button
          onClick={onBack}
          className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-3 h-3" />
          Back to Elite
        </button>
      </div>

      <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4">
        Paste a URL or upload a video. Our AI will extract the <span className="text-white">Pacing, Color DNA, and Graphic Style</span> to apply it to your project instantly.
      </p>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="group relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <LinkIcon className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Paste YouTube or Instagram Reel URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer flex flex-col items-center gap-3 group">
                <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 transition-all" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Upload File</span>
              </div>
              <button
                disabled={!url}
                onClick={handleStartAnalysis}
                className="p-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all flex flex-col items-center justify-center gap-3 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
              >
                <Sparkles className="w-6 h-6 text-white" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Start Mirroring</span>
              </button>
            </div>
          </motion.div>
        )}

        {status === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 space-y-8"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/5 flex items-center justify-center">
                <Zap className="w-10 h-10 text-indigo-400 animate-pulse" />
              </div>
              <svg className="absolute inset-0 w-24 h-24 -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={276}
                  strokeDashoffset={276 - (276 * progress) / 100}
                  className="text-indigo-500 transition-all duration-500 ease-out"
                />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] animate-pulse">Analyzing Visual DNA</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic h-4">
                {progress < 20 && "Processing Frame Buffer..."}
                {progress >= 20 && progress < 40 && "Identifying Cut Points..."}
                {progress >= 40 && progress < 60 && "Mapping Color Spectrums..."}
                {progress >= 60 && progress < 80 && "OCR Typography Extraction..."}
                {progress >= 80 && "Synthesizing Neural Profile..."}
              </p>
            </div>
          </motion.div>
        )}

        {status === 'complete' && extractedProfile && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="w-8 h-8 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black text-white italic">{extractedProfile.name}</h3>
                  <p className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest">Visual DNA Extracted Successfully</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-white">98% Match</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Similarity Score</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
               {[
                 { label: 'Pacing', value: 'High' },
                 { label: 'Color', value: 'Cinematic' },
                 { label: 'Transitions', value: 'Fast' }
               ].map(m => (
                 <div key={m.label} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{m.label}</span>
                    <span className="text-[10px] font-black text-white italic">{m.value}</span>
                 </div>
               ))}
            </div>

            <button
              onClick={() => onStyleMirror(extractedProfile)}
              className="w-full bg-white text-black py-4 rounded-full text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-3 group"
            >
              Apply Mirrored DNA to Project
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StyleMimicView
