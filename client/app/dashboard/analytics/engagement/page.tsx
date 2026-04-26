'use client'

import dynamic from 'next/dynamic'
import { Brain, ArrowLeft, Fingerprint, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'

const ResonanceCommandMatrix = dynamic(
  () => import('../../../../components/EngagementCommandCenter'),
  { ssr: false, loading: () => (
    <div className="min-h-screen bg-[#020205] flex flex-col items-center justify-center">
       <Brain size={64} className="text-indigo-500 animate-pulse mb-8" />
       <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Manifesting Resonance Interface...</span>
    </div>
  )}
)

export default function ResonanceCommandMatrixPage() {
  const router = useRouter()

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#020205] text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-rose-900/10 opacity-30 pointer-events-none" />
        
        {/* Sticky Global Nav Overlay (Minimal) */}
        <div className="sticky top-0 z-[100] backdrop-blur-3xl bg-black/40 border-b border-white/5 px-10 py-6 flex items-center justify-between">
           <div className="flex items-center gap-8">
              <button onClick={() => router.push('/dashboard/analytics')} title="Back"
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={24} />
              </button>
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Fingerprint size={20} className="text-indigo-400" />
                 </div>
                 <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">Resonance_Matrix</h1>
              </div>
           </div>
           <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-2xl">
              <Shield size={14} className="text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-400 tracking-[0.3em] uppercase italic">Sovereign_Shield_Active</span>
           </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
           <ResonanceCommandMatrix />
        </motion.div>
      </div>
    </ErrorBoundary>
  )
}
