'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
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
  UserCheck, Key, Anchor, ChevronRight, Sparkle
} from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { CardSkeleton } from '../../../components/LoadingSkeleton';
import ToastContainer from '../../../components/ToastContainer';

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

export default function CognitiveLogicMatrixPage() {
  const router = useRouter();
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
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Persistent Neural Background */}
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
           <Brain size={1000} className="text-white absolute -top-40 -left-60 -rotate-12 blur-[1px]" />
           <Hexagon size={1200} className="text-white absolute -bottom-80 -right-60 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Cognitive Header Hub */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <div className="w-24 h-24 bg-violet-500/5 border-2 border-violet-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(139,92,246,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent opacity-100" />
                <Brain size={48} className="text-violet-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Binary size={14} className="text-violet-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-violet-400 italic leading-none">Logic Matrix v12.4.1</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                       <Shield size={12} className="text-emerald-400 animate-pulse" />
                       <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">PARADIGM_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-2 drop-shadow-2xl">Cognitive</h1>
                 <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.4em] italic leading-none mt-4">Advanced neural-logic tools for meta-cognitive content orchestration and temporal forecasting.</p>
              </div>
           </div>

           <div className="flex items-center gap-10">
              <div className="flex items-center gap-6 p-4 rounded-[4rem] bg-white/[0.02] border border-white/10 shadow-[0_60px_200px_rgba(0,0,0,1)] relative z-10 backdrop-blur-3xl bg-black/40">
                 {[
                   { id: 'overview', label: 'NEURAL_OVERVIEW', icon: Activity },
                   { id: 'models', label: 'LOGIC_PARADIGMS', icon: Cpu },
                   { id: 'recommendations', label: 'HEURISTIC_SYNTHESIS', icon: Sparkles },
                   { id: 'analytics', label: 'TEMPORAL_FORECASTS', icon: TrendingUp }
                 ].map(tab => (
                   <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                     className={`flex items-center gap-4 px-12 py-5 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.3em] transition-all duration-1000 italic active:scale-95 border-2 ${
                       activeTab === tab.id 
                       ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' 
                       : 'text-slate-700 border-transparent hover:text-white hover:bg-white/[0.04]'
                     }`}
                   >
                     <tab.icon size={20} className={activeTab === tab.id ? 'text-black' : 'text-slate-800'} />
                     {tab.label}
                   </button>
                 ))}
              </div>
           </div>
        </header>

        <ErrorBoundary>
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, scale: 0.98, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.02, y: -50 }} transition={{ duration: 0.8 }} className="space-y-16">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                    <ParadigmCard 
                      icon={Cpu} 
                      title="Logic Paradigms" 
                      desc="Deploy and calibrate multiple neural logic providers for distributed inference tasks."
                      buttonText="DEPLOY_MODEL"
                      onClick={() => setActiveTab('models')}
                      color="violet"
                    />
                    <ParadigmCard 
                      icon={Sparkle} 
                      title="Heuristic Synthesis" 
                      desc="Personalized recursive content ideation based on historical node resonance mapping."
                      buttonText="INIT_IDEATION"
                      onClick={() => setActiveTab('recommendations')}
                      color="emerald"
                    />
                    <ParadigmCard 
                      icon={BarChart3} 
                      title="Temporal Forecasts" 
                      desc="Simulate and predict content trajectory efficiency before global mission deployment."
                      buttonText="RUN_SIMULATION"
                      onClick={() => setActiveTab('analytics')}
                      color="indigo"
                    />
                  </div>

                  {/* Operational HUD Area */}
                  <div className={`${glassStyle} rounded-[6rem] p-24 border-white/5 relative overflow-hidden group shadow-[0_100px_300px_rgba(0,0,0,1)] bg-black/40`}>
                     <div className="absolute inset-0 bg-violet-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-[3s]" />
                     <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
                        <div className="flex items-center gap-10">
                           <div className="w-20 h-20 rounded-[2.5rem] bg-violet-500/5 border-2 border-violet-500/20 flex items-center justify-center animate-pulse shadow-3xl group-hover:rotate-12 transition-transform duration-1000">
                              <Radio size={40} className="text-violet-500" />
                           </div>
                           <div>
                              <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Neural Surveillance</h3>
                              <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none border-l-4 border-violet-500/20 pl-8 ml-4">Real-time inference tracking and cognitive load monitoring.</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-10">
                           <div className="px-10 py-4 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic opacity-40">SWARM_SYNC_LATENCY:</span>
                              <span className="text-[15px] font-black text-violet-400 italic tabular-nums ml-4 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]">32μs</span>
                           </div>
                           <button className="px-12 py-5 bg-white text-black font-black uppercase text-[12px] tracking-[0.6em] italic rounded-[3rem] hover:bg-violet-600 hover:text-white transition-all duration-1000 shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-90 border-none">
                              FORCE_CALIBRATION
                           </button>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-4 gap-8 mt-20 relative z-10">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="p-10 rounded-[4rem] bg-black/60 border-2 border-white/5 hover:border-violet-500/30 transition-all duration-1000 group/monitor shadow-inner flex flex-col items-center gap-6">
                             <div className="w-14 h-14 rounded-2xl bg-violet-500/5 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform duration-[1.5s]"><Orbit size={28} className="animate-spin-slow" /></div>
                             <div className="text-center">
                                <p className="text-[10px] font-black text-slate-950 uppercase italic leading-none mb-3">SECTOR_0{i+1}_LOAD</p>
                                <p className="text-4xl font-black italic text-white tabular-nums leading-none tracking-tighter">{(80 + Math.random() * 15).toFixed(1)}%</p>
                             </div>
                             <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                <motion.div animate={{ width: `${80 + Math.random() * 15}%` }} className="h-full bg-violet-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
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
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .animate-spin-slow { animation: spin 20s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}

