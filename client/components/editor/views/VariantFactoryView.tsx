'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Target,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Star,
  Shuffle,
  RotateCcw,
  BarChart3
} from 'lucide-react'

interface HookVariant {
  id: string
  type: 'Pattern Interrupt' | 'Curiosity Gap' | 'Problem/Solution' | 'Personal Story'
  text: string
  predictedRetention: number
  viralScore: number
  justification: string
}

interface VariantFactoryViewProps {
  onApplyVariant: (variant: HookVariant) => void
  onBack: () => void
}

const VariantFactoryView: React.FC<VariantFactoryViewProps> = ({ onApplyVariant, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [variants, setVariants] = useState<HookVariant[]>([])

  const handleGenerate = async () => {
    setIsGenerating(true)
    // Simulation of AI Hook Generation
    await new Promise(r => setTimeout(r, 2000))

    const mockVariants: HookVariant[] = [
      {
        id: 'var-1',
        type: 'Pattern Interrupt',
        text: "STOP SCROLLING. Your current workflow is killing your growth.",
        predictedRetention: 94,
        viralScore: 98,
        justification: "Strong negative hook combined with a pattern interrupt visual zoom."
      },
      {
        id: 'var-2',
        type: 'Curiosity Gap',
        text: "Most creators don't know this one secret about neural editing...",
        predictedRetention: 89,
        viralScore: 85,
        justification: "Leverages the curiosity gap by withholding a key piece of information."
      },
      {
        id: 'var-3',
        type: 'Problem/Solution',
        text: "Are you tired of low engagement? Here is how Whop AI fixes it.",
        predictedRetention: 78,
        viralScore: 72,
        justification: "Direct address of a pain point with an immediate solution promise."
      }
    ]

    setVariants(mockVariants)
    setIsGenerating(false)
  }

  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-fuchsia-400" />
          <h2 className="text-lg font-black tracking-tight text-white italic uppercase">Viral Variant Factory</h2>
        </div>
        <button
          onClick={onBack}
          className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-3 h-3" />
          Back to Elite
        </button>
      </div>

      <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic border-l-2 border-fuchsia-500/30 pl-4">
        Synthesize multiple &quot;Hook&quot; variations. Our Engine predicts which opening will achieve
        <span className="text-white"> maximum conversion</span> based on trending social patterns.
      </p>

      {variants.length === 0 && !isGenerating ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-12">
           <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center relative">
              <Shuffle className="w-10 h-10 text-slate-600 animate-pulse" />
           </div>
           <button
             onClick={handleGenerate}
             className="px-10 py-5 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 transition-all shadow-[0_0_30px_rgba(192,38,211,0.3)] flex items-center gap-3 group"
           >
             <Zap className="w-5 h-5 text-white" />
             <span className="text-xs font-black text-white uppercase tracking-[0.2em]">Generate Hook Variants</span>
           </button>
        </div>
      ) : isGenerating ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-12">
           <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-fuchsia-500/10 flex items-center justify-center">
                 <Target className="w-8 h-8 text-fuchsia-400 animate-spin" />
              </div>
              <div className="absolute inset-x-0 -bottom-12 text-center">
                 <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Running Viral Simulator...</span>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-4">
           {variants.map((variant, i) => (
             <motion.div
               key={variant.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden"
             >
               <div className="flex items-start justify-between relative z-10">
                 <div className="space-y-3">
                   <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        i === 0 ? 'bg-fuchsia-500 text-white' : 'bg-white/5 text-slate-400'
                      }`}>
                        {variant.type}
                      </span>
                      {i === 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest">
                          <Star className="w-2.5 h-2.5 fill-amber-500" />
                          Recommended
                        </div>
                      )}
                   </div>
                   <h3 className="text-lg font-black text-white italic leading-tight pr-12">
                     &quot;{variant.text}&quot;
                   </h3>
                   <p className="text-[10px] font-medium text-slate-500 leading-relaxed pr-8">
                      <span className="text-fuchsia-400/80 uppercase font-black mr-2 italic">Why?</span>
                      {variant.justification}
                   </p>
                 </div>

                 <div className="flex flex-col items-end gap-2">
                   <div className="text-right">
                      <div className="text-2xl font-black text-white italic leading-none">{variant.predictedRetention}%</div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Retention</div>
                   </div>
                   <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${variant.predictedRetention}%` }}
                        className="h-full bg-gradient-to-r from-fuchsia-600 to-indigo-600"
                      />
                   </div>
                 </div>
               </div>

               <button
                 onClick={() => onApplyVariant(variant)}
                 className="mt-6 w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 group/btn"
               >
                 <span className="text-[10px] font-black uppercase tracking-widest">Inject this variant</span>
                 <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
               </button>

               {/* Background subtle number */}
               <div className="absolute top-4 right-8 text-[120px] font-black text-white/[0.02] -z-0 leading-none pointer-events-none select-none italic">
                 {i + 1}
               </div>
             </motion.div>
           ))}

           <div className="pt-4 flex items-center justify-center gap-3 opacity-40">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Simulated Benchmark: TikTok/Reels Global Trend Aggregator</span>
           </div>
        </div>
      )}
    </div>
  )
}

export default VariantFactoryView
