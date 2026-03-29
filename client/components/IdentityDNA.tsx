'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Fingerprint, Sparkles, User, MessageSquare, Target, 
  ShieldCheck, Zap, Activity, Info, Save, Undo,
  Palette, Smartphone, Type, Sliders, Hash
} from 'lucide-react'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

export default function IdentityDNA() {
  const [activeTab, setActiveTab] = useState<'voice' | 'character' | 'content'>('voice')
  const [dna, setDna] = useState({
    voice: { tone: 'authoritative', pacing: 'fast', personality: 'bold' },
    character: { faceSeed: '124987', outfit: 'smart-tech', posture: 'heroic' },
    content: { niche: 'tech-expert', target: 'early-adopters', angle: 'contrarian' }
  })
  
  const [saving, setSaving] = useState(false)
  const [pulse, setPulse] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Simulate high-velocity lattice sync
    await new Promise(r => setTimeout(r, 2000))
    setSaving(false)
    setPulse(true)
    setTimeout(() => setPulse(false), 2000)
  }

  return (
    <div className={`min-h-screen ${glassStyle} rounded-[4rem] p-12 overflow-hidden relative border-indigo-500/20 shadow-[0_50px_150px_rgba(0,0,0,0.8)]`}>
      {/* Background Kinetic Layer */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <Fingerprint size={800} className="absolute -top-40 -left-40 rotate-12 blur-[2px]" />
      </div>

      <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/30 rounded-[2.2rem] flex items-center justify-center shadow-2xl group overflow-hidden">
            <Fingerprint className="text-indigo-400 group-hover:scale-125 transition-transform duration-700" size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">Identity DNA Hub</h1>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] italic leading-none border-l-2 border-indigo-500/20 pl-4 ml-1">Universal Brand Resonance // 2026.5_SOVEREIGN</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {pulse && (
             <motion.span initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic pr-4">Lattice_Synced_Success</motion.span>
           )}
           <button 
             onClick={handleSave}
             disabled={saving}
             className={`px-10 py-5 bg-white text-black rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:bg-indigo-500 hover:text-white transition-all duration-700 italic active:scale-95 flex items-center gap-4 ${saving ? 'opacity-50' : ''}`}
           >
             {saving ? <Activity className="animate-spin" size={18} /> : <Save size={18} />}
             SYNC_IDENTITY
           </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-12 relative z-10">
        {/* Navigation Sidebar */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
           {[
             { id: 'voice', label: 'Voice DNA', icon: MessageSquare, desc: 'Tonal Resonance' },
             { id: 'character', label: 'Character Matrix', icon: User, desc: 'Digital Twin Consistency' },
             { id: 'content', label: 'Benchmark Sync', icon: Target, desc: 'Niche Velocity' }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`w-full p-8 rounded-[2.5rem] transition-all duration-700 text-left group border ${
                 activeTab === tab.id 
                 ? 'bg-white text-black border-white shadow-3xl scale-105' 
                 : 'bg-white/[0.02] text-slate-900 border-white/5 hover:bg-white/[0.05]'
               }`}
             >
                <div className="flex items-center gap-6 mb-2">
                   <tab.icon size={20} className={activeTab === tab.id ? 'text-black' : 'text-indigo-400'} />
                   <span className="text-[12px] font-black uppercase tracking-tighter">{tab.label}</span>
                </div>
                <p className={`text-[9px] font-black uppercase tracking-widest opacity-40 ml-11 italic ${activeTab === tab.id ? 'text-black/60' : 'text-slate-800'}`}>{tab.desc}</p>
             </button>
           ))}

           <div className={`p-8 rounded-[2.5rem] mt-12 bg-indigo-500/5 border border-indigo-500/10 shadow-inner group transition-all duration-700`}>
              <div className="flex items-center gap-4 mb-4">
                 <ShieldCheck className="text-indigo-400" size={16} />
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] italic">Lattice Integrity</span>
              </div>
              <p className="text-[11px] text-slate-800 font-black leading-relaxed opacity-60 uppercase italic">
                Your DNA is currently 98.4% synchronized with global viral trajectories.
              </p>
           </div>
        </div>

        {/* Content Area */}
        <div className="col-span-12 lg:col-span-9">
          <AnimatePresence mode="wait">
             {activeTab === 'voice' && (
               <motion.div 
                 key="voice"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="space-y-8"
               >
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className={`${glassStyle} p-10 rounded-[3rem] group`}>
                       <div className="flex items-center gap-4 mb-8">
                          <Sliders className="text-indigo-400" size={20} />
                          <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Tonal Flux</h3>
                       </div>
                       <div className="space-y-12">
                          {['Tone_Intensity', 'Pacing_Velocity', 'Vocabulary_Resonance'].map(label => (
                            <div key={label} className="space-y-4">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">{label}</span>
                                  <span className="text-[10px] font-black text-indigo-400 italic tabular-nums group-hover:animate-pulse">84%</span>
                               </div>
                               <div className="h-2 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
                                  <div className="h-full w-[84%] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className={`${glassStyle} p-10 rounded-[3rem]`}>
                       <div className="flex items-center gap-4 mb-8">
                          <Sparkles className="text-amber-400" size={20} />
                          <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Voice Archetype</h3>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          {['Educational', 'Authoritative', 'Witty', 'Aggressive', 'Calm', 'Entertaining'].map(arche => (
                            <button 
                              key={arche}
                              className={`p-6 rounded-2xl border transition-all duration-700 text-[10px] font-black uppercase tracking-widest italic ${
                                dna.voice.tone === arche.toLowerCase() 
                                ? 'bg-indigo-500 text-white border-indigo-400 shadow-xl' 
                                : 'bg-white/5 text-slate-800 border-white/5 hover:border-indigo-500/20'
                              }`}
                            >
                              {arche}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className={`${glassStyle} p-10 rounded-[3rem] flex flex-col items-center justify-center text-center bg-black/20`}>
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
                       <Zap className="text-indigo-400 animate-pulse" size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2 leading-none">Voice Cloning Initiated</h3>
                    <p className="text-[11px] text-slate-800 font-black uppercase tracking-[0.3em] leading-relaxed mb-8 italic opacity-60 max-w-md">Upload a 30-second audio sample to extract your synchronous vocal DNA.</p>
                    <button className="px-12 py-5 bg-indigo-500 text-white rounded-[2rem] text-[12px] font-black uppercase tracking-[0.5em] shadow-xl hover:bg-indigo-400 transition-all duration-700 italic active:scale-95 group/btn">
                       START_LATTICE_SYNC
                    </button>
                 </div>
               </motion.div>
             )}

             {activeTab === 'character' && (
               <motion.div 
                 key="character"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="space-y-8"
               >
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className={`${glassStyle} p-10 rounded-[3rem] bg-indigo-500/5 border-indigo-500/20 col-span-1 lg:col-span-2 flex flex-col justify-between`}>
                       <div>
                          <div className="flex items-center gap-4 mb-8">
                             <Palette className="text-indigo-400" size={20} />
                             <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Consistency Lock_v2.1</h3>
                          </div>
                          <p className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">SEED_FINGERPRINT: {dna.character.faceSeed}</p>
                          <p className="text-[11px] text-slate-900 font-black uppercase tracking-widest leading-relaxed mb-10 italic opacity-40">High-fidelity generative lock for character persistence across all kinetic sequences.</p>
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="flex -space-x-4">
                             {[1,2,3,4].map(i => (
                               <div key={i} className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-indigo-500/20 shadow-xl overflow-hidden backdrop-blur-3xl" />
                             ))}
                          </div>
                          <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic hover:underline">REGENERATE_FDP</button>
                       </div>
                    </div>

                    <div className={`${glassStyle} p-10 rounded-[3rem] flex flex-col justify-between`}>
                       <div className="flex items-center gap-4 mb-8">
                          <Smartphone className="text-indigo-400" size={20} />
                          <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Archive Style</h3>
                       </div>
                       <div className="space-y-4">
                          {['Smart_Tech', 'Cyber_Punk', 'Minimal_Zen', 'Bold_Retro'].map(style => (
                             <button key={style} className={`w-full p-6 h-16 rounded-2xl border text-[10px] font-black uppercase tracking-widest italic flex items-center justify-between group/style transition-all duration-700 ${dna.character.outfit === style.toLowerCase().replace('_', '-') ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-800 border-white/5 hover:border-indigo-500/20'}`}>
                                {style}
                                <div className={`w-2 h-2 rounded-full ${dna.character.outfit === style.toLowerCase().replace('_', '-') ? 'bg-black' : 'bg-indigo-500 group-hover/style:animate-ping'}`} />
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}

             {activeTab === 'content' && (
               <motion.div 
                 key="content"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="space-y-8"
               >
                 <div className={`${glassStyle} p-12 rounded-[4rem] min-h-[400px] flex flex-col relative overflow-hidden bg-black/40 border-indigo-500/20`}>
                    <div className="flex items-center justify-between mb-12 relative z-10">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                             <Activity className="text-indigo-400 animate-pulse" size={24} />
                          </div>
                          <div>
                             <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Niche Resonance Chart</h3>
                             <p className="text-[8px] font-black text-slate-800 uppercase tracking-[0.3em] italic opacity-40">Live Global Sync // {dna.content.niche}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest opacity-40 italic">CONVERGENCE_SCORE</p>
                              <p className="text-2xl font-black text-indigo-400 italic tabular-nums">98.2%</p>
                           </div>
                       </div>
                    </div>
                    
                    <div className="flex-1 flex items-end justify-between gap-4 px-6 relative z-10">
                       {[60, 45, 90, 70, 85, 95, 80, 50, 65, 98, 88].map((h, i) => (
                         <div key={i} className="flex-1 space-y-4 group">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              transition={{ duration: 2.5, delay: i * 0.1, ease: 'circOut' }}
                              className={`w-full rounded-2xl bg-gradient-to-t from-indigo-500/40 via-indigo-500 to-indigo-400 shadow-2xl relative overflow-hidden group-hover:scale-110 transition-transform duration-700`}
                            >
                               <div className="absolute inset-0 bg-white/20 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.div>
                            <p className="text-[8px] font-black text-slate-950 uppercase italic text-center opacity-0 group-hover:opacity-100 transition-opacity">V_0{i+1}</p>
                         </div>
                       ))}
                    </div>
                 </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
