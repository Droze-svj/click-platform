'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';
import { Menu, X, ShieldCheck, Cpu, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] px-6 lg:px-12 py-8 transition-all duration-700 ${
        scrolled ? 'backdrop-blur-[60px] bg-surface-page/80 border-b-2 border-surface-100 dark:border-white/5 py-6 shadow-2xl' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1900px] mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-6 group cursor-pointer magnetic-hover">
          <div className="relative">
             <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
             <ClickLogo size={44} showWordmark wordmarkClassName="text-4xl tracking-tighter italic font-black uppercase" />
          </div>
        </Link>

        {/* Desktop Nav HUD */}
        <div className="hidden md:flex items-center gap-10 lg:gap-14 text-[10px] font-black uppercase tracking-[0.4em] lg:tracking-[0.5em] text-surface-400 dark:text-slate-500 italic">
          <a href="#features" className="hover:text-primary-500 transition-all hover:tracking-[0.6em] duration-500 magnetic-hover">Features</a>
          <a href="#workflow" className="hover:text-primary-500 transition-all hover:tracking-[0.6em] duration-500 magnetic-hover">Workflow</a>
          <a href="#pricing" className="hover:text-primary-500 transition-all hover:tracking-[0.6em] duration-500 magnetic-hover">Pricing</a>
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500/20" />
          <Link href="/login" className="text-surface-900 dark:text-white hover:text-primary-500 transition-all hover:scale-110 magnetic-hover">Log In</Link>
        </div>

        <div className="flex items-center gap-6">
          <Link
            href="/register"
            className="px-10 py-4 rounded-[1.8rem] bg-surface-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.4em] italic hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95 group flex items-center gap-3 border-none btn-shimmer magnetic-hover"
          >
            <ShieldCheck size={16} className="group-hover:rotate-12 transition-transform" />
            Get Started
          </Link>
          
          <button
            type="button"
            title={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            className="md:hidden w-14 h-14 rounded-2xl bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center text-surface-900 dark:text-white transition-all active:scale-90 magnetic-hover"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - High Fidelity */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-surface-page border-b-2 border-surface-100 dark:border-white/10 p-12 flex flex-col gap-10 md:hidden backdrop-blur-[80px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden bg-noise-grain"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-xl font-black uppercase tracking-[0.4em] italic text-surface-500 hover:text-primary-500 transition-all">Features</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="text-xl font-black uppercase tracking-[0.4em] italic text-surface-500 hover:text-primary-500 transition-all">Workflow</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-xl font-black uppercase tracking-[0.4em] italic text-surface-500 hover:text-primary-500 transition-all">Pricing</a>
            <div className="h-px bg-surface-100 dark:bg-white/5" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-xl font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white hover:text-primary-500 transition-all">Log In</Link>
            
            {/* Mobile HUD Elements */}
            <div className="mt-8 flex items-center gap-6 opacity-30">
               <Cpu size={24} className="text-primary-500" />
               <div className="h-px flex-1 bg-surface-100 dark:bg-white/5" />
               <span className="text-[10px] font-black uppercase tracking-widest italic text-surface-300">Click mobile</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
