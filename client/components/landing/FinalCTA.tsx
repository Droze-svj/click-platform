'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-32 px-6 relative flex flex-col items-center justify-center min-h-[60vh]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050505]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/15 blur-[160px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-4xl w-full mx-auto text-center"
      >
        <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
          READY TO <span className="text-indigo-500">DOMINATE?</span>
        </h2>
        <p className="text-slate-400 text-xl md:text-2xl font-medium mb-12 max-w-2xl mx-auto">
          Join 25,000 elite creators scaling their content empires with Click’s autonomous ecosystem.
        </p>

        <Link
          href="/register?plan=free"
          className="inline-flex group px-12 py-6 rounded-full bg-white text-black text-lg font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] items-center justify-center gap-4 active:scale-95"
        >
          Unleash The AI
          <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform" aria-hidden="true" />
        </Link>

        <p className="mt-6 text-xs text-slate-600 font-bold uppercase tracking-widest">
          No card needed · 90 seconds to first export
        </p>
      </motion.div>
    </section>
  );
}
