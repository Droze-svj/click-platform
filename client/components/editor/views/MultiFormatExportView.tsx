'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Smartphone, 
  Monitor, 
  Square, 
  Zap, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Share2,
  Sparkles,
  Play,
  History
} from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface MultiFormatExportViewProps {
  videoId: string
  onComplete?: () => void
}

interface ExportProfile {
  id: string
  label: string
  icon: any
  aspect: string
  description: string
  color: string
}

const PROFILES: ExportProfile[] = [
  { 
    id: '9:16', 
    label: 'Vertical Video', 
    icon: Smartphone, 
    aspect: '9:16', 
    description: 'Perfect for TikTok, Reels, and Shorts', 
    color: 'from-fuchsia-500 to-rose-500' 
  },
  { 
    id: '1:1', 
    label: 'Square Clip', 
    icon: Square, 
    aspect: '1:1', 
    description: 'Instagram Feed & Square platforms', 
    color: 'from-blue-500 to-indigo-500' 
  },
  { 
    id: '16:9', 
    label: 'Standard Wide', 
    icon: Monitor, 
    aspect: '16:9', 
    description: 'YouTube Landscape & Standard Video', 
    color: 'from-emerald-500 to-teal-500' 
  },
]

export const MultiFormatExportView: React.FC<MultiFormatExportViewProps> = ({ videoId, onComplete }) => {
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['9:16', '1:1', '16:9'])
  const [isExporting, setIsExporting] = useState(false)
  const [exportResults, setExportResults] = useState<any[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})

  const toggleFormat = (id: string) => {
    setSelectedFormats(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const handleStartBatch = async () => {
    if (selectedFormats.length === 0) {
      toast.error('Logic Error: No formats selected for synthesis')
      return
    }

    setIsExporting(true)
    try {
      const response = await axios.post('/api/export/batch', {
        videoId,
        formatIds: selectedFormats,
        options: { autoVault: true }
      })

      setExportResults(response.data.data.results)
      toast.success('Batch export started')
      
      // Simulate/poll progress for each job (simplified for UX demo)
      selectedFormats.forEach(formatId => {
        let p = 0
        const interval = setInterval(() => {
          p += Math.random() * 5
          if (p >= 100) {
            p = 100
            clearInterval(interval)
          }
          setProgress(prev => ({ ...prev, [formatId]: p }))
        }, 800)
      })

    } catch (error: any) {
      toast.error('Synthesis Interrupted: ' + (error.response?.data?.message || error.message))
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black uppercase tracking-[0.4em] italic text-indigo-400 w-fit shadow-2xl">
            <Zap className="w-4 h-4 animate-pulse" />
            Social Repurpose Hub
          </div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase">
            NEURAL_BATCH SYNTHESIS <span className="text-indigo-500">2.0</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
            Automatically adapt your project into multiple industry-standard formats simultaneously using the 
            Neural Refit core. Assets are registered in the <span className="text-indigo-400 font-black">Social Vault</span> as they complete.
          </p>
        </div>

        {/* Format Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROFILES.map((profile) => {
            const isSelected = selectedFormats.includes(profile.id)
            const Icon = profile.icon
            const currentProgress = progress[profile.id] || 0

            return (
              <motion.button
                key={profile.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isExporting && toggleFormat(profile.id)}
                className={`relative overflow-hidden rounded-[2.5rem] border-2 transition-all p-8 text-left ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-3xl shadow-indigo-500/20' 
                    : 'border-white/5 bg-white/20 hover:border-white/20'
                } ${isExporting ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {/* Background Aspect Ratio Indicator */}
                <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 flex items-center justify-center p-8 transition-transform duration-1000 ${isSelected ? 'scale-125' : 'scale-75'}`}>
                   <Icon className="w-full h-full" />
                </div>

                <div className="relative z-10 space-y-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${profile.color} shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{profile.label}</h3>
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mt-1">Aspect: {profile.aspect}</p>
                  </div>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">{profile.description}</p>
                  
                  {isSelected && (
                    <div className="absolute top-6 right-6">
                      <CheckCircle2 className="w-6 h-6 text-indigo-500" />
                    </div>
                  )}

                  {/* Progress Bar for active export */}
                  {isExporting && isSelected && (
                    <div className="mt-4 space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase italic tracking-widest">
                          <span className="text-slate-500">Synthesizing...</span>
                          <span className="text-indigo-400">{Math.round(currentProgress)}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${currentProgress}%` }}
                            className="h-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" 
                          />
                       </div>
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between p-10 rounded-[3rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent group-hover:opacity-100 opacity-0 transition-opacity duration-1000" />
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-white text-2xl font-black italic tracking-tighter uppercase">Ready for Deployment</span>
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                {selectedFormats.length} Formats Queued • Automatic Vault Sync Active
              </span>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-4">
             <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isExporting || selectedFormats.length === 0}
              onClick={handleStartBatch}
              className={`h-16 px-10 rounded-2xl flex items-center gap-4 text-white font-black uppercase italic tracking-[0.2em] transition-all ${
                isExporting 
                  ? 'bg-slate-700 opacity-50 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-white hover:text-black shadow-3xl shadow-indigo-600/40 border border-white/20'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Synthesis in Progress
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  Initialize Batch Dispatch
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Success States / Vault Integration Placeholder */}
        <AnimatePresence>
          {exportResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="px-6 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-4 text-emerald-400">
                   <Share2 className="w-5 h-5" />
                   <span className="text-[11px] font-black uppercase tracking-widest">Syncing to Social Vault...</span>
                </div>
                <button className="text-[10px] font-black text-white hover:text-emerald-400 uppercase italic tracking-widest transition-colors flex items-center gap-2">
                  View Vault <History className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
