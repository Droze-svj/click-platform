'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import AIMultiModelSelector from '../../../components/AIMultiModelSelector';
import AIRecommendations from '../../../components/AIRecommendations';
import PredictiveAnalytics from '../../../components/PredictiveAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { 
  Brain, TrendingUp, Sparkles, BarChart3, Fingerprint, 
  Cpu, Zap, Shield, Wand2, Monitor, Activity, Radio,
  Hexagon, Workflow, Binary, Orbit, Scan, Terminal,
  Network, Command, Box, Wind, Ghost, Signal, ShieldAlert,
  UserCheck, Key, Anchor, ChevronRight, Sparkle, ArrowLeft, RefreshCw
} from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { CardSkeleton } from '../../../components/LoadingSkeleton';
import ToastContainer from '../../../components/ToastContainer';

export default function CognitiveLogicMatrixPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!user && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [user, router]);

  if (!isClient || !user) {
    return (
       <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
          <Brain size={80} className="text-primary-500 animate-spin mb-12" />
          <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic">{t('aiPage.loading')}</p>
       </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full lg:w-auto min-w-0">
              <button type="button" onClick={() => router.push('/dashboard')} title={t('aiPage.backToDashboard')} aria-label={t('aiPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                <ArrowLeft size={24} />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Brain size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('aiPage.neuralEngineBadge')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        {t('aiPage.paradigmStable')}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('aiPage.title')}</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full lg:w-auto">
              <div className="flex items-center gap-2 p-2 rounded-[2rem] bg-surface-card border-2 border-surface-100 dark:border-surface-800 shadow-2xl relative z-10 backdrop-blur-3xl overflow-x-auto max-w-full custom-scrollbar">
                 {[
                   { id: 'overview', label: t('aiPage.tabOverview'), icon: Activity },
                   { id: 'models', label: t('aiPage.tabModels'), icon: Cpu },
                   { id: 'recommendations', label: t('aiPage.tabSynthesis'), icon: Sparkles },
                   { id: 'analytics', label: t('aiPage.tabForecasts'), icon: TrendingUp }
                 ].map(tab => (
                   <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
                     className={`flex items-center gap-4 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-500 italic active:scale-95 whitespace-nowrap ${
                       activeTab === tab.id 
                       ? 'bg-surface-900 dark:bg-white text-white dark:text-black shadow-xl scale-105' 
                       : 'text-surface-400 dark:text-slate-700 hover:text-surface-900 dark:hover:text-white'
                     }`}
                   >
                     <tab.icon size={18} />
                     {tab.label}
                   </button>
                 ))}
              </div>
              <button type="button" onClick={() => window.location.reload()} title={t('aiPage.reloadParadigms')} aria-label={t('aiPage.reloadParadigms')} className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90">
                 <RefreshCw size={28} />
              </button>
           </div>
        </header>

        <ErrorBoundary>
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, scale: 0.98, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.02, y: -50 }} transition={{ duration: 0.8 }} className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <ParadigmCard
                      icon={Cpu}
                      title={t('aiPage.cardLogicTitle')}
                      desc={t('aiPage.cardLogicDesc')}
                      buttonText={t('aiPage.cardLogicButton')}
                      onClick={() => setActiveTab('models')}
                      color="violet"
                    />
                    <ParadigmCard
                      icon={Sparkle}
                      title={t('aiPage.cardSynthesisTitle')}
                      desc={t('aiPage.cardSynthesisDesc')}
                      buttonText={t('aiPage.cardSynthesisButton')}
                      onClick={() => setActiveTab('recommendations')}
                      color="emerald"
                    />
                    <ParadigmCard
                      icon={BarChart3}
                      title={t('aiPage.cardForecastsTitle')}
                      desc={t('aiPage.cardForecastsDesc')}
                      buttonText={t('aiPage.cardForecastsButton')}
                      onClick={() => setActiveTab('analytics')}
                      color="indigo"
                    />
                  </div>

                  {/* Operational HUD Area */}
                  <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
                     <div className="absolute inset-0 bg-primary-500/[0.01] pointer-events-none group-hover:opacity-100 transition-opacity duration-1000" />
                     <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10 border-b-2 border-surface-100 dark:border-surface-800 pb-12">
                        <div className="flex items-center gap-8">
                           <div className="w-20 h-20 rounded-[2.5rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
                              <Radio size={40} className="text-primary-500 animate-pulse" />
                           </div>
                           <div>
                              <h3 className="text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-3">{t('aiPage.surveillanceTitle')}</h3>
                              <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.5em] italic leading-none">{t('aiPage.surveillanceSubtitle')}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-8">
                           <div className="px-10 py-5 rounded-[2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 shadow-inner">
                              <span className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none">{t('aiPage.swarmLatency')}</span>
                              <span className="text-xl font-black text-primary-500 italic tabular-nums ml-4 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)] leading-none">—</span>
                           </div>
                           <button className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.6em] italic rounded-[2rem] hover:bg-primary-500 hover:text-white transition-all duration-500 shadow-2xl active:scale-95 border-none">
                              {t('aiPage.forceCalibration')}
                           </button>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12 relative z-10">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="p-10 rounded-[3rem] bg-surface-page/50 dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 transition-all duration-500 group/monitor shadow-inner flex flex-col items-center gap-8 backdrop-blur-xl">
                             <div className="w-16 h-16 rounded-[1.8rem] bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 group-hover/monitor:rotate-12 transition-all duration-500 shadow-lg"><Orbit size={32} className="animate-spin-slow" /></div>
                             <div className="text-center">
                                <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase italic leading-none mb-3">{t('aiPage.sectorLoad', { n: i + 1 })}</p>
                                <p className="text-4xl font-black italic text-surface-900 dark:text-white tabular-nums leading-none tracking-tighter">—</p>
                             </div>
                             <div className="w-full h-3 bg-surface-card dark:bg-surface-900 rounded-full overflow-hidden border-2 border-surface-100 dark:border-surface-800 p-0.5">
                                <div className="h-full w-0 bg-primary-500 rounded-full" />
                             </div>
                          </div>
                        ))}
                     </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'models' && (
                <motion.div key="models" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.8 }}>
                  <Suspense fallback={<CardSkeleton />}>
                    <AIMultiModelSelector />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'recommendations' && (
                <motion.div key="recommendations" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.8 }}>
                  <Suspense fallback={<CardSkeleton />}>
                    <AIRecommendations />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div key="analytics" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.8 }}>
                  <Suspense fallback={<CardSkeleton />}>
                    <PredictiveAnalytics />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ErrorBoundary>

        <style jsx global>{`
          .animate-spin-slow { animation: spin 20s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}

function ParadigmCard({ icon: Icon, title, desc, buttonText, onClick, color }: { icon: any; title: string; desc: string; buttonText: string; onClick: () => void; color: string }) {
  const colorClasses = {
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20 group-hover:border-violet-500/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20 group-hover:border-indigo-500/40',
  }[color as 'violet' | 'emerald' | 'indigo']

  const accentColor = {
    violet: 'bg-violet-600',
    emerald: 'bg-emerald-600',
    indigo: 'bg-indigo-600',
  }[color as 'violet' | 'emerald' | 'indigo']

  return (
    <motion.div whileHover={{ y: -15, scale: 1.02 }} className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] p-12 sm:p-14 group relative overflow-hidden flex flex-col h-[480px] justify-between shadow-2xl transition-all duration-500 hover:shadow-[0_60px_150px_rgba(0,0,0,0.5)]">
       <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.08] transition-opacity duration-1000 -rotate-12 scale-150 pointer-events-none group-hover:scale-[2]"><Icon size={250} /></div>
       
       <div className="relative z-10">
          <div className={`w-24 h-24 rounded-[2.5rem] ${colorClasses} border-2 flex items-center justify-center mb-12 shadow-xl group-hover:rotate-12 transition-all duration-500`}>
             <Icon size={40} className="animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-6 group-hover:text-primary-500 transition-colors">{title}</h2>
          <p className="text-sm font-bold text-surface-400 dark:text-slate-600 uppercase tracking-widest italic leading-relaxed mb-10 group-hover:text-surface-900 dark:group-hover:text-white transition-all duration-700">
             {desc}
          </p>
       </div>

       <div className="relative z-10">
          <button type="button" onClick={onClick} className="w-full py-6 bg-surface-page dark:bg-surface-950/50 border-2 border-surface-100 dark:border-surface-800 text-surface-900 dark:text-white font-black uppercase text-[11px] tracking-[0.6em] italic rounded-[2rem] transition-all duration-500 group-hover:bg-surface-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black group-hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-6 border-none">
             {buttonText} <ChevronRight size={22} className="group-hover:translate-x-4 transition-transform duration-500" />
          </button>
       </div>
    </motion.div>
  )
}
