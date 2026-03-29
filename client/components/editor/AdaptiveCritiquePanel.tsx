'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Music, 
  Video, 
  Image as ImageIcon, 
  Smile, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCcw,
  Sparkles,
  Zap,
  Globe,
  Cpu,
  CheckCircle2,
  XCircle,
  Brain
} from 'lucide-react'
import { apiPost } from '../../lib/api'

interface Suggestion {
  id: string
  type: 'music' | 'vibe' | 'hook' | 'broll' | 'gif'
  title: string
  description: string
  reason: string
  confidence: number
  metadata: any
}

interface AdaptiveCritiquePanelProps {
  videoId: string
  suggestions: Suggestion[]
  onOverride: (type: string, choice: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

export default function AdaptiveCritiquePanel({ videoId, suggestions, onOverride, showToast }: AdaptiveCritiquePanelProps) {
  const [learningFeedback, setLearningFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({})
  const [activeTab, setActiveTab] = useState<'current' | 'learned'>('current')

  const handleFeedback = async (suggestionId: string, type: string, action: 'positive' | 'negative', original: any) => {
    setLearningFeedback(prev => ({ ...prev, [suggestionId]: action }))
    
    try {
      await apiPost('/ai/adaptive/feedback', {
        videoId,
        type,
        suggestionId,
        action,
        original
      })
      
      showToast(
        action === 'positive' 
          ? "DNA alignment reinforced. Strategy locked." 
          : "System re-learning... adjusting niche manifolds.", 
        'success'
      )
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="lumina-card p-8 space-y-8 relative overflow-hidden group">
      {/* Background Pulse */}
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-emerald-500/10 blur-[80px] rounded-full animate-pulse" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/30 shadow-xl shadow-emerald-500/10">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Adaptive Learning Matrix</h3>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] mt-1 block">Live Niche Evolution Loop</span>
          </div>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setActiveTab('current')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'current' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Current AI
          </button>
          <button 
            onClick={() => setActiveTab('learned')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'learned' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            User DNA
          </button>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'current' ? (
            <motion.div
              key="current"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {suggestions.map((s) => (
                <div key={s.id} className="p-6 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-emerald-500/30 rounded-[2rem] transition-all flex items-center justify-between group/item">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-emerald-400 shadow-2xl">
                      {s.type === 'music' && <Music className="w-6 h-6" />}
                      {s.type === 'hook' && <Sparkles className="w-6 h-6" />}
                      {s.type === 'gif' && <Smile className="w-6 h-6" />}
                      {s.type === 'broll' && <Video className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tighter leading-none mb-2">
                        {s.title}
                        <span className="ml-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-[8px] text-emerald-400 tracking-widest">
                          {Math.round(s.confidence * 100)}% Match
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium italic max-w-sm">{s.reason}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleFeedback(s.id, s.type, 'positive', s)}
                      className={`p-3 rounded-xl border transition-all ${learningFeedback[s.id] === 'positive' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 text-slate-500 border-white/5 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleFeedback(s.id, s.type, 'negative', s)}
                      className={`p-3 rounded-xl border transition-all ${learningFeedback[s.id] === 'negative' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white/5 text-slate-500 border-white/5 hover:text-rose-400 hover:border-rose-500/30'}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </motion.button>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button 
                      onClick={() => onOverride(s.type, s)}
                      className="px-4 py-2 bg-white/10 hover:bg-white text-slate-400 hover:text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      Override
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="learned"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-10 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20 flex items-center justify-center mx-auto shadow-2xl">
                <Brain className="w-10 h-10 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Personal DNA Evolving</h4>
                <p className="text-xs text-slate-500 font-medium italic mt-2">CLICK has learned 4 stylistic nuances from your recent revisions.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Pacing Drift</span>
                  <p className="text-[10px] text-white font-black italic">+12% Energy Preference</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Vibe Cluster</span>
                  <p className="text-[10px] text-white font-black italic">Sarcastic / Witty Bias</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-emerald-400" />
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] italic">Continuous Learning Loop: ONLINE</p>
        </div>
        <button className="text-[9px] font-black text-white px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest">
          View Learning Logs
        </button>
      </div>
    </div>
  )
}
