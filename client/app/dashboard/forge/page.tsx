'use client'

import React, { useEffect, useState } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import IngestPanel from '../../../components/IngestPanel'
import { motion } from 'framer-motion'
import { Zap, Shield, Sparkles, Binary, Loader2, ArrowLeft, History, Cpu, Network, Gauge, RefreshCw, UploadCloud, CheckCircle2, FileText, Settings, Activity } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

interface ManifestHistory {
  _id: string;
  title: string;
  topic: string;
  createdAt: string;
  metadata: {
    hooks: any[];
    hashtags: string[];
  };
}

export default function OneClickForgePage() {
  const router = useRouter()
  const [history, setHistory] = useState<ManifestHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true)
      const res = await apiGet('/intelligence/factory/history')
      if (res.success) {
        setHistory(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    document.title = 'AI Content Creator | Click'
    fetchHistory()
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10 space-y-10">
          
          {/* Header */}
          <header className="flex flex-col lg:flex-row items-center justify-between gap-6 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <button onClick={() => router.push('/dashboard')} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <Sparkles size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    Content Engine
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">AI Video Creator</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium max-w-xl leading-relaxed">
                  Transform a single prompt or source material into a platform-ready video with automated hooks, captions, and b-roll.
                </p>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-8">
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">System Status</p>
                <div className="flex items-center justify-end gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold text-surface-900 dark:text-white">All Systems Operational</span>
                </div>
              </div>
              <div className="w-px h-10 bg-surface-200 dark:bg-surface-800" />
              <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 px-5 py-2.5 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Average Generation Time</p>
                <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight">45 seconds</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            
            {/* Left Content: Ingest & Creator */}
            <div className="xl:col-span-8 space-y-10">
              
              {/* Step 1: Ingest */}
              <section className="space-y-6">
                <div className="flex items-center gap-4 pb-2 border-b border-surface-200 dark:border-surface-800">
                  <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">Step 1: Provide Source Material</h2>
                    <p className="text-sm font-medium text-surface-500 mt-1">Upload a video, enter a URL, or start from scratch with a prompt.</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 shadow-sm">
                  <IngestPanel />
                </div>
              </section>

              {/* Step 2: Synthesis */}
              <section className="space-y-6">
                <div className="flex items-center gap-4 pb-2 border-b border-surface-200 dark:border-surface-800">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">Step 2: Configure Generator</h2>
                    <p className="text-sm font-medium text-surface-500 mt-1">Set the visual style, pacing, and AI parameters for your final video.</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 shadow-sm">
                  <AutonomousCreator />
                </div>
              </section>
            </div>

            {/* Right Sidebar: History & Health */}
            <div className="xl:col-span-4 space-y-8">
              
              {/* History Card */}
              <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm flex flex-col min-h-[500px]">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center">
                    <History size={24} className="text-surface-600 dark:text-surface-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">Recent Generations</h3>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mt-1">Project History</p>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                  {loadingHistory ? (
                    <div className="py-20 text-center space-y-4">
                      <Loader2 size={32} className="text-primary-500 animate-spin mx-auto" />
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Loading history...</p>
                    </div>
                  ) : history.length > 0 ? (
                    history.map((item) => (
                      <div key={item._id} className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <div className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[9px] font-bold uppercase tracking-wider">COMPLETED</div>
                        </div>
                        <div className="flex items-start gap-3">
                           <FileText size={16} className="text-surface-400 mt-1 shrink-0 group-hover:text-primary-500 transition-colors" />
                           <p className="text-sm font-bold text-surface-900 dark:text-white tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">{item.title}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center space-y-4 border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50 dark:bg-surface-950">
                      <History size={40} className="text-surface-300 dark:text-surface-700 mx-auto" />
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">No history found</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={fetchHistory}
                  className="mt-6 w-full py-4 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl text-xs font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <RefreshCw size={16} className={loadingHistory ? 'animate-spin' : ''} />
                  Refresh History
                </button>
              </div>

              {/* Status Modules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-6">
                 {/* Engine Health Card */}
                 <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-2">
                       <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={18} />
                       <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">Engine Health</span>
                     </div>
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   </div>
                   <div className="space-y-4">
                     <div className="flex justify-between items-end">
                       <span className="text-[10px] font-bold text-surface-500 uppercase">Availability</span>
                       <span className="text-lg font-black text-surface-900 dark:text-white tabular-nums leading-none">99.9%</span>
                     </div>
                     <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full bg-emerald-500" />
                     </div>
                   </div>
                 </div>

                 {/* Resource Pulse */}
                 <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 shadow-sm">
                   <div className="flex items-center gap-2 mb-6">
                     <Activity className="text-primary-600 dark:text-primary-400" size={18} />
                     <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">Live Activity</span>
                   </div>
                   <div className="flex items-end gap-1.5 h-10">
                     {[...Array(12)].map((_, i) => (
                       <motion.div 
                         key={i} 
                         initial={{ height: '20%' }}
                         animate={{ height: [`${20 + Math.random() * 60}%`, `${30 + Math.random() * 70}%`, `${20 + Math.random() * 60}%`] }}
                         transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: 'easeInOut' }}
                         className="flex-1 bg-primary-100 dark:bg-primary-900/30 rounded-sm"
                       />
                     ))}
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: rgba(156, 163, 175, 0.3); 
            border-radius: 10px; 
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(156, 163, 175, 0.5); 
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
