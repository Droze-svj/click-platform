import React from 'react'
import { motion } from 'framer-motion'
import { 
  Zap, 
  Target, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  BrainCircuit, 
  Fingerprint, 
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Undo2
} from 'lucide-react'
import { StyleDNA, AgenticKPIs } from '../../../types/editor'

interface IntelligenceEngineViewProps {
  dna: StyleDNA
  history: any[]
}

const IntelligenceEngineView: React.FC<IntelligenceEngineViewProps> = ({ dna, history }) => {
  // Mock KPIs for the dashboard
  const kpis: AgenticKPIs = {
    agenticAcceptanceRate: 88,
    manualOverrideDelta: 8.2,
    reversionRate: 4.5,
    sessionUtilityScore: 92
  }

  const glassStyle = "bg-white/[0.03] backdrop-blur-3xl border border-white/10"

  return (
    <div className="flex flex-col gap-12 p-8 h-full overflow-y-auto custom-scrollbar">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Fingerprint className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Creator Style DNA</h1>
            <p className="text-slate-500 text-sm font-medium tracking-tight italic mt-1">Autonomous creator modeling &amp; agentic accuracy telemetry</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Style Persona Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${glassStyle} p-8 rounded-[3rem] col-span-1 flex flex-col gap-8 relative overflow-hidden group`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
             <Activity className="w-32 h-32 text-emerald-500" />
          </div>
          
          <div className="space-y-2">
             <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Style Snapshot: <span className="text-emerald-400">{dna.theme || 'Vlog'}</span></h3>
             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Identity Lock: 99.8% // Sentiment Drift: {dna.sentimentDrift}%</span>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-black uppercase italic">Pacing (CPM)</span>
              <span className="text-white font-black italic">{dna.cpm} cuts/min</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(dna.cpm * 5, 100)}%` }}
                 className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
               />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-black uppercase italic">Visual Density</span>
              <span className="text-white font-black italic">{dna.visualDensity} elements/min</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(dna.visualDensity * 10, 100)}%` }}
                 className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
               />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">
              AI has identified a preference for <span className="text-emerald-400 font-bold">rapid-fire jump cuts</span> and <span className="text-emerald-400 font-bold">minimalist graphics</span>. Suggestions are being tailored to your specific timing signature.
            </p>
          </div>
        </motion.div>

        {/* Agentic Accuracy KPIs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${glassStyle} p-8 rounded-[3rem] col-span-2 grid grid-cols-2 gap-8 relative overflow-hidden group`}
        >
          <div className="col-span-2 border-b border-white/5 pb-4 flex items-center justify-between">
             <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Agentic Performance Ledger</h3>
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase italic">Verified AI Agency</span>
             </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-slate-500 uppercase italic">Acceptance Rate (AAR)</span>
            </div>
            <div className="text-4xl font-black text-white tracking-tighter italic">{kpis.agenticAcceptanceRate}%</div>
            <p className="text-[9px] text-slate-500 font-medium italic">High alignment with your creative vision.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black text-slate-500 uppercase italic">Override Delta (MOD)</span>
            </div>
            <div className="text-4xl font-black text-white tracking-tighter italic">{kpis.manualOverrideDelta}%</div>
            <p className="text-[9px] text-slate-500 font-medium italic">Minimal friction in AI-assisted workflows.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Undo2 className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-black text-slate-500 uppercase italic">Reversion Rate (Undo)</span>
            </div>
            <div className="text-4xl font-black text-white tracking-tighter italic">{kpis.reversionRate}%</div>
            <p className="text-[9px] text-slate-500 font-medium italic">Accuracy threshold is within elite parameters.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black text-slate-500 uppercase italic">Utility Score</span>
            </div>
            <div className="text-4xl font-black text-emerald-400 tracking-tighter italic">{kpis.sessionUtilityScore}/100</div>
            <p className="text-[9px] text-slate-500 font-medium italic">Net efficiency gain for this session.</p>
          </div>
        </motion.div>
      </div>

      {/* Algorithmic Feedback Loop */}
      <div className={`${glassStyle} p-12 rounded-[4rem] relative overflow-hidden group`}>
        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
           <TrendingUp className="w-64 h-64 text-indigo-500" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-6">
               <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                  <BrainCircuit className="w-10 h-10 text-indigo-400 animate-pulse-slow" />
               </div>
               <div>
                  <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Algorithmic Correlation</h2>
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 block italic">Cross-Platform Retention Insights</span>
               </div>
            </div>
            <p className="text-slate-500 text-xl font-medium tracking-tight italic">
              Your &quot;DNA&quot; is being cross-referenced with <span className="text-white font-black underline decoration-indigo-500/30 underline-offset-8">TikTok &amp; YouTube</span> retention matrices to predict engagement before you export.
            </p>
          </div>

          <div className="flex flex-col gap-4 min-w-[300px]">
             <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 group-hover:bg-indigo-500/10 transition-all">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest italic">Retention Winner</span>
                   <TrendingUp className="w-3 h-3 text-indigo-400" />
                </div>
                <p className="text-xs text-white font-black italic">&quot;120% zoom at 0:02 improves retention by 14%&quot;</p>
             </div>
             
             <div className="p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/10 group-hover:bg-rose-500/10 transition-all">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest italic">Drop-off Risk</span>
                   <BarChart3 className="w-3 h-3 text-rose-400" />
                </div>
                <p className="text-xs text-white font-black italic">&quot;Semantic keyword &apos;Algorithm&apos; causing 8% drop-off.&quot;</p>
             </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
           {['TikTok Hook', 'YouTube Pacing', 'IG Visual Density', 'Shorts Synergy'].map((insight) => (
              <div key={insight} className="px-6 py-4 rounded-full bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer">
                 <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">{insight}</span>
                 <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              </div>
           ))}
        </div>
      </div>
    </div>
  )
}

export default IntelligenceEngineView
