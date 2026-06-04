'use client'

import React, { useEffect, useState } from 'react'
import AutonomousCreator from '../../../components/AutonomousCreator'
import IngestPanel from '../../../components/IngestPanel'
import { motion } from 'framer-motion'
import { Zap, Shield, Sparkles, Binary, Loader2, ArrowLeft, History, Cpu, Network, Gauge, RefreshCw, UploadCloud, CheckCircle2, FileText, Settings, Activity, Box, Monitor, Signal, ChevronRight, LayoutDashboard, BrainCircuit } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useRouter } from 'next/navigation'
import { useTranslation } from '../../../hooks/useTranslation'
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
  const { t } = useTranslation()
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
    document.title = t('forgePage.documentTitle')
    fetchHistory()
  }, [t])

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-10 max-w-[1900px] mx-auto space-y-16 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        <ToastContainer />

        {/* Tactical Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-12 border-b-2 border-surface-100 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-8 w-full lg:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} 
                title={t('forgePage.backToDashboard')} aria-label={t('forgePage.backToDashboard')}
                className="w-16 h-16 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500/30 transition-all shadow-xl active:scale-90 group">
                <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-24 h-24 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-2xl flex-shrink-0 group hover:rotate-12 transition-transform duration-700">
                <BrainCircuit size={48} className="text-primary-600 dark:text-primary-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-3 flex-wrap">
                    <span className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.3em] border-2 border-primary-500/20 shadow-inner italic leading-none">
                      {t('forgePage.intelligenceFactory')}
                    </span>
                    <div className="flex items-center gap-3 px-4 py-1.5 rounded-xl bg-surface-card dark:bg-surface-900 text-surface-500 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        {t('forgePage.coreEngineActive')}
                    </div>
                 </div>
                 <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none mt-4 truncate uppercase italic drop-shadow-2xl">{t('forgePage.title')}</h1>
              </div>
           </div>

           <div className="hidden xl:flex items-center gap-12">
              <div className="space-y-3 text-right">
                <p className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic leading-none">{t('forgePage.systemStatus')}</p>
                <div className="flex items-center justify-end gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                  <span className="text-base font-black text-surface-900 dark:text-white uppercase italic tracking-tighter">{t('forgePage.allSystemsOptimal')}</span>
                </div>
              </div>
              <div className="w-0.5 h-16 bg-surface-100 dark:bg-surface-800 rounded-full" />
              <div className="bg-surface-card dark:bg-surface-900 backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 px-10 py-5 rounded-[2.5rem] shadow-2xl group hover:border-primary-500/20 transition-all">
                <p className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.4em] mb-3 italic leading-none group-hover:text-primary-500">{t('forgePage.globalLatency')}</p>
                <p className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase tabular-nums">45.2 SEC</p>
              </div>
           </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 relative z-10">
          
          {/* Main Content Area */}
          <main className="xl:col-span-8 space-y-16">
            
            {/* Step 1: Ingest */}
            <section className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] sm:rounded-[5rem] p-10 sm:p-16 shadow-2xl transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><UploadCloud size={300} className="text-primary-500" /></div>
              <header className="flex flex-col sm:flex-row items-center gap-10 mb-16 border-b-2 border-surface-100 dark:border-surface-800 pb-12 relative z-10">
                <div className="w-20 h-20 rounded-[2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 dark:text-slate-800 group-hover:text-primary-500 group-hover:border-primary-500/30 transition-all shadow-inner group-hover:rotate-12">
                  <UploadCloud size={40} />
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-4">{t('forgePage.initializePayload')}</h2>
                  <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-widest leading-relaxed">{t('forgePage.initializePayloadDesc')}</p>
                </div>
              </header>
              <div className="relative z-10">
                <IngestPanel />
              </div>
            </section>

            {/* Step 2: Synthesis */}
            <section className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[4rem] sm:rounded-[5rem] p-10 sm:p-16 shadow-2xl transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000"><BrainCircuit size={300} className="text-primary-500" /></div>
              <header className="flex flex-col sm:flex-row items-center gap-10 mb-16 border-b-2 border-surface-100 dark:border-surface-800 pb-12 relative z-10">
                <div className="w-20 h-20 rounded-[2rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-xl group-hover:rotate-12 transition-all group-hover:border-primary-500/40">
                  <Settings size={40} />
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-4">{t('forgePage.synthesisHub')}</h2>
                  <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-widest leading-relaxed">{t('forgePage.synthesisHubDesc')}</p>
                </div>
              </header>
              <div className="relative z-10">
                <AutonomousCreator />
              </div>
            </section>
          </main>

          {/* Right Sidebar: History & Health */}
          <aside className="xl:col-span-4 space-y-12">
            
            {/* History Card */}
            <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3.5rem] sm:rounded-[4rem] p-10 shadow-2xl flex flex-col min-h-[700px] group transition-all duration-500 hover:shadow-[0_40px_100px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><History size={300} className="text-primary-500" /></div>
              
              <header className="flex items-center gap-8 mb-12 border-b-2 border-surface-100 dark:border-surface-800 pb-10 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform group-hover:border-primary-500/30">
                  <History size={32} className="text-surface-300 dark:text-slate-800 group-hover:text-primary-500 transition-colors" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-2">{t('forgePage.manifestArchive')}</h3>
                  <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic leading-none">{t('forgePage.recentFactoryYields')}</p>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto max-h-[750px] pr-4 custom-scrollbar relative z-10">
                {loadingHistory ? (
                  <div className="py-32 text-center space-y-8">
                    <div className="relative w-16 h-16 mx-auto">
                       <RefreshCw size={64} className="text-primary-500 animate-spin absolute inset-0" />
                       <div className="absolute inset-0 bg-primary-500/10 blur-xl rounded-full animate-pulse" />
                    </div>
                    <p className="text-[11px] font-black text-surface-400 uppercase tracking-[0.6em] animate-pulse italic">{t('forgePage.decodingHistory')}</p>
                  </div>
                ) : history.length > 0 ? (
                  history.map((item, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: idx * 0.05 }}
                      key={item._id} 
                      onClick={() => router.push(`/dashboard/video/edit/${item._id}`)}
                      className="p-8 rounded-[2.5rem] bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 hover:bg-surface-card dark:hover:bg-surface-900 transition-all cursor-pointer group/item shadow-inner backdrop-blur-xl relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <span className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.3em] italic group-hover/item:text-primary-500 transition-colors">
                          {t('forgePage.dateCycle', { date: new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() })}
                        </span>
                        <div className="px-4 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest italic shadow-sm">{t('forgePage.manifested')}</div>
                      </div>
                      <div className="flex items-start gap-6 relative z-10">
                         <div className="w-14 h-14 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-200 dark:text-slate-900 group-hover/item:text-primary-500 group-hover/item:border-primary-500/30 group-hover/item:rotate-12 transition-all shadow-md">
                            <FileText size={28} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-lg font-black text-surface-900 dark:text-white tracking-tight leading-tight uppercase italic group-hover/item:text-primary-500 transition-colors line-clamp-2">{item.title}</p>
                            <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest mt-2">{t('forgePage.idLabel', { id: item._id.slice(-8).toUpperCase() })}</p>
                         </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-48 text-center space-y-10 border-4 border-dashed border-surface-100 dark:border-surface-800 rounded-[3rem] bg-surface-page/50 dark:bg-surface-950/20 opacity-30">
                    <History size={80} className="text-surface-200 dark:text-slate-900 mx-auto" />
                    <p className="text-2xl font-black uppercase tracking-[0.8em] italic leading-none">{t('forgePage.nullHistory')}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={fetchHistory}
                title={t('forgePage.syncArchive')}
                aria-label={t('forgePage.syncArchive')}
                className="mt-12 w-full py-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] text-[12px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic hover:bg-surface-card hover:text-primary-500 hover:border-primary-500/40 transition-all flex items-center justify-center gap-6 shadow-inner active:scale-95 border-none relative z-10"
              >
                <RefreshCw size={20} className={loadingHistory ? 'animate-spin' : ''} />
                {t('forgePage.syncArchive')}
              </button>
            </div>

            {/* Engine Health HUD */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-10 relative z-10">
               <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] p-10 shadow-2xl transition-all duration-700 hover:border-primary-500/30 group relative overflow-hidden">
                 <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                 <div className="flex items-center justify-between mb-10 relative z-10">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="text-emerald-500" size={24} /></div>
                     <span className="text-[12px] font-black text-surface-900 dark:text-white uppercase tracking-[0.5em] italic">{t('forgePage.engineHealth')}</span>
                   </div>
                   <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                 </div>
                 <div className="space-y-8 relative z-10">
                   <div className="flex justify-between items-end">
                     <span className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.4em] italic">{t('forgePage.networkAvailability')}</span>
                     <span className="text-4xl font-black text-surface-900 dark:text-white italic tabular-nums leading-none drop-shadow-2xl">99.9%</span>
                   </div>
                   <div className="h-3.5 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-full overflow-hidden shadow-inner relative">
                     <motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} transition={{ duration: 2, ease: 'easeOut' }} className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                   </div>
                 </div>
               </div>

               <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] p-10 shadow-2xl transition-all duration-700 hover:border-primary-500/30 group relative overflow-hidden">
                 <div className="flex items-center gap-4 mb-10 relative z-10">
                   <div className="w-12 h-12 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center"><Activity className="text-primary-500" size={24} /></div>
                   <span className="text-[12px] font-black text-surface-900 dark:text-white uppercase tracking-[0.5em] italic">{t('forgePage.livePulse')}</span>
                 </div>
                 <div className="flex items-end gap-3 h-16 relative z-10 px-2">
                   {[...Array(20)].map((_, i) => (
                     <motion.div 
                       key={i} 
                       initial={{ height: '20%' }}
                       animate={{ height: [`${20 + Math.random() * 60}%`, `${40 + Math.random() * 60}%`, `${20 + Math.random() * 60}%`] }}
                       transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: 'easeInOut' }}
                       className="flex-1 bg-primary-500/20 group-hover:bg-primary-500/50 rounded-full shadow-sm transition-colors border border-primary-500/10"
                     />
                   ))}
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-t from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                 <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.6em] italic mt-8 text-center relative z-10 group-hover:text-primary-500 transition-colors">{t('forgePage.neuralTrafficMonitorActive')}</p>
               </div>
            </section>
          </aside>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 20px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.2); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
