'use client';

import React from 'react';
import BrandKit from '../../../components/BrandKit';
import { motion } from 'framer-motion';
import { Orbit, Shield, Sparkles, ArrowLeft } from 'lucide-react';
import SectionHeader from '../../../components/dashboard/SectionHeader';
import { useRouter } from 'next/navigation';
import ToastContainer from '../../../components/ToastContainer';

export default function BrandKitPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1700px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
      <ToastContainer />

      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
         <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard" className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
              <ArrowLeft size={24} />
            </button>
            <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
              <Orbit size={40} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                    Studio · Visual Identity
                  </span>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      ENCRYPTED_STORAGE
                  </div>
               </div>
               <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">Brand Kit</h1>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest italic">
              <Sparkles className="w-4 h-4" />
              MULTI_PROFILE_READY
            </span>
         </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        <div className="lg:col-span-4 space-y-8">
           <section className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3rem] p-10 shadow-xl">
              <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase mb-6 leading-none">Identity Core</h2>
              <p className="text-sm font-medium text-surface-500 dark:text-slate-400 leading-relaxed italic uppercase tracking-tight mb-8">
                Your colors, fonts, logos and voice — saved once and applied everywhere Click generates content. Set it up here and every caption, thumbnail and short stays on-brand automatically.
              </p>
              <div className="space-y-4 pt-8 border-t border-surface-100 dark:border-surface-800">
                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-page/50 dark:bg-surface-950/50 border border-surface-100 dark:border-surface-800 shadow-inner group transition-all hover:border-primary-500/20">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                       <Shield size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest italic text-surface-600 dark:text-slate-300">End-to-End Encryption</span>
                 </div>
                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-page/50 dark:bg-surface-950/50 border border-surface-100 dark:border-surface-800 shadow-inner group transition-all hover:border-primary-500/20">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                       <Orbit size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest italic text-surface-600 dark:text-slate-300">Omni-Channel Sync</span>
                 </div>
              </div>
           </section>
        </div>

        <div className="lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 sm:p-12 shadow-2xl"
          >
            <BrandKit
              onApply={(kit) => {
                console.log('Brand applied globally:', kit.primaryColor);
              }}
            />
          </motion.div>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
      `}</style>
    </div>
  );
}
