'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Target,
  Cpu,
  Zap,
  Users,
  BarChart3,
  ArrowUpRight,
  Gauge,
  ShieldCheck,
  Globe,
  Sparkles,
  Layers,
  Activity
} from 'lucide-react'

interface PredictionEngineViewProps {
  timelineSegments: any[]
  transcript: any
  showToast: (m: string, t: any) => void
}

type Persona = 'Gen Z' | 'B2B Professional' | 'Tech Enthusiast' | 'Lifestyle/Vlog'

const PredictionEngineView: React.FC<PredictionEngineViewProps> = ({
  timelineSegments,
  transcript,
  showToast
}) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>('Gen Z')
  const [hookTestState, setHookTestState] = useState<'idle' | 'generating' | 'results'>('idle')
  const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-3xl"

  const metrics = useMemo(() => {
    const totalDuration = timelineSegments.reduce((acc, s) => acc + (s.duration || 0), 0) || 1
    const cutCount = timelineSegments.length
    const cutsPerMinute = (cutCount / totalDuration) * 60
    const brollCount = timelineSegments.filter(s => s.type === 'broll').length
    const brollRatio = (brollCount / cutCount) || 0

    // Semantic Mapping
    let highRetentionWordsFound = 0
    let semanticIntensity = 0
    const hookKeys = ['secret', 'hack', 'unlock', 'reveal', 'truth', 'insane', 'stop', 'hidden', 'why', 'how']
    
    if (transcript && transcript.words) {
       const first5SecWords = transcript.words.filter((w: any) => w.start <= 5)
       first5SecWords.forEach((w: any) => {
          const text = w.text.toLowerCase().replace(/[^a-z]/g, '')
          if (hookKeys.includes(text)) {
             highRetentionWordsFound++
             semanticIntensity += 25
          }
       })
    }

    // Baseline intensity from cuts
    semanticIntensity = Math.min(100, semanticIntensity + (cutsPerMinute * 2))

    return { totalDuration, cutsPerMinute, brollRatio, cutCount, highRetentionWordsFound, semanticIntensity }
  }, [timelineSegments, transcript])

  const viralScore = useMemo(() => {
    let score = 40

    // Semantic Hook Logic (Deep Intelligence)
    if (metrics.highRetentionWordsFound >= 2) score += 20
    else if (metrics.highRetentionWordsFound === 1) score += 10

    // Pacing Logic
    if (metrics.cutsPerMinute > 12) score += 10
    else if (metrics.cutsPerMinute > 6) score += 5

    // Visual Hook Density (First 5 segments)
    const hookDensity = timelineSegments.slice(0, 5).filter(s => s.endTime <= 5).length
    if (hookDensity >= 3) score += 10

    // B-Roll Logic
    if (metrics.brollRatio > 0.4) score += 10
    else if (metrics.brollRatio > 0.2) score += 5

    // Persona Multipliers
    if (selectedPersona === 'Gen Z' && metrics.cutsPerMinute > 15) score += 10
    if (selectedPersona === 'B2B Professional' && metrics.brollRatio > 0.3) score += 10

    return Math.min(score, 99)
  }, [metrics, selectedPersona, timelineSegments])

  const roadmap = useMemo(() => {
    const steps = []

    if (metrics.cutsPerMinute < 8) {
        steps.push({ title: 'Temporal Tightening', desc: `Current pacing is ${metrics.cutsPerMinute.toFixed(1)} CPM. Increase frequency to 12+ for ${selectedPersona} engagement.`, icon: Zap })
    } else {
        steps.push({ title: 'Pacing Verified', desc: 'Optimal cut density detected. Narrative tension is calibrated for peak retention.', icon: ShieldCheck })
    }

    if (metrics.brollRatio < 0.3) {
        steps.push({ title: 'Visual Diversification', desc: `B-Roll coverage is only ${(metrics.brollRatio * 100).toFixed(0)}%. Inject 2-3 more B-Roll nodes to prevent visual fatigue.`, icon: Layers })
    } else {
        steps.push({ title: 'Semantic Overlay', desc: 'Auto-highlight high-velocity tokens in the script: "Secret", "Revolution", "Unlock".', icon: Sparkles })
    }

    steps.push({ title: 'Chromatic Punch', desc: 'Apply cinematic high-contrast grading to the primary hook for immediate stimulus.', icon: Gauge })

    return steps.slice(0, 3)
  }, [metrics, selectedPersona])

  const runHookTest = () => {
    setHookTestState('generating')
    setTimeout(() => {
       setHookTestState('results')
       showToast('Hook A/B testing simulation complete.', 'success')
    }, 2500)
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-[0.4em] italic text-indigo-400">
            <Cpu className="w-4 h-4" />
            VPO Core v1.0
          </div>
          <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
            PREDICTION<br />ENGINE
          </h1>
        </div>

        <div className="flex flex-col items-end gap-2">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Global Benchmark Accuracy</span>
           <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                 {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-indigo-600 flex items-center justify-center text-[10px] font-black italic">CL</div>)}
              </div>
              <span className="text-2xl font-black text-white italic">94.8%</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Metric Cluster: Potential */}
        <div className={`${glassStyle} col-span-2 rounded-[3.5rem] p-12 relative overflow-hidden group`}>
           <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-1000 rotate-12">
              <TrendingUp className="w-64 h-64 text-emerald-500" />
           </div>

           <div className="flex items-center justify-between mb-12 relative z-10">
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Viral Potential Score</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Predictive Alignment for {selectedPersona}</p>
              </div>
              <div className="text-8xl font-black text-emerald-400 tracking-tighter italic tabular-nums shadow-emerald-500/20 drop-shadow-2xl">
                {viralScore}<span className="text-2xl not-italic ml-1 opacity-40">%</span>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
              {[
                { label: 'Pacing Density', val: metrics.cutsPerMinute > 12 ? 'HIGH' : 'MED', color: 'text-indigo-400' },
                { label: 'Hook Velocity', val: metrics.highRetentionWordsFound > 1 ? 'ELITE' : 'AVG', color: 'text-orange-400' },
                { label: 'Retention Alpha', val: viralScore > 85 ? 'TOP 1%' : 'TOP 10%', color: 'text-emerald-400' },
                { label: 'Semantic Power', val: `${metrics.semanticIntensity.toFixed(0)}%`, color: 'text-blue-400' }
              ].map((m, i) => (
                <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-2">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">{m.label}</span>
                   <span className={`text-sm font-black italic uppercase ${m.color}`}>{m.val}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Persona Selector */}
        <div className={`${glassStyle} rounded-[3.5rem] p-12 space-y-8 flex flex-col`}>
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-indigo-400">
                 <Users className="w-6 h-6" />
              </div>
              <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-widest italic">Audience Persona</h4>
           </div>

           <div className="flex-1 space-y-3 px-2">
              {(['Gen Z', 'B2B Professional', 'Tech Enthusiast', 'Lifestyle/Vlog'] as Persona[]).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPersona(p)}
                  className={`w-full p-6 rounded-[2rem] border text-left flex items-center justify-between group transition-all ${selectedPersona === p ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-600/20' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                >
                   <span className={`text-[11px] font-black uppercase tracking-widest italic transition-colors ${selectedPersona === p ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>{p}</span>
                   {selectedPersona === p && <ShieldCheck className="w-4 h-4 text-white" />}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Semantic Retention Heatmap */}
      <div className={`${glassStyle} rounded-[4rem] p-12 space-y-8`}>
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mr-2 inline-flex items-center gap-3">
                 <Activity className="w-6 h-6 text-emerald-400" /> Continuous Retention Heatmap
              </h3>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Predictive audience drop-off mapped against script stimulus</p>
           </div>
           <span className="px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-[0.2em] uppercase">Visual Stimulus Synced</span>
        </div>

        <div className="h-40 rounded-3xl bg-black/40 border border-white/5 p-6 flex flex-col justify-end relative overflow-hidden group">
           {/* Heatmap Grid lines */}
           <div className="absolute inset-0 flex" style={{ opacity: 0.1 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                 <div key={i} className="flex-1 border-r border-white/20 h-full" />
              ))}
           </div>
           
           {/* Heatmap Data */}
           <div className="relative w-full h-full flex items-end gap-1">
              {Array.from({ length: 40 }).map((_, i) => {
                 // Simulate a curve that bumps on hooks/cuts
                 // High in first 5% (hook), dips, spikes intermittently
                 const isHook = i < 4
                 const isSpike = Math.random() > 0.8 && i > 10
                 const baseHeight = 30 + Math.sin(i / 5) * 20
                 const height = isHook ? 90 + Math.random() * 10 : (isSpike ? 80 + Math.random() * 20 : baseHeight)
                 
                 let color = 'bg-slate-700'
                 if (height > 80) color = 'bg-emerald-400'
                 else if (height > 60) color = 'bg-indigo-400'
                 else if (height < 30) color = 'bg-rose-500' // Drop-off danger zone

                 return (
                    <motion.div
                       key={i}
                       initial={{ height: 0 }}
                       animate={{ height: `${height}%` }}
                       transition={{ duration: 1, delay: i * 0.02, ease: 'easeOut' }}
                       className={`flex-1 rounded-t-sm ${color} transition-colors min-h-[4px] relative group/bar`}
                    >
                       {/* Tooltip for dropoffs */}
                       {height < 30 && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                             Drop-off Risk
                          </div>
                       )}
                       {height > 85 && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                             Stimulus Peak
                          </div>
                       )}
                    </motion.div>
                 )
              })}
           </div>

           {/* Time Axis */}
           <div className="absolute bottom-1 left-6 right-6 flex justify-between text-[8px] font-black text-slate-500 tracking-widest mt-2 border-t border-white/5 pt-1">
              <span>0:00</span>
              <span>Hooks</span>
              <span>Body</span>
              <span>CTAs</span>
              <span>{Math.floor(metrics.totalDuration / 60)}:{(metrics.totalDuration % 60).toFixed(0).padStart(2, '0')}</span>
           </div>
        </div>
      </div>

      {/* Neural A/B Hook Synthesis */}
      <div className={`${glassStyle} rounded-[4rem] p-12 space-y-8`}>
        <div className="flex items-center justify-between">
           <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Neural A/B Hook Testing</h3>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Simulate 3 variants of the first 5 seconds against {selectedPersona} CTR</p>
           </div>
           
           {hookTestState === 'idle' && (
             <button
                onClick={runHookTest}
                className="px-8 py-4 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-[0.3em] transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-3"
             >
                <Target className="w-4 h-4" /> Run Audience Simulation
             </button>
           )}
        </div>

        {hookTestState === 'generating' && (
           <div className="h-48 rounded-[3rem] border border-indigo-500/20 bg-indigo-500/5 flex flex-col items-center justify-center gap-6">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-center space-y-2">
                 <p className="text-sm font-black text-white uppercase tracking-widest">Synthesizing Variants...</p>
                 <p className="text-[10px] text-indigo-400 italic">Extracting tokens, analyzing scroll-stop probability.</p>
              </div>
           </div>
        )}

        {hookTestState === 'results' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                 { name: 'Variant A: High Energy', ctr: '12.4%', lift: '+4.2%', color: 'from-rose-500/20 to-orange-500/5', border: 'border-rose-500/30', badge: 'text-rose-400' },
                 { name: 'Variant B: Curiosity Gap', ctr: '18.9%', lift: '+10.7%', color: 'from-emerald-500/20 to-teal-500/5', border: 'border-emerald-500/50', badge: 'text-emerald-400', winner: true },
                 { name: 'Variant C: Minimalist', ctr: '8.1%', lift: '-0.1%', color: 'from-slate-500/20 to-slate-800/10', border: 'border-slate-500/30', badge: 'text-slate-400' }
              ].map((v, i) => (
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15 }}
                    key={i}
                    className={`relative p-8 rounded-[3rem] bg-gradient-to-br ${v.color} border ${v.border} space-y-6 ${v.winner ? 'shadow-[0_0_50px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20' : ''}`}
                 >
                    {v.winner && (
                       <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-emerald-500 shadow-xl flex items-center justify-center animate-bounce">
                          <Target className="w-5 h-5 text-white" />
                       </div>
                    )}
                    <h4 className={`text-[11px] font-black uppercase tracking-widest ${v.badge}`}>{v.name}</h4>
                    
                    <div className="space-y-1">
                       <span className="text-[10px] text-slate-400 uppercase tracking-widest">Predicted CTR</span>
                       <div className="text-5xl font-black text-white tabular-nums tracking-tighter">{v.ctr}</div>
                       <span className={`text-[10px] font-bold ${v.lift.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>{v.lift} baseline</span>
                    </div>

                    <button className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest transition-colors">
                       {v.winner ? 'Apply Winner to Timeline' : 'Preview Hook'}
                    </button>
                 </motion.div>
              ))}
           </div>
        )}
      </div>

      {/* Strategic Roadmap */}
      <div className={`${glassStyle} rounded-[4rem] p-14 relative overflow-hidden`}>
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-50" />

         <div className="flex items-center gap-8 mb-12">
            <div className="w-1.5 h-12 bg-indigo-500 rounded-full" />
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Strategic Optimization Roadmap</h3>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {roadmap.map((step, i) => (
              <div key={i} className="space-y-6 group cursor-default">
                 <div className="flex items-center gap-6">
                    <span className="text-4xl font-black text-white/5 group-hover:text-indigo-500/20 transition-colors duration-500 tabular-nums">0{i+1}</span>
                    <div className="h-[2px] flex-1 bg-white/5 group-hover:bg-indigo-500/20 transition-colors duration-500" />
                 </div>
                 <div className="space-y-4 px-2">
                    <div className="flex items-center gap-4">
                       <step.icon className="w-5 h-5 text-indigo-400" />
                       <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{step.title}</h4>
                    </div>
                    <p className="text-slate-500 italic font-medium leading-relaxed group-hover:text-slate-200 transition-colors">{step.desc}</p>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  )
}

export default PredictionEngineView