function ParadigmCard({ icon: Icon, title, desc, buttonText, onClick, color }: { icon: any; title: string; desc: string; buttonText: string; onClick: () => void; color: string }) {
  const colorClasses = {
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:border-violet-500/40',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40',
  }[color as 'violet' | 'emerald' | 'indigo']

  const btnClasses = {
    violet: 'hover:bg-violet-600',
    emerald: 'hover:bg-emerald-600',
    indigo: 'hover:bg-indigo-600',
  }[color as 'violet' | 'emerald' | 'indigo']

  return (
    <motion.div whileHover={{ y: -15, scale: 1.02 }} className={`${glassStyle} p-16 rounded-[5rem] group bg-black/40 border-white/5 relative overflow-hidden flex flex-col h-[400px] justify-between shadow-[0_60px_150px_rgba(0,0,0,0.8)]`}>
       <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-1000 -rotate-12 scale-150 pointer-events-none group-hover:scale-[2]"><Icon size={200} /></div>
       
       <div className="relative z-10 px-4">
          <div className={`w-28 h-28 rounded-[3.5rem] ${colorClasses} border-2 flex items-center justify-center mb-12 shadow-3xl group-hover:rotate-12 transition-all duration-1000 scale-110`}>
             <Icon size={48} className="drop-shadow-2xl animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-6 drop-shadow-2xl">{title}</h2>
          <p className="text-[13px] font-black text-slate-800 uppercase tracking-widest italic leading-relaxed opacity-60 group-hover:text-white group-hover:opacity-100 transition-all duration-700">
             {desc}
          </p>
       </div>

       <div className="relative z-10 px-4 pb-4">
          <button onClick={onClick} className={`w-full py-8 bg-white/[0.03] border-2 border-white/10 text-white font-black uppercase text-[12px] tracking-[0.6em] italic rounded-[3rem] transition-all duration-1000 group-hover:bg-white group-hover:text-black group-hover:scale-105 active:scale-95 shadow-2xl flex items-center justify-center gap-6`}>
             <ChevronRight size={24} className="group-hover:translate-x-4 transition-transform duration-1000" /> {buttonText}
          </button>
       </div>
    </motion.div>
  )
}
