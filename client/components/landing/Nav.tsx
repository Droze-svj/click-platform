'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';
import { Menu, X, ShieldCheck, Cpu, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';

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
      className={`fixed top-0 left-0 right-0 z-[100] px-4 sm:px-6 lg:px-12 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-[60px] bg-surface-page/85 border-b border-surface-100 dark:border-white/10 py-3 md:py-4 shadow-2xl' : 'bg-transparent py-4 md:py-6'
      }`}
    >
      <div className="max-w-[1900px] mx-auto flex items-center justify-between">
        <Link href="/" aria-label="Click home" className="flex shrink-0 items-center gap-6 group cursor-pointer magnetic-hover">
          <div className="relative">
             <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
             <ClickLogo size={36} showWordmark wordmarkClassName="text-2xl sm:text-3xl md:text-4xl whitespace-nowrap tracking-tighter italic font-black uppercase" />
          </div>
        </Link>

        {/* Desktop Nav HUD */}
        <div className="hidden md:flex items-center gap-8 lg:gap-10 text-sm font-semibold text-surface-600 dark:text-slate-300">
          <a href="#features" className="hover:text-primary-500 transition-colors">Features</a>
          <a href="#workflow" className="hover:text-primary-500 transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-primary-500 transition-colors">Pricing</a>
          <div className="w-1 h-1 rounded-full bg-surface-300 dark:bg-white/20" aria-hidden="true" />
          <Link href="/login" className="text-surface-900 dark:text-white hover:text-primary-500 transition-colors">Log in</Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/register"
            className="whitespace-nowrap px-4 py-2.5 sm:px-7 sm:py-3.5 rounded-full bg-surface-900 dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95 group flex items-center gap-3 border-none btn-shimmer magnetic-hover"
          >
            <ShieldCheck size={16} className="hidden sm:block group-hover:rotate-12 transition-transform" aria-hidden="true" />
            Start free
          </Link>
          
          <button
            type="button"
            title={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
            className="md:hidden w-11 h-11 shrink-0 rounded-xl bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center text-surface-900 dark:text-white transition-all active:scale-90 magnetic-hover"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - High Fidelity */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-surface-page border-b-2 border-surface-100 dark:border-white/10 px-6 py-8 flex flex-col gap-6 md:hidden backdrop-blur-[80px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden bg-noise-grain"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-xl font-semibold text-surface-700 dark:text-slate-200 hover:text-primary-500 transition-colors">Features</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="text-xl font-semibold text-surface-700 dark:text-slate-200 hover:text-primary-500 transition-colors">How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-xl font-semibold text-surface-700 dark:text-slate-200 hover:text-primary-500 transition-colors">Pricing</a>
            <div className="h-px bg-surface-100 dark:bg-white/5" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-xl font-semibold text-surface-900 dark:text-white hover:text-primary-500 transition-colors">Log in</Link>
            
            {/* Mobile HUD Elements */}
            <div className="mt-8 flex items-center gap-6 opacity-30">
               <Cpu size={24} className="text-primary-500" />
               <div className="h-px flex-1 bg-surface-100 dark:bg-white/5" />
               <span className="text-[10px] font-black uppercase tracking-widest italic text-surface-300">Click mobile</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
