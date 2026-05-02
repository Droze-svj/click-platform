'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Zap, Cpu, ArrowRight } from 'lucide-react'

interface Progress {
  videoId: string
  operation: string
  progress: number
  status: 'processing' | 'completed' | 'failed'
  message?: string
  estimatedTimeRemaining?: number
}

interface VideoProgressTrackerProps {
  videoId: string
  operation?: string
  jobId?: string
  onComplete?: (result: any) => void
  onError?: (error?: any) => void
  autonomousMode?: boolean
}

export default function VideoProgressTracker({ 
  videoId, 
  operation, 
  jobId, 
  onComplete, 
  onError,
  autonomousMode = true 
}: VideoProgressTrackerProps) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [failures, setFailures] = useState(0)

  useEffect(() => {
    if (!isPolling) return

    const pollProgress = async () => {
      try {
        let endpoint = (operation === 'export' && jobId) 
          ? `/api/export/${jobId}`
          : operation ? `/api/video/progress/${videoId}?operation=${operation}` : `/api/video/progress/${videoId}`;

        const response = await fetch(endpoint, { credentials: 'include' })

        if (!response.ok) {
          setFailures((n) => n + 1)
          return
        }

        const data = await response.json()
        if (data?.data) {
          setFailures(0)
          setProgress(data.data)

          if (data.data.status === 'completed' || data.data.status === 'failed') {
            setIsPolling(false)
            if (data.data.status === 'failed' && onError) onError(data.data)
            else if (onComplete) onComplete(data.data)
          }
        }
      } catch (error) {
        setFailures((n) => n + 1)
      }
    }

    pollProgress()
    const interval = setInterval(pollProgress, 1500) // Faster polling for snappier UI
    return () => clearInterval(interval)
  }, [videoId, operation, jobId, isPolling, onComplete, onError])

  useEffect(() => {
    if (failures >= 5) {
      setIsPolling(false)
      const errorData = { videoId, operation: operation || 'processing', progress: 0, status: 'failed' }
      setProgress(errorData as Progress)
      if (onError) onError(errorData)
    }
  }, [failures, videoId, operation, onError])

  if (!progress) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 rounded-2xl bg-surface-900 border border-surface-800 animate-pulse">
        <Cpu className="w-8 h-8 text-primary-500 mb-4 opacity-50" />
        <span className="text-sm font-bold tracking-widest text-surface-400 uppercase">Waking Neural Engine...</span>
      </div>
    )
  }

  const isComplete = progress.status === 'completed'
  const isFailed = progress.status === 'failed'
  const isProcessing = progress.status === 'processing'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
        isComplete ? 'bg-surface-900/50 border-emerald-500/30' : 
        isFailed ? 'bg-surface-900/50 border-rose-500/30' : 
        'bg-surface-950 border-primary-500/30 shadow-glow-primary'
      }`}
    >
      {/* Background Pulse Effect during Autonomous Processing */}
      {isProcessing && autonomousMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-secondary-500/10 to-primary-600/10 animate-[shimmer_2s_infinite] -z-10" />
      )}

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl flex items-center justify-center ${
              isComplete ? 'bg-emerald-500/20 text-emerald-400' :
              isFailed ? 'bg-rose-500/20 text-rose-400' :
              'bg-primary-500/20 text-primary-400 animate-pulse'
            }`}>
              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : 
               isFailed ? <XCircle className="w-5 h-5" /> : 
               <Zap className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-surface-50 uppercase tracking-wider">
                  {progress.operation || 'Autonomous AI Task'}
                </span>
                {autonomousMode && isProcessing && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-500/20 text-primary-400 uppercase tracking-widest border border-primary-500/30">
                    Auto-Pilot
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-surface-400 mt-0.5">
                {progress.message || 'Analyzing timeline nodes...'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <span className={`text-2xl font-black tabular-nums ${
              isComplete ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-primary-400'
            }`}>
              {Math.round(progress.progress)}<span className="text-sm opacity-50">%</span>
            </span>
            {progress.estimatedTimeRemaining && isProcessing && (
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {Math.ceil(progress.estimatedTimeRemaining / 1000)}s
              </span>
            )}
          </div>
        </div>

        {/* High-Contrast Progress Bar */}
        <div className="w-full bg-surface-900 rounded-full h-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.progress}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
            className={`h-full rounded-full relative ${
              isComplete ? 'bg-emerald-500' :
              isFailed ? 'bg-rose-500' :
              'bg-gradient-to-r from-primary-500 to-secondary-500'
            }`}
          >
            {isProcessing && (
              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1s_infinite]" />
            )}
          </motion.div>
        </div>

        {/* Autonomous Decision Feed */}
        <AnimatePresence>
          {isProcessing && autonomousMode && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-surface-800"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">
                <Cpu className="w-3 h-3" /> AI Decision Log
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-surface-300">
                  <ArrowRight className="w-3 h-3 text-primary-500" />
                  <span>{progress.message || "Executing spatial analysis on primary track..."}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
